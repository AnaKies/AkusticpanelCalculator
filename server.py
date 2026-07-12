from __future__ import annotations

import json
import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime
import socketserver
import unicodedata
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / 'config.json'
CONFIG_STORAGE_DIR = ROOT / 'saved-configurations'
PORT = int(os.environ.get('PORT', '8080'))
CONFIG_ARCHIVE_EXTENSION = '.akpconfig.json'
CONFIG_ARCHIVE_KIND = 'akustikpanele-configuration-archive'


class LocalThreadingHTTPServer(ThreadingHTTPServer):
    def server_bind(self) -> None:
        socketserver.TCPServer.server_bind(self)
        host, port = self.server_address[:2]
        self.server_name = str(host)
        self.server_port = int(port)


def slugify_filename(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    safe = ''.join(char.lower() if char.isalnum() else '-' for char in normalized)
    safe = '-'.join(part for part in safe.split('-') if part)
    return safe[:64] or 'konfiguration'


def ensure_storage_dir() -> None:
    CONFIG_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def build_archive_filename(display_name: str, saved_at: str) -> str:
    try:
        stamp = datetime.fromisoformat(saved_at.replace('Z', '+00:00')).strftime('%Y%m%d-%H%M%S')
    except ValueError:
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    return f'{stamp}-{slugify_filename(display_name)}{CONFIG_ARCHIVE_EXTENSION}'


def is_safe_archive_name(filename: str) -> bool:
    return filename.endswith(CONFIG_ARCHIVE_EXTENSION) and '/' not in filename and '\\' not in filename


def collect_configuration_entries() -> list[dict[str, object]]:
    ensure_storage_dir()
    entries: list[dict[str, object]] = []
    for file_path in sorted(CONFIG_STORAGE_DIR.glob(f'*{CONFIG_ARCHIVE_EXTENSION}'), reverse=True):
        try:
            payload = json.loads(file_path.read_text(encoding='utf-8'))
        except Exception:
            continue

        summary = payload.get('summary') if isinstance(payload, dict) else {}
        entries.append({
            'filename': file_path.name,
            'path': str(file_path.relative_to(ROOT)),
            'savedAt': payload.get('savedAt') if isinstance(payload, dict) else None,
            'displayName': payload.get('displayName') if isinstance(payload, dict) else file_path.stem,
            'summary': summary if isinstance(summary, dict) else {},
        })
    return entries


class AkustikpaneleHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean_path = unquote(path.split('?', 1)[0].split('#', 1)[0]).lstrip('/')
        if not clean_path:
            clean_path = 'index.html'
        return str((ROOT / clean_path).resolve())

    def do_GET(self) -> None:  # noqa: N802 - stdlib API
        request_path = self.path.split('?', 1)[0]
        if request_path == '/api/configurations':
            entries = collect_configuration_entries()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'entries': entries}, ensure_ascii=False).encode('utf-8'))
            return

        if request_path.startswith('/api/configurations/'):
            filename = unquote(request_path.removeprefix('/api/configurations/'))
            if not is_safe_archive_name(filename):
                self.send_error(400)
                return

            target = (CONFIG_STORAGE_DIR / filename).resolve()
            if CONFIG_STORAGE_DIR not in target.parents or not target.exists():
                self.send_error(404)
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(target.read_bytes())
            return

        target = Path(self.translate_path(self.path))
        if ROOT not in target.parents and target != ROOT:
            self.send_error(403)
            return
        if target.is_dir():
            target = target / 'index.html'
        if not target.exists():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', f'{content_type}; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(target.read_bytes())

    def do_POST(self) -> None:  # noqa: N802 - stdlib API
        request_path = self.path.split('?', 1)[0]
        if request_path not in {'/api/config', '/api/configurations'}:
            self.send_error(404)
            return

        length = int(self.headers.get('Content-Length', '0'))
        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode('utf-8'))
            if request_path == '/api/config':
                CONFIG_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            else:
                archive = payload.get('archive') if isinstance(payload, dict) else None
                if not isinstance(archive, dict):
                    raise ValueError('archive payload missing')
                if archive.get('kind') != CONFIG_ARCHIVE_KIND:
                    raise ValueError('unsupported archive kind')

                ensure_storage_dir()
                saved_at = str(archive.get('savedAt') or datetime.now().isoformat())
                display_name = str(archive.get('displayName') or 'Konfiguration')
                filename = build_archive_filename(display_name, saved_at)
                target = CONFIG_STORAGE_DIR / filename
                target.write_text(json.dumps(archive, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        except Exception as exc:  # pragma: no cover - defensive runtime response
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(exc)}).encode('utf-8'))
            return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        if request_path == '/api/config':
            response = {'ok': True}
        else:
            response = {
                'ok': True,
                'filename': filename,
                'path': str((CONFIG_STORAGE_DIR / filename).relative_to(ROOT)),
            }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))


if __name__ == '__main__':
    os.chdir(ROOT)
    server = LocalThreadingHTTPServer(('127.0.0.1', PORT), AkustikpaneleHandler)
    print(f'Frontend startet auf http://localhost:{PORT}')
    print('Zum Beenden Ctrl+C drücken.')
    server.serve_forever()
