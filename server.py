#!/usr/bin/env python3

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import sys

CONFIG_FILE = "config.json"

class ConfigHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS Header hinzufügen, falls man von einer anderen Domain testet
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == "/config.json":
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)

            try:
                data = json.loads(raw_body)
                print(f"Speichere neue Konfiguration in {CONFIG_FILE}...")
            except json.JSONDecodeError:
                print("Fehler: Ungültiges JSON empfangen")
                self.send_error(400, "Invalid JSON")
                return

            try:
                tmp_file = f"{CONFIG_FILE}.tmp"
                with open(tmp_file, "w", encoding="utf-8") as file:
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
            except Exception as e:
                print(f"Fehler beim Schreiben der Datei: {e}")
                self.send_error(500, str(e))
        else:
            self.send_error(404)

def main():
    port = int(os.environ.get("PORT", "8080"))
    # Auf 0.0.0.0 binden, um besser erreichbar zu sein
    server_address = ('', port)
    server = ThreadingHTTPServer(server_address, ConfigHandler)
    print(f"Server läuft auf http://localhost:{port}")
    print(f"Speicher-Pfad: {os.path.abspath(CONFIG_FILE)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer wird beendet.")
        sys.exit(0)

if __name__ == "__main__":
    main()
