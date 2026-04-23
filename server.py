#!/usr/bin/env python3

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os


CONFIG_FILE = "config.json"


class ConfigHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/config.json":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)

        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

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


def main():
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("127.0.0.1", port), ConfigHandler)
    print(f"Frontend startet auf http://localhost:{port}")
    print("Zum Beenden Ctrl+C drücken.")
    server.serve_forever()


if __name__ == "__main__":
    main()
