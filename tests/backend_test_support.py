from __future__ import annotations

import http.client
import json
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Any

from backend.app import create_server

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ASSETS = ('index.html', 'app.js', 'style.css', 'redesign.css', 'favicon.svg')


def minimal_config(**overrides: Any) -> dict[str, Any]:
    config: dict[str, Any] = {
        'schemaVersion': 9,
        'room': {'widthMeters': 5, 'heightMeters': 3},
        'grid': {
            'panelWidthMeters': 0.6,
            'panelHeightMeters': 0.6,
            'alignmentX': 'center',
            'alignmentY': 'center',
        },
        'originCorner': 'top-left',
        'obstacles': [],
        'combinedPanels': [],
        'measurementCollections': [],
        'measurements': [],
        'measureFlags': {},
        'labelCallouts': {},
        'workspaceTabs': [],
    }
    config.update(overrides)
    return config


class RunningBackend:
    def __init__(self, initial_config: dict[str, Any] | None = None):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        for asset in PUBLIC_ASSETS:
            shutil.copy2(PROJECT_ROOT / asset, self.root / asset)
        (self.root / 'saved-configurations').mkdir()
        if initial_config is not None:
            (self.root / 'config.json').write_text(
                json.dumps(initial_config, indent=2, ensure_ascii=False) + '\n',
                encoding='utf-8',
            )
        self.server = create_server('127.0.0.1', 0, self.root)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def port(self) -> int:
        return self.server.server_port

    def request(
        self,
        method: str,
        path: str,
        payload: Any = None,
        headers: dict[str, str] | None = None,
        raw_body: bytes | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        body = raw_body
        request_headers = dict(headers or {})
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            request_headers.setdefault('Content-Type', 'application/json')
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        try:
            connection.request(method, path, body=body, headers=request_headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        self.temporary_directory.cleanup()

    def __enter__(self) -> 'RunningBackend':
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()


def decode_json(raw: bytes) -> dict[str, Any]:
    return json.loads(raw.decode('utf-8'))
