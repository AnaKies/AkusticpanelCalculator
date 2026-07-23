from __future__ import annotations

import json
import unittest
import uuid

from backend.contracts import API_VERSION, MAX_BODY_BYTES
from tests.backend_test_support import RunningBackend, decode_json, minimal_config


class HttpIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend = RunningBackend(minimal_config())

    def tearDown(self) -> None:
        self.backend.close()

    def test_public_allowlist_and_internal_denials(self) -> None:
        for path in ('/', '/index.html', '/app.js', '/style.css', '/redesign.css', '/favicon.svg'):
            status, _, _ = self.backend.request('GET', path)
            self.assertEqual(status, 200, path)
        for path in ('/.git/config', '/AGENTS.md', '/server.py', '/config.json', '/.aider.chat.history.md'):
            status, _, _ = self.backend.request('GET', path)
            self.assertEqual(status, 404, path)

    def test_config_v2_read_write_conflict_and_retry(self) -> None:
        status, _, raw = self.backend.request('GET', '/api/config')
        self.assertEqual(status, 200)
        current = decode_json(raw)
        revision = current['revision']

        updated = minimal_config(originCorner='bottom-right')
        payload = {'apiVersion': API_VERSION, 'baseRevision': revision, 'config': updated}
        status, _, raw = self.backend.request('POST', '/api/config', payload)
        self.assertEqual(status, 200)
        saved = decode_json(raw)

        status, _, raw = self.backend.request('POST', '/api/config', payload)
        self.assertEqual(status, 200)
        self.assertTrue(decode_json(raw)['unchanged'])

        stale_payload = {
            'apiVersion': API_VERSION,
            'baseRevision': revision,
            'config': minimal_config(originCorner='bottom-left'),
        }
        status, _, raw = self.backend.request('POST', '/api/config', stale_payload)
        self.assertEqual(status, 409)
        self.assertEqual(decode_json(raw)['error']['code'], 'REVISION_CONFLICT')
        self.assertNotEqual(saved['revision'], revision)

    def test_raw_legacy_write_is_rejected(self) -> None:
        before = self.backend.root.joinpath('config.json').read_bytes()
        status, _, raw = self.backend.request('POST', '/api/config', minimal_config())
        self.assertEqual(status, 428)
        self.assertEqual(decode_json(raw)['error']['code'], 'PRECONDITION_REQUIRED')
        self.assertEqual(self.backend.root.joinpath('config.json').read_bytes(), before)

    def test_invalid_media_type_and_oversized_body_are_rejected(self) -> None:
        status, _, raw = self.backend.request(
            'POST',
            '/api/config',
            raw_body=b'{}',
            headers={'Content-Type': 'text/plain'},
        )
        self.assertEqual(status, 415)
        self.assertEqual(decode_json(raw)['error']['code'], 'UNSUPPORTED_MEDIA_TYPE')

        status, _, raw = self.backend.request(
            'POST',
            '/api/config',
            raw_body=b'',
            headers={
                'Content-Type': 'application/json',
                'Content-Length': str(MAX_BODY_BYTES + 1),
            },
        )
        self.assertEqual(status, 413)
        self.assertEqual(decode_json(raw)['error']['code'], 'PAYLOAD_TOO_LARGE')

    def test_cross_origin_and_invalid_host_are_rejected(self) -> None:
        payload = {'apiVersion': API_VERSION, 'baseRevision': None, 'config': minimal_config()}
        status, _, raw = self.backend.request(
            'POST',
            '/api/config',
            payload,
            headers={'Origin': 'https://evil.example'},
        )
        self.assertEqual(status, 403)
        self.assertEqual(decode_json(raw)['error']['code'], 'ORIGIN_NOT_ALLOWED')

        status, _, raw = self.backend.request('GET', '/api/health', headers={'Host': 'evil.example'})
        self.assertEqual(status, 400)
        self.assertEqual(decode_json(raw)['error']['code'], 'INVALID_HOST')

    def test_archive_create_replay_and_read(self) -> None:
        request_id = str(uuid.uuid4())
        archive = {
            'kind': 'akustikpanele-configuration-archive',
            'version': 1,
            'savedAt': '2026-07-23T12:34:56Z',
            'displayName': 'Wohnzimmer',
            'config': minimal_config(),
        }
        payload = {'apiVersion': API_VERSION, 'requestId': request_id, 'archive': archive}
        status, _, raw = self.backend.request('POST', '/api/configurations', payload)
        self.assertEqual(status, 200)
        first = decode_json(raw)
        self.assertTrue(first['created'])

        status, _, raw = self.backend.request('POST', '/api/configurations', payload)
        self.assertEqual(status, 200)
        self.assertFalse(decode_json(raw)['created'])

        status, _, raw = self.backend.request('GET', first['path'])
        self.assertEqual(status, 200)
        self.assertEqual(decode_json(raw)['kind'], archive['kind'])

    def test_health_and_security_headers(self) -> None:
        status, headers, raw = self.backend.request('GET', '/api/health')
        self.assertEqual(status, 200)
        health = decode_json(raw)
        self.assertEqual(health['configStatus'], 'ok')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(headers['X-Frame-Options'], 'DENY')
        self.assertIn('X-Request-ID', headers)

    def test_health_reports_corrupt_config_without_exposing_paths(self) -> None:
        self.backend.root.joinpath('config.json').write_text('{broken', encoding='utf-8')
        status, _, raw = self.backend.request('GET', '/api/health')
        self.assertEqual(status, 200)
        health = decode_json(raw)
        self.assertEqual(health['configStatus'], 'corrupt')
        self.assertNotIn(str(self.backend.root), raw.decode('utf-8'))

    def test_structured_logs_do_not_contain_payload_values(self) -> None:
        secret = 'SECRET-PAYLOAD-MUST-NOT-BE-LOGGED'
        status, _, raw = self.backend.request('GET', '/api/config')
        self.assertEqual(status, 200)
        revision = decode_json(raw)['revision']
        payload = {
            'apiVersion': API_VERSION,
            'baseRevision': revision,
            'config': minimal_config(privateMarker=secret),
        }
        with self.assertLogs('akustikpanele.backend', level='INFO') as captured:
            status, _, _ = self.backend.request('POST', '/api/config', payload)
        self.assertEqual(status, 200)
        self.assertNotIn(secret, '\n'.join(captured.output))

    def test_archive_list_pagination_and_unsafe_read(self) -> None:
        for index in range(3):
            payload = {
                'apiVersion': API_VERSION,
                'requestId': str(uuid.uuid4()),
                'archive': {
                    'kind': 'akustikpanele-configuration-archive',
                    'version': 1,
                    'savedAt': f'2026-07-23T12:34:5{index}Z',
                    'displayName': f'Room {index}',
                    'config': minimal_config(),
                },
            }
            self.assertEqual(self.backend.request('POST', '/api/configurations', payload)[0], 200)
        status, _, raw = self.backend.request('GET', '/api/configurations?limit=2')
        self.assertEqual(status, 200)
        first_page = decode_json(raw)
        self.assertEqual(len(first_page['entries']), 2)
        self.assertIsNotNone(first_page['nextCursor'])
        status, _, raw = self.backend.request(
            'GET',
            f"/api/configurations?limit=2&cursor={first_page['nextCursor']}",
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(decode_json(raw)['entries']), 1)

        status, _, raw = self.backend.request('GET', '/api/configurations/..%2Fconfig.json')
        self.assertEqual(status, 400)
        self.assertEqual(decode_json(raw)['error']['code'], 'INVALID_ARCHIVE_NAME')


if __name__ == '__main__':
    unittest.main()
