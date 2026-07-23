from __future__ import annotations

import json
import unittest
import uuid
from pathlib import Path

from backend.contracts import (
    API_VERSION,
    ApiError,
    MAX_BODY_BYTES,
    parse_archive_write_envelope,
    parse_config_write_envelope,
    parse_json_bytes,
    validate_config,
)
from tests.backend_test_support import minimal_config


class ContractTests(unittest.TestCase):
    def test_current_project_config_is_compatible(self) -> None:
        project_config = json.loads((Path(__file__).resolve().parents[1] / 'config.json').read_text(encoding='utf-8'))
        self.assertIs(validate_config(project_config), project_config)

    def test_missing_legacy_schema_version_is_accepted(self) -> None:
        config = minimal_config()
        config.pop('schemaVersion')
        self.assertIs(validate_config(config), config)

    def test_unsupported_schema_version_is_rejected(self) -> None:
        with self.assertRaises(ApiError) as raised:
            validate_config(minimal_config(schemaVersion=10))
        self.assertEqual(raised.exception.code, 'UNSUPPORTED_SCHEMA_VERSION')

    def test_non_finite_json_is_rejected(self) -> None:
        with self.assertRaises(ApiError) as raised:
            parse_json_bytes(b'{"value": NaN}')
        self.assertEqual(raised.exception.code, 'INVALID_JSON')

    def test_excessive_nesting_is_rejected(self) -> None:
        value: object = 'end'
        for _ in range(40):
            value = {'next': value}
        with self.assertRaises(ApiError) as raised:
            validate_config({'schemaVersion': 9, 'extra': value})
        self.assertEqual(raised.exception.code, 'VALIDATION_FAILED')

    def test_config_write_requires_v2_precondition_envelope(self) -> None:
        with self.assertRaises(ApiError) as raised:
            parse_config_write_envelope(minimal_config())
        self.assertEqual(raised.exception.status, 428)

    def test_archive_envelope_keeps_archive_version_one(self) -> None:
        request_id = str(uuid.uuid4())
        archive = {
            'kind': 'akustikpanele-configuration-archive',
            'version': 1,
            'config': minimal_config(),
        }
        parsed_request_id, parsed_archive = parse_archive_write_envelope({
            'apiVersion': API_VERSION,
            'requestId': request_id,
            'archive': archive,
        })
        self.assertEqual(parsed_request_id, request_id)
        self.assertEqual(parsed_archive, archive)

    def test_body_limit_matches_plan(self) -> None:
        self.assertEqual(MAX_BODY_BYTES, 2 * 1024 * 1024)


if __name__ == '__main__':
    unittest.main()
