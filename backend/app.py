from __future__ import annotations

import json
import logging
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from .contracts import (
    API_VERSION,
    MAX_BODY_BYTES,
    ApiError,
    parse_archive_write_envelope,
    parse_config_write_envelope,
    parse_json_bytes,
)
from .public_files import PublicFilePolicy
from .storage import BackendPaths, StorageService

LOGGER = logging.getLogger('akustikpanele.backend')


class BackendApplication:
    def __init__(self, paths: BackendPaths):
        self.paths = paths
        self.storage = StorageService(paths)
        self.public_files = PublicFilePolicy(paths.root)

    def handler_class(self) -> type[BaseHTTPRequestHandler]:
        application = self

        class Handler(BaseHTTPRequestHandler):
            server_version = 'AkustikpaneleBackend/2'

            def _request_id(self) -> str:
                existing = getattr(self, '_active_request_id', None)
                if existing:
                    return existing
                self._active_request_id = str(uuid.uuid4())
                return self._active_request_id

            def _security_headers(self) -> None:
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('X-Frame-Options', 'DENY')
                self.send_header('Referrer-Policy', 'no-referrer')
                self.send_header('X-Request-ID', self._request_id())

            def _send_bytes(
                self,
                status: int,
                raw: bytes,
                content_type: str,
                cache_control: str = 'no-store',
            ) -> None:
                self.send_response(status)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(raw)))
                self.send_header('Cache-Control', cache_control)
                self._security_headers()
                self.end_headers()
                self.wfile.write(raw)

            def _send_json(self, status: int, payload: dict[str, Any]) -> None:
                raw = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
                self._send_bytes(status, raw, 'application/json; charset=utf-8')

            def _send_api_error(self, error: ApiError) -> None:
                self._send_json(error.status, {
                    'ok': False,
                    'apiVersion': API_VERSION,
                    'error': {
                        'code': error.code,
                        'message': error.public_message,
                        'requestId': self._request_id(),
                        'details': error.details or {},
                    },
                })

            def _validate_host(self) -> None:
                raw_host = self.headers.get('Host', '')
                host = raw_host.rsplit(':', 1)[0].strip('[]').lower()
                port = raw_host.rsplit(':', 1)[1] if ':' in raw_host else ''
                expected_port = str(self.server.server_port)
                if host not in {'localhost', '127.0.0.1', '::1'} or (port and port != expected_port):
                    raise ApiError(400, 'INVALID_HOST', 'The request host is not allowed.')

            def _validate_mutation_origin(self) -> None:
                origin = self.headers.get('Origin')
                if not origin:
                    return
                parsed = urlsplit(origin)
                if parsed.scheme != 'http' or parsed.hostname not in {'localhost', '127.0.0.1', '::1'}:
                    raise ApiError(403, 'ORIGIN_NOT_ALLOWED', 'The request origin is not allowed.')
                if parsed.port != self.server.server_port:
                    raise ApiError(403, 'ORIGIN_NOT_ALLOWED', 'The request origin is not allowed.')

            def _read_json(self) -> Any:
                content_type = self.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
                if content_type != 'application/json':
                    raise ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.')
                raw_length = self.headers.get('Content-Length')
                try:
                    length = int(raw_length or '')
                except ValueError as exc:
                    raise ApiError(400, 'INVALID_REQUEST', 'Content-Length is invalid.') from exc
                if length < 0:
                    raise ApiError(400, 'INVALID_REQUEST', 'Content-Length is invalid.')
                if length > MAX_BODY_BYTES:
                    raise ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.')
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ApiError(400, 'INVALID_REQUEST', 'The request body is incomplete.')
                return parse_json_bytes(raw)

            def _handle(self, method: str) -> None:
                started = time.perf_counter()
                result_code = 'OK'
                status = 200
                try:
                    self._validate_host()
                    parsed = urlsplit(self.path)
                    request_path = parsed.path
                    if method == 'GET':
                        self._handle_get(request_path, parse_qs(parsed.query))
                    elif method == 'POST':
                        self._validate_mutation_origin()
                        self._handle_post(request_path)
                    else:
                        raise ApiError(405, 'METHOD_NOT_ALLOWED', 'The HTTP method is not allowed.')
                except ApiError as error:
                    status = error.status
                    result_code = error.code
                    self._send_api_error(error)
                except (BrokenPipeError, ConnectionResetError):
                    status = 499
                    result_code = 'CLIENT_DISCONNECTED'
                except Exception:
                    status = 500
                    result_code = 'INTERNAL_ERROR'
                    LOGGER.exception('Unhandled backend request failure', extra={'request_id': self._request_id()})
                    try:
                        self._send_api_error(ApiError(500, 'INTERNAL_ERROR', 'The request could not be completed.'))
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                finally:
                    LOGGER.info(json.dumps({
                        'requestId': self._request_id(),
                        'method': method,
                        'route': urlsplit(self.path).path,
                        'status': status,
                        'code': result_code,
                        'durationMs': round((time.perf_counter() - started) * 1000, 3),
                    }))

            def _handle_get(self, request_path: str, query: dict[str, list[str]]) -> None:
                if request_path == '/api/health':
                    self._send_json(200, {'ok': True, 'apiVersion': API_VERSION, **application.storage.health()})
                    return
                if request_path == '/api/config':
                    result = application.storage.read_config()
                    self._send_json(200, {
                        'ok': True,
                        'apiVersion': API_VERSION,
                        'revision': result.revision,
                        'config': result.config,
                    })
                    return
                if request_path == '/api/configurations':
                    try:
                        cursor = int(query.get('cursor', ['0'])[0])
                        limit = int(query.get('limit', ['100'])[0])
                    except ValueError as exc:
                        raise ApiError(400, 'INVALID_CURSOR', 'Archive pagination is invalid.') from exc
                    if cursor < 0 or not 1 <= limit <= 200:
                        raise ApiError(400, 'INVALID_CURSOR', 'Archive pagination is invalid.')
                    entries, next_cursor = application.storage.list_archives(cursor, limit)
                    self._send_json(200, {
                        'ok': True,
                        'apiVersion': API_VERSION,
                        'entries': entries,
                        'nextCursor': next_cursor,
                    })
                    return
                if request_path.startswith('/api/configurations/'):
                    filename = unquote(request_path.removeprefix('/api/configurations/'))
                    archive = application.storage.read_archive(filename)
                    self._send_json(200, archive)
                    return

                asset = application.public_files.resolve(request_path)
                if asset is None or not asset.path.is_file():
                    raise ApiError(404, 'NOT_FOUND', 'The requested resource does not exist.')
                self._send_bytes(200, asset.path.read_bytes(), asset.content_type, asset.cache_control)

            def _handle_post(self, request_path: str) -> None:
                payload = self._read_json()
                if request_path == '/api/config':
                    base_revision, config = parse_config_write_envelope(payload)
                    result = application.storage.write_config(config, base_revision)
                    self._send_json(200, {
                        'ok': True,
                        'apiVersion': API_VERSION,
                        'revision': result.revision,
                        'unchanged': result.unchanged,
                    })
                    return
                if request_path == '/api/configurations':
                    request_id, archive = parse_archive_write_envelope(payload)
                    result = application.storage.create_archive(request_id, archive)
                    self._send_json(200, {
                        'ok': True,
                        'apiVersion': API_VERSION,
                        'filename': result.filename,
                        'path': f'/api/configurations/{result.filename}',
                        'created': result.created,
                    })
                    return
                raise ApiError(404, 'NOT_FOUND', 'The requested resource does not exist.')

            def do_GET(self) -> None:  # noqa: N802
                self._handle('GET')

            def do_POST(self) -> None:  # noqa: N802
                self._handle('POST')

            def do_PUT(self) -> None:  # noqa: N802
                self._handle('PUT')

            def do_DELETE(self) -> None:  # noqa: N802
                self._handle('DELETE')

            def log_message(self, format_string: str, *args: Any) -> None:
                return

        return Handler


def create_server(host: str, port: int, root: Path) -> ThreadingHTTPServer:
    application = BackendApplication(BackendPaths.from_root(root))
    return ThreadingHTTPServer((host, port), application.handler_class())
