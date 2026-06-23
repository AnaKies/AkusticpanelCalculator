#!/usr/bin/env python3

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import sys

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"
MAX_CONFIG_BYTES = 100_000


def _is_positive_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def _is_non_negative_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0


def validate_config(data):
    """Validate the persisted v2 frontend configuration.

    The browser can still migrate old v1 configs when loading them, but every new
    save should use the explicit v2 model:
    centerX / anchorY / edgeDistanceY / widthMeters / heightMeters.
    """
    if not isinstance(data, dict):
        raise ValueError("Configuration must be a JSON object")

    if data.get("schemaVersion") != 2:
        raise ValueError("schemaVersion must be 2")

    room = data.get("room")
    if not isinstance(room, dict):
        raise ValueError("room must be an object")

    if not _is_positive_number(room.get("widthMeters")):
        raise ValueError("room.widthMeters must be a positive number")

    if not _is_positive_number(room.get("heightMeters")):
        raise ValueError("room.heightMeters must be a positive number")

    grid = data.get("grid")
    if not isinstance(grid, dict):
        raise ValueError("grid must be an object")

    if not isinstance(grid.get("rows"), int) or grid["rows"] <= 0:
        raise ValueError("grid.rows must be a positive integer")

    if not isinstance(grid.get("cols"), int) or grid["cols"] <= 0:
        raise ValueError("grid.cols must be a positive integer")

    if not _is_positive_number(grid.get("cellMeters")):
        raise ValueError("grid.cellMeters must be a positive number")

    if grid.get("alignmentX") not in {"left", "center", "right"}:
        raise ValueError("grid.alignmentX must be 'left', 'center' or 'right'")

    if grid.get("alignmentY") not in {"top", "center", "bottom"}:
        raise ValueError("grid.alignmentY must be 'top', 'center' or 'bottom'")

    lamps = data.get("lamps")
    if not isinstance(lamps, list):
        raise ValueError("lamps must be an array")

    seen_ids = set()
    for index, lamp in enumerate(lamps):
        if not isinstance(lamp, dict):
            raise ValueError(f"lamps[{index}] must be an object")

        lamp_id = lamp.get("id")
        if not isinstance(lamp_id, str) or not lamp_id.strip():
            raise ValueError(f"lamps[{index}].id must be a non-empty string")

        if lamp_id in seen_ids:
            raise ValueError(f"Duplicate lamp id: {lamp_id}")
        seen_ids.add(lamp_id)

        if not _is_non_negative_number(lamp.get("centerX")):
            raise ValueError(f"{lamp_id}.centerX must be a non-negative number")

        if lamp.get("anchorY") not in {"top", "bottom"}:
            raise ValueError(f"{lamp_id}.anchorY must be 'top' or 'bottom'")

        if not _is_non_negative_number(lamp.get("edgeDistanceY")):
            raise ValueError(f"{lamp_id}.edgeDistanceY must be a non-negative number")

        if not _is_positive_number(lamp.get("widthMeters")):
            raise ValueError(f"{lamp_id}.widthMeters must be a positive number")

        if not _is_positive_number(lamp.get("heightMeters")):
            raise ValueError(f"{lamp_id}.heightMeters must be a positive number")

    measure_flags = data.get("measureFlags", {})
    if not isinstance(measure_flags, dict):
        raise ValueError("measureFlags must be an object")

    for key, value in measure_flags.items():
        if not isinstance(key, str):
            raise ValueError("measureFlags keys must be strings")

        if not isinstance(value, dict):
            raise ValueError(f"measureFlags.{key} must be an object")

        if not isinstance(value.get("left"), (int, float)) or isinstance(value.get("left"), bool):
            raise ValueError(f"measureFlags.{key}.left must be a number")

        if not isinstance(value.get("top"), (int, float)) or isinstance(value.get("top"), bool):
            raise ValueError(f"measureFlags.{key}.top must be a number")


class ConfigHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        # CORS Header hinzufügen, falls man von einer anderen Domain testet.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/config.json":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_CONFIG_BYTES:
            self.send_error(413, "Configuration is too large")
            return

        raw_body = self.rfile.read(length)

        try:
            data = json.loads(raw_body)
            validate_config(data)
            print(f"Speichere neue Konfiguration in {CONFIG_FILE}...")
        except json.JSONDecodeError:
            print("Fehler: Ungültiges JSON empfangen")
            self.send_error(400, "Invalid JSON")
            return
        except ValueError as error:
            print(f"Fehler: Ungültige Konfiguration: {error}")
            self.send_error(400, str(error))
            return

        try:
            tmp_file = CONFIG_FILE.with_suffix(".json.tmp")
            with tmp_file.open("w", encoding="utf-8") as file:
                json.dump(data, file, ensure_ascii=False, indent=2)
                file.write("\n")
            os.replace(tmp_file, CONFIG_FILE)

            response = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            print("Konfiguration erfolgreich gespeichert.")
        except Exception as error:
            print(f"Fehler beim Schreiben der Datei: {error}")
            self.send_error(500, str(error))


def main():
    port = int(os.environ.get("PORT", "8080"))
    server_address = ("", port)
    server = ThreadingHTTPServer(server_address, ConfigHandler)
    print(f"Server läuft auf http://localhost:{port}")
    print(f"Projekt-Pfad: {BASE_DIR}")
    print(f"Speicher-Pfad: {CONFIG_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer wird beendet.")
        sys.exit(0)


if __name__ == "__main__":
    main()
