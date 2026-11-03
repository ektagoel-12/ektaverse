#!/usr/bin/env python3
"""EktaVerse — tiny content server (Python standard library only).

Serves the game as static files and a small JSON "database" (data/content.json)
that the password-protected admin page (/admin.html) can edit.

    ADMIN_PASSWORD=choose-something python3 server.py        # http://localhost:8000

Environment variables:
    ADMIN_PASSWORD  password for saving content and uploading files (a random one is
                    generated and printed if unset)
    PORT            port to listen on (default 8000)
    HOST            interface to bind (default 127.0.0.1; use 0.0.0.0 when hosting)
    ANTHROPIC_API_KEY  turns on the "Ask Ekta" chat (needs `pip install anthropic`);
                    without it the chat shows an offline note with Ekta's email
"""
import hmac
import json
import os
import re
import secrets
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data", "content.json")
BACKUP = os.path.join(ROOT, "data", "content.backup.json")
UPLOADS = os.path.join(ROOT, "uploads")
PASSWORD = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(9)
MAX_JSON = 2 * 1024 * 1024
MAX_UPLOAD = 25 * 1024 * 1024
ALLOWED = {".mp3", ".m4a", ".wav", ".ogg", ".webm", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".pdf"}
HIDDEN = ("/server.py", "/chat.py", "/__pycache__", "/data/content.backup.json", "/.claude")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        if self.path.startswith("/api/") or self.path.endswith((".json", ".html", ".js", ".css")) or self.path == "/":
            self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self):
        given = self.headers.get("X-Admin-Password", "")
        return hmac.compare_digest(given.encode("utf-8"), PASSWORD.encode("utf-8"))

    def _body(self, limit):
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            return None
        return self.rfile.read(length)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/content":
            with open(DATA, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith(HIDDEN):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if urlparse(self.path).path.startswith(HIDDEN):
            self.send_error(404)
            return
        super().do_HEAD()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            time.sleep(0.4)  # slow down guessing
            return self._json(200 if self._authed() else 401, {"ok": self._authed()})
        if path == "/api/chat":
            return self._chat()
        if path != "/api/content":
            return self._json(404, {"error": "not found"})
        if not self._authed():
            time.sleep(0.4)
            return self._json(401, {"error": "wrong password"})
        raw = self._body(MAX_JSON)
        if raw is None:
            return self._json(413, {"error": "content too large"})
        try:
            data = json.loads(raw.decode("utf-8"))
        except ValueError:
            return self._json(400, {"error": "invalid JSON"})
        if not isinstance(data, dict) or not isinstance(data.get("dialogs"), dict):
            return self._json(400, {"error": "content must be an object with a 'dialogs' section"})
        if os.path.exists(DATA):
            with open(DATA, "rb") as src, open(BACKUP, "wb") as dst:
                dst.write(src.read())
        tmp = DATA + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, DATA)
        return self._json(200, {"ok": True})

    def do_PUT(self):
        url = urlparse(self.path)
        if url.path != "/api/upload":
            return self._json(404, {"error": "not found"})
        if not self._authed():
            time.sleep(0.4)
            return self._json(401, {"error": "wrong password"})
        name = (parse_qs(url.query).get("name") or [""])[0]
        base, ext = os.path.splitext(os.path.basename(name))
        ext = ext.lower()
        if ext not in ALLOWED:
            return self._json(400, {"error": "file type not allowed"})
        base = re.sub(r"[^A-Za-z0-9_-]+", "-", base).strip("-")[:60] or "file"
        raw = self._body(MAX_UPLOAD)
        if raw is None:
            return self._json(413, {"error": "file too large (25 MB max)"})
        os.makedirs(UPLOADS, exist_ok=True)
        fname = "%d-%s%s" % (int(time.time()), base, ext)
        with open(os.path.join(UPLOADS, fname), "wb") as f:
            f.write(raw)
        return self._json(200, {"url": "uploads/" + fname})

    def _chat(self):
        import chat
        raw = self._body(32 * 1024)
        if raw is None:
            return self._json(413, {"error": "too long"})
        try:
            history = json.loads(raw.decode("utf-8")).get("messages")
            with open(DATA, encoding="utf-8") as f:
                content = json.load(f)
            return self._json(200, {"reply": chat.reply(content, history, self.client_address[0])})
        except chat.Offline as e:
            sys.stderr.write("chat offline: %s\n" % e)
            return self._json(503, {"error": "offline"})
        except chat.Limited:
            return self._json(429, {"error": "slow down"})
        except (ValueError, AttributeError):
            return self._json(400, {"error": "bad request"})

    def log_message(self, fmt, *args):
        if args and "/api/" in str(args[0]):
            sys.stderr.write("%s\n" % (fmt % args))


def main():
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), Handler)
    print("EktaVerse running at http://%s:%d" % ("localhost" if host in ("127.0.0.1", "0.0.0.0") else host, port))
    print("Admin page: /admin.html")
    if not os.environ.get("ADMIN_PASSWORD"):
        print("Admin password (random, set ADMIN_PASSWORD to choose one): %s" % PASSWORD)
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
