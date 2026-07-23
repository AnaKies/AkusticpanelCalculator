from __future__ import annotations

import errno
import hashlib
import json
import os
import tempfile
import threading
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .contracts import ApiError, canonical_json_bytes, validate_archive, validate_config

CONFIG_ARCHIVE_EXTENSION = '.akpconfig.json'


@dataclass(frozen=True, slots=True)
class BackendPaths:
    root: Path
    config_path: Path
    archive_dir: Path
    backup_dir: Path

    @classmethod
    def from_root(cls, root: Path) -> 'BackendPaths':
        resolved = root.resolve()
        return cls(
            root=resolved,
            config_path=resolved / 'config.json',
            archive_dir=resolved / 'saved-configurations',
            backup_dir=resolved / '.backend-backups',
        )


@dataclass(frozen=True, slots=True)
class ConfigReadResult:
    config: dict[str, Any]
    revision: str


@dataclass(frozen=True, slots=True)
class ConfigWriteResult:
    revision: str
    unchanged: bool


@dataclass(frozen=True, slots=True)
class ArchiveWriteResult:
    filename: str
    created: bool


def _revision(raw: bytes) -> str:
    return f'sha256:{hashlib.sha256(raw).hexdigest()}'


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    safe = ''.join(char.lower() if char.isalnum() else '-' for char in normalized)
    safe = '-'.join(part for part in safe.split('-') if part)
    return safe[:64] or 'konfiguration'


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


class StorageService:
    def __init__(self, paths: BackendPaths, backup_retention: int = 3):
        self.paths = paths
        self.backup_retention = backup_retention
        self.lock = threading.RLock()

    def _atomic_replace(self, target: Path, raw: bytes) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(prefix=f'.{target.name}.', suffix='.tmp', dir=target.parent)
        temporary_path = Path(temporary_name)
        try:
            with os.fdopen(descriptor, 'wb') as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, target)
            _fsync_directory(target.parent)
        except OSError as exc:
            temporary_path.unlink(missing_ok=True)
            if exc.errno == errno.ENOSPC:
                raise ApiError(507, 'INSUFFICIENT_STORAGE', 'The configuration could not be stored.') from exc
            raise ApiError(500, 'STORAGE_WRITE_FAILED', 'The configuration could not be stored.') from exc

    def _read_json_file(self, path: Path, missing_code: str) -> tuple[dict[str, Any], bytes]:
        if not path.exists():
            raise ApiError(404, missing_code, 'The requested data does not exist.')
        try:
            raw = path.read_bytes()
            payload = json.loads(raw.decode('utf-8'))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError(500, 'STORAGE_CORRUPT', 'Stored data is not readable.') from exc
        if not isinstance(payload, dict):
            raise ApiError(500, 'STORAGE_CORRUPT', 'Stored data is not readable.')
        return payload, raw

    def read_config(self) -> ConfigReadResult:
        with self.lock:
            config, raw = self._read_json_file(self.paths.config_path, 'CONFIG_NOT_FOUND')
            try:
                validate_config(config)
            except ApiError as exc:
                raise ApiError(500, 'STORAGE_CORRUPT', 'Stored configuration is invalid.') from exc
            return ConfigReadResult(config=config, revision=_revision(raw))

    def _write_backup(self, current_raw: bytes) -> None:
        self.paths.backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime('%Y%m%dT%H%M%S.%fZ')
        backup_name = f'config-{stamp}-{_revision(current_raw)[7:19]}.json'
        self._atomic_replace(self.paths.backup_dir / backup_name, current_raw)
        backups = sorted(self.paths.backup_dir.glob('config-*.json'), reverse=True)
        for obsolete in backups[self.backup_retention:]:
            obsolete.unlink(missing_ok=True)

    def write_config(self, config: dict[str, Any], base_revision: str | None) -> ConfigWriteResult:
        validate_config(config)
        desired_raw = canonical_json_bytes(config)
        desired_revision = _revision(desired_raw)

        with self.lock:
            if self.paths.config_path.exists():
                current_config, current_raw = self._read_json_file(self.paths.config_path, 'CONFIG_NOT_FOUND')
                try:
                    validate_config(current_config)
                except ApiError as exc:
                    raise ApiError(500, 'STORAGE_CORRUPT', 'Stored configuration is invalid.') from exc
                current_revision = _revision(current_raw)

                if desired_raw == current_raw:
                    return ConfigWriteResult(revision=current_revision, unchanged=True)
                if base_revision is None:
                    raise ApiError(428, 'PRECONDITION_REQUIRED', 'A configuration revision is required.')
                if base_revision != current_revision:
                    raise ApiError(409, 'REVISION_CONFLICT', 'The stored configuration has changed.', {
                        'currentRevision': current_revision,
                    })
                self._write_backup(current_raw)
            elif base_revision is not None:
                raise ApiError(409, 'REVISION_CONFLICT', 'The stored configuration has changed.', {
                    'currentRevision': None,
                })

            self._atomic_replace(self.paths.config_path, desired_raw)
            return ConfigWriteResult(revision=desired_revision, unchanged=False)

    def _archive_matches_request_id(self, request_id: str) -> list[Path]:
        suffix = request_id.replace('-', '')[:12]
        return sorted(self.paths.archive_dir.glob(f'*-{suffix}{CONFIG_ARCHIVE_EXTENSION}'))

    def create_archive(self, request_id: str, archive: dict[str, Any]) -> ArchiveWriteResult:
        validate_archive(archive)
        raw = canonical_json_bytes(archive)
        suffix = request_id.replace('-', '')[:12]

        with self.lock:
            self.paths.archive_dir.mkdir(parents=True, exist_ok=True)
            existing = self._archive_matches_request_id(request_id)
            if existing:
                if existing[0].read_bytes() == raw:
                    return ArchiveWriteResult(filename=existing[0].name, created=False)
                raise ApiError(409, 'IDEMPOTENCY_CONFLICT', 'The archive request ID was already used.')

            saved_at = str(archive.get('savedAt') or datetime.now(UTC).isoformat())
            try:
                parsed_stamp = datetime.fromisoformat(saved_at.replace('Z', '+00:00'))
            except ValueError:
                parsed_stamp = datetime.now(UTC)
            stamp = parsed_stamp.astimezone(UTC).strftime('%Y%m%d-%H%M%S-%f')
            display_name = str(archive.get('displayName') or 'Konfiguration')
            filename = f'{stamp}-{_slugify(display_name)}-{suffix}{CONFIG_ARCHIVE_EXTENSION}'
            target = self.paths.archive_dir / filename
            if target.exists():
                raise ApiError(409, 'ARCHIVE_CONFLICT', 'The archive already exists.')
            self._atomic_replace(target, raw)
            return ArchiveWriteResult(filename=filename, created=True)

    def list_archives(self, cursor: int = 0, limit: int = 100) -> tuple[list[dict[str, Any]], int | None]:
        with self.lock:
            self.paths.archive_dir.mkdir(parents=True, exist_ok=True)
            files = sorted(self.paths.archive_dir.glob(f'*{CONFIG_ARCHIVE_EXTENSION}'), reverse=True)
            selected = files[cursor:cursor + limit]
            entries: list[dict[str, Any]] = []
            for path in selected:
                try:
                    payload, _ = self._read_json_file(path, 'ARCHIVE_NOT_FOUND')
                    validate_archive(payload)
                except ApiError:
                    continue
                summary = payload.get('summary')
                entries.append({
                    'filename': path.name,
                    'path': f'/api/configurations/{path.name}',
                    'savedAt': payload.get('savedAt'),
                    'displayName': payload.get('displayName') or path.stem,
                    'summary': summary if isinstance(summary, dict) else {},
                })
            next_cursor = cursor + len(selected) if cursor + len(selected) < len(files) else None
            return entries, next_cursor

    def read_archive(self, filename: str) -> dict[str, Any]:
        if '/' in filename or '\\' in filename or not filename.endswith(CONFIG_ARCHIVE_EXTENSION):
            raise ApiError(400, 'INVALID_ARCHIVE_NAME', 'The archive name is invalid.')
        with self.lock:
            target = self.paths.archive_dir / filename
            payload, _ = self._read_json_file(target, 'ARCHIVE_NOT_FOUND')
            try:
                return validate_archive(payload)
            except ApiError as exc:
                raise ApiError(500, 'ARCHIVE_CORRUPT', 'Stored archive is invalid.') from exc

    def health(self) -> dict[str, Any]:
        with self.lock:
            if not self.paths.config_path.exists():
                config_status = 'missing'
            else:
                try:
                    self.read_config()
                    config_status = 'ok'
                except ApiError:
                    config_status = 'corrupt'
            storage_status = 'writable' if os.access(self.paths.root, os.W_OK) else 'degraded'
            backup_count = len(list(self.paths.backup_dir.glob('config-*.json'))) if self.paths.backup_dir.exists() else 0
            return {
                'configStatus': config_status,
                'storageStatus': storage_status,
                'backupCount': backup_count,
            }

    def restore_backup(self, backup_name: str) -> ConfigWriteResult:
        if '/' in backup_name or '\\' in backup_name or not backup_name.startswith('config-'):
            raise ApiError(400, 'INVALID_BACKUP_NAME', 'The backup name is invalid.')
        with self.lock:
            backup_path = self.paths.backup_dir / backup_name
            config, _ = self._read_json_file(backup_path, 'BACKUP_NOT_FOUND')
            validate_config(config)
            desired_raw = canonical_json_bytes(config)
            self._atomic_replace(self.paths.config_path, desired_raw)
            return ConfigWriteResult(revision=_revision(desired_raw), unchanged=False)
