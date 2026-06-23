from __future__ import annotations

import json
import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import socketserver
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / 'config.json'
PORT = int(os.environ.get('PORT', '8080'))


class LocalThreadingHTTPServer(ThreadingHTTPServer):
    def server_bind(self) -> None:
        socketserver.TCPServer.server_bind(self)
        host, port = self.server_address[:2]
        self.server_name = str(host)
        self.server_port = int(port)


class AkustikpaneleHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean_path = unquote(path.split('?', 1)[0].split('#', 1)[0]).lstrip('/')
        if not clean_path:
            clean_path = 'index.html'
        return str((ROOT / clean_path).resolve())

    def do_GET(self) -> None:  # noqa: N802 - stdlib API
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
        if self.path.split('?', 1)[0] != '/api/config':
            self.send_error(404)
            return

        length = int(self.headers.get('Content-Length', '0'))
        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode('utf-8'))
            CONFIG_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        except Exception as exc:  # pragma: no cover - defensive runtime response
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(exc)}).encode('utf-8'))
            return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': True}).encode('utf-8'))


if __name__ == '__main__':
    os.chdir(ROOT)
    server = LocalThreadingHTTPServer(('127.0.0.1', PORT), AkustikpaneleHandler)
    print(f'Frontend startet auf http://localhost:{PORT}')
    print('Zum Beenden Ctrl+C drücken.')
    server.serve_forever()
