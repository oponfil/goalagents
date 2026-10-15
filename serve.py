"""Local dev server for the prototype: static files with caching off, so a plain reload
always picks up edited scripts. PUT /docs/img/<name>.png saves a picture rendered by
tools/render-docs.html (used to refresh the README images)."""
import http.server
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
IMG = ROOT / "docs" / "img"


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_PUT(self):
        m = re.fullmatch(r"/docs/img/([a-z0-9-]+\.png)", self.path)
        if not m:
            self.send_error(403)
            return
        IMG.mkdir(parents=True, exist_ok=True)
        (IMG / m.group(1)).write_bytes(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(204)
        self.end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()
