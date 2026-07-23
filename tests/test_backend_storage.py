from __future__ import annotations

import json
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

from backend.contracts import ApiError
from backend.storage import BackendPaths, StorageService
from tests.backend_test_support import minimal_config


class StorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.paths = BackendPaths.from_root(self.root)
        self.storage = StorageService(self.paths)
        self.initial_config = minimal_config()
        self.paths.config_path.write_text(json.dumps(self.initial_config, indent=2) + '\n', encoding='utf-8')

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_write_returns_revision_for_persisted_bytes(self) -> None:
        before = self.storage.read_config()
        updated = minimal_config(originCorner='bottom-right')
        result = self.storage.write_config(updated, before.revision)
        self.assertTrue(result.revision.startswith('sha256:'))
        self.assertEqual(self.storage.read_config().revision, result.revision)
        self.assertEqual(self.storage.read_config().config['originCorner'], 'bottom-right')

    def test_lost_response_retry_is_content_idempotent(self) -> None:
        before = self.storage.read_config()
        updated = minimal_config(originCorner='bottom-right')
        first = self.storage.write_config(updated, before.revision)
        second = self.storage.write_config(updated, before.revision)
        self.assertEqual(second.revision, first.revision)
        self.assertTrue(second.unchanged)

    def test_stale_different_write_does_not_change_file(self) -> None:
        before = self.storage.read_config()
        self.storage.write_config(minimal_config(originCorner='bottom-right'), before.revision)
        persisted_before_stale = self.paths.config_path.read_bytes()
        with self.assertRaises(ApiError) as raised:
            self.storage.write_config(minimal_config(originCorner='bottom-left'), before.revision)
        self.assertEqual(raised.exception.code, 'REVISION_CONFLICT')
        self.assertEqual(self.paths.config_path.read_bytes(), persisted_before_stale)

    def test_replace_failure_keeps_previous_config(self) -> None:
        before = self.storage.read_config()
        previous_raw = self.paths.config_path.read_bytes()
        with mock.patch('backend.storage.os.replace', side_effect=OSError('replace failed')):
            with self.assertRaises(ApiError):
                self.storage.write_config(minimal_config(originCorner='bottom-right'), before.revision)
        self.assertEqual(self.paths.config_path.read_bytes(), previous_raw)

    def test_concurrent_different_writes_have_one_winner(self) -> None:
        before = self.storage.read_config()
        configs = [
            minimal_config(originCorner='bottom-right'),
            minimal_config(originCorner='bottom-left'),
        ]

        def write(config: dict[str, object]) -> str:
            try:
                self.storage.write_config(config, before.revision)
                return 'written'
            except ApiError as error:
                return error.code

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(write, configs))
        self.assertCountEqual(outcomes, ['written', 'REVISION_CONFLICT'])
        json.loads(self.paths.config_path.read_text(encoding='utf-8'))

    def test_backup_retention_is_three(self) -> None:
        revision = self.storage.read_config().revision
        for index in range(5):
            result = self.storage.write_config(minimal_config(originCorner=f'corner-{index}'), revision)
            revision = result.revision
        self.assertEqual(len(list(self.paths.backup_dir.glob('config-*.json'))), 3)

    def test_archive_request_id_is_idempotent_and_immutable(self) -> None:
        request_id = str(uuid.uuid4())
        archive = {
            'kind': 'akustikpanele-configuration-archive',
            'version': 1,
            'savedAt': '2026-07-23T12:34:56Z',
            'displayName': 'Wohnzimmer',
            'config': minimal_config(),
        }
        first = self.storage.create_archive(request_id, archive)
        second = self.storage.create_archive(request_id, archive)
        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.filename, second.filename)
        self.assertEqual(len(list(self.paths.archive_dir.glob('*.akpconfig.json'))), 1)

        changed_archive = {**archive, 'displayName': 'Changed'}
        with self.assertRaises(ApiError) as raised:
            self.storage.create_archive(request_id, changed_archive)
        self.assertEqual(raised.exception.code, 'IDEMPOTENCY_CONFLICT')

    def test_parallel_intentional_archives_get_distinct_files(self) -> None:
        archive = {
            'kind': 'akustikpanele-configuration-archive',
            'version': 1,
            'savedAt': '2026-07-23T12:34:56Z',
            'displayName': 'Wohnzimmer',
            'config': minimal_config(),
        }
        request_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda request_id: self.storage.create_archive(request_id, archive), request_ids))
        self.assertNotEqual(results[0].filename, results[1].filename)
        self.assertEqual(len(list(self.paths.archive_dir.glob('*.akpconfig.json'))), 2)

    def test_archive_listing_is_paginated(self) -> None:
        for index in range(3):
            self.storage.create_archive(str(uuid.uuid4()), {
                'kind': 'akustikpanele-configuration-archive',
                'version': 1,
                'savedAt': f'2026-07-23T12:34:5{index}Z',
                'displayName': f'Room {index}',
                'config': minimal_config(),
            })
        first_page, next_cursor = self.storage.list_archives(0, 2)
        second_page, final_cursor = self.storage.list_archives(next_cursor or 0, 2)
        self.assertEqual(len(first_page), 2)
        self.assertEqual(len(second_page), 1)
        self.assertIsNone(final_cursor)

    def test_corrupt_config_is_reported_and_backup_restores_atomically(self) -> None:
        before = self.storage.read_config()
        self.storage.write_config(minimal_config(originCorner='bottom-right'), before.revision)
        backup = next(self.paths.backup_dir.glob('config-*.json'))
        self.paths.config_path.write_text('{broken', encoding='utf-8')
        self.assertEqual(self.storage.health()['configStatus'], 'corrupt')
        restored = self.storage.restore_backup(backup.name)
        self.assertEqual(self.storage.health()['configStatus'], 'ok')
        self.assertEqual(restored.revision, self.storage.read_config().revision)

    def test_restore_rejects_unsafe_backup_name(self) -> None:
        with self.assertRaises(ApiError) as raised:
            self.storage.restore_backup('../config.json')
        self.assertEqual(raised.exception.code, 'INVALID_BACKUP_NAME')


if __name__ == '__main__':
    unittest.main()
