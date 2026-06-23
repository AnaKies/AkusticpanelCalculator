#!/usr/bin/env python3
import json
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / 'config.json'
PORT = int(os.environ.get('PORT', '8080'))


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path in ('/', ''):
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/config.json':
            self.send_error(HTTPStatus.NOT_FOUND, 'Only /config.json accepts POST')
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
            payload = self.rfile.read(length).decode('utf-8')
            config = json.loads(payload)
            self.validate_config(config)
            CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        except Exception as exc:  # noqa: BLE001 - show useful browser-side errors for local tool
            self.send_response(HTTPStatus.BAD_REQUEST)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(exc)}, ensure_ascii=False).encode('utf-8'))
            return

        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': True}, ensure_ascii=False).encode('utf-8'))

    @staticmethod
    def validate_config(config):
        if not isinstance(config, dict):
            raise ValueError('Config must be a JSON object')
        for section in ('room', 'grid'):
            if not isinstance(config.get(section), dict):
                raise ValueError(f'Missing object: {section}')
        if float(config['room'].get('widthMeters', 0)) <= 0:
            raise ValueError('room.widthMeters must be > 0')
        if float(config['room'].get('heightMeters', 0)) <= 0:
            raise ValueError('room.heightMeters must be > 0')
        if int(config['grid'].get('rows', 0)) <= 0:
            raise ValueError('grid.rows must be > 0')
        if int(config['grid'].get('cols', 0)) <= 0:
            raise ValueError('grid.cols must be > 0')
        if float(config['grid'].get('cellMeters', 0)) <= 0:
            raise ValueError('grid.cellMeters must be > 0')


def main():
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', PORT), AppHandler)
    print(f'Frontend startet auf http://localhost:{PORT}')
    print('Zum Beenden Ctrl+C drücken.')
    server.serve_forever()


if __name__ == '__main__':
    main()
