from __future__ import annotations

import logging
import os
from pathlib import Path

from backend.app import create_server

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get('PORT', '8080'))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    server = create_server('127.0.0.1', PORT, ROOT)
    print(f'Frontend startet auf http://localhost:{server.server_port}')
    print('Zum Beenden Ctrl+C drücken.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
