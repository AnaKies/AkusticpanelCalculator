from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class PublicAsset:
    path: Path
    content_type: str
    cache_control: str


class PublicFilePolicy:
    _ASSETS = {
        '/index.html': ('index.html', 'text/html; charset=utf-8', 'no-store'),
        '/app.js': ('app.js', 'text/javascript; charset=utf-8', 'private, max-age=300'),
        '/style.css': ('style.css', 'text/css; charset=utf-8', 'private, max-age=300'),
        '/redesign.css': ('redesign.css', 'text/css; charset=utf-8', 'private, max-age=300'),
        '/favicon.svg': ('favicon.svg', 'image/svg+xml; charset=utf-8', 'private, max-age=300'),
    }

    def __init__(self, root: Path):
        self.root = root.resolve()

    def resolve(self, request_path: str) -> PublicAsset | None:
        normalized = '/index.html' if request_path == '/' else request_path
        definition = self._ASSETS.get(normalized)
        if definition is None:
            return None
        filename, content_type, cache_control = definition
        return PublicAsset(self.root / filename, content_type, cache_control)
