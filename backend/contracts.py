from __future__ import annotations

import json
import math
import uuid
from dataclasses import dataclass
from typing import Any

API_VERSION = 2
MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_JSON_DEPTH = 32
MAX_JSON_NODES = 200_000
MAX_STRING_LENGTH = 512 * 1024
MAX_KEY_LENGTH = 256
CURRENT_CONFIG_SCHEMA_VERSION = 9
CONFIG_ARCHIVE_KIND = 'akustikpanele-configuration-archive'
CONFIG_ARCHIVE_VERSION = 1

COLLECTION_LIMITS = {
    'workspaceTabs': 100,
    'obstacles': 10_000,
    'combinedPanels': 10_000,
    'measurementCollections': 100,
    'measurements': 10_000,
}
MAP_LIMITS = {
    'labelCallouts': 100_000,
}


@dataclass(slots=True)
class ApiError(Exception):
    status: int
    code: str
    public_message: str
    details: dict[str, Any] | None = None

    def __str__(self) -> str:
        return self.code


def _reject_json_constant(value: str) -> None:
    raise ValueError(f'non-finite JSON constant: {value}')


def parse_json_bytes(raw_body: bytes) -> Any:
    try:
        return json.loads(raw_body.decode('utf-8'), parse_constant=_reject_json_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.') from exc


def canonical_json_bytes(payload: Any) -> bytes:
    return (json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def validate_json_limits(payload: Any) -> None:
    nodes = 0
    stack: list[tuple[Any, int, str | None]] = [(payload, 1, None)]

    while stack:
        value, depth, parent_key = stack.pop()
        nodes += 1
        if nodes > MAX_JSON_NODES:
            raise ApiError(422, 'VALIDATION_FAILED', 'The JSON document contains too many values.', {'field': parent_key})
        if depth > MAX_JSON_DEPTH:
            raise ApiError(422, 'VALIDATION_FAILED', 'The JSON document is nested too deeply.', {'field': parent_key})

        if isinstance(value, dict):
            if parent_key in MAP_LIMITS and len(value) > MAP_LIMITS[parent_key]:
                raise ApiError(422, 'VALIDATION_FAILED', 'A collection exceeds its allowed size.', {'field': parent_key})
            for key, child in value.items():
                if not isinstance(key, str) or len(key) > MAX_KEY_LENGTH:
                    raise ApiError(422, 'VALIDATION_FAILED', 'An object key is invalid or too long.', {'field': parent_key})
                stack.append((child, depth + 1, key))
        elif isinstance(value, list):
            limit = COLLECTION_LIMITS.get(parent_key or '')
            if limit is not None and len(value) > limit:
                raise ApiError(422, 'VALIDATION_FAILED', 'A collection exceeds its allowed size.', {'field': parent_key})
            for child in value:
                stack.append((child, depth + 1, parent_key))
        elif isinstance(value, str):
            if len(value) > MAX_STRING_LENGTH:
                raise ApiError(422, 'VALIDATION_FAILED', 'A string value is too long.', {'field': parent_key})
        elif isinstance(value, float) and not math.isfinite(value):
            raise ApiError(422, 'VALIDATION_FAILED', 'Numeric values must be finite.', {'field': parent_key})
        elif value is not None and not isinstance(value, (str, int, float, bool)):
            raise ApiError(422, 'VALIDATION_FAILED', 'The JSON document contains an unsupported value.', {'field': parent_key})


def validate_config(config: Any) -> dict[str, Any]:
    if not isinstance(config, dict):
        raise ApiError(422, 'VALIDATION_FAILED', 'Configuration must be a JSON object.', {'field': 'config'})

    validate_json_limits(config)
    schema_version = config.get('schemaVersion')
    if schema_version is not None:
        if isinstance(schema_version, bool) or not isinstance(schema_version, int):
            raise ApiError(422, 'VALIDATION_FAILED', 'schemaVersion must be an integer.', {'field': 'schemaVersion'})
        if not 1 <= schema_version <= CURRENT_CONFIG_SCHEMA_VERSION:
            raise ApiError(422, 'UNSUPPORTED_SCHEMA_VERSION', 'The configuration schema version is not supported.', {
                'field': 'schemaVersion',
                'maxSupported': CURRENT_CONFIG_SCHEMA_VERSION,
            })

    for field in ('room', 'grid'):
        if field in config and not isinstance(config[field], dict):
            raise ApiError(422, 'VALIDATION_FAILED', f'{field} must be an object.', {'field': field})

    for field in ('workspaceTabs', 'obstacles', 'combinedPanels', 'measurementCollections', 'measurements'):
        if field in config and not isinstance(config[field], list):
            raise ApiError(422, 'VALIDATION_FAILED', f'{field} must be an array.', {'field': field})

    if 'labelCallouts' in config and not isinstance(config['labelCallouts'], dict):
        raise ApiError(422, 'VALIDATION_FAILED', 'labelCallouts must be an object.', {'field': 'labelCallouts'})

    return config


def validate_archive(archive: Any) -> dict[str, Any]:
    if not isinstance(archive, dict):
        raise ApiError(422, 'VALIDATION_FAILED', 'Archive must be a JSON object.', {'field': 'archive'})
    validate_json_limits(archive)
    if archive.get('kind') != CONFIG_ARCHIVE_KIND:
        raise ApiError(422, 'UNSUPPORTED_ARCHIVE_KIND', 'The archive kind is not supported.', {'field': 'archive.kind'})
    if archive.get('version') != CONFIG_ARCHIVE_VERSION:
        raise ApiError(422, 'UNSUPPORTED_ARCHIVE_VERSION', 'The archive version is not supported.', {
            'field': 'archive.version',
            'maxSupported': CONFIG_ARCHIVE_VERSION,
        })
    validate_config(archive.get('config'))
    return archive


def validate_request_id(value: Any) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ApiError(422, 'VALIDATION_FAILED', 'requestId must be a UUID.', {'field': 'requestId'}) from exc


def parse_config_write_envelope(payload: Any) -> tuple[str | None, dict[str, Any]]:
    if not isinstance(payload, dict) or payload.get('apiVersion') != API_VERSION:
        raise ApiError(428, 'PRECONDITION_REQUIRED', 'A versioned configuration write envelope is required.')
    if 'baseRevision' not in payload or 'config' not in payload:
        raise ApiError(428, 'PRECONDITION_REQUIRED', 'baseRevision and config are required.')
    base_revision = payload['baseRevision']
    if base_revision is not None and (not isinstance(base_revision, str) or not base_revision.startswith('sha256:')):
        raise ApiError(422, 'VALIDATION_FAILED', 'baseRevision is invalid.', {'field': 'baseRevision'})
    return base_revision, validate_config(payload['config'])


def parse_archive_write_envelope(payload: Any) -> tuple[str, dict[str, Any]]:
    if not isinstance(payload, dict) or payload.get('apiVersion') != API_VERSION:
        raise ApiError(428, 'PRECONDITION_REQUIRED', 'A versioned archive write envelope is required.')
    return validate_request_id(payload.get('requestId')), validate_archive(payload.get('archive'))
