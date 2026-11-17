import os
import json
from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path

SAVE_DIR = Path('saves')
SAVE_DIR.mkdir(exist_ok=True)

SLOT_MAX  = 3
SLOT_NAME = 'slot_{}.ghsave'
MAX_BODY  = 10 * 1024 * 1024  # 10 MB cap


class GameHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass

    # ---------- Routes ----------
    def do_GET(self):
        if self.path in ('/saves', '/saves/'):
            return self._handle_list_saves()
        if self.path.startswith('/saves/'):
            return self._handle_get_save()
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/saves/'):
            return self._handle_post_save()
        self.send_error(404)

    def do_DELETE(self):
        if self.path.startswith('/saves/'):
            return self._handle_delete_save()
        self.send_error(404)

    # ---------- Save handlers ----------
    def _parse_slot(self):
        try:
            part = self.path.rstrip('/').split('/')[-1]
            if part.endswith('.ghsave'):
                part = part[:-7]
            idx = int(part)
        except (ValueError, IndexError):
            return None
        if idx < 0 or idx >= SLOT_MAX:
            return None
        return idx

    def _send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_list_saves(self):
        result = []
        for i in range(SLOT_MAX):
            fp = SAVE_DIR / SLOT_NAME.format(i)
            if fp.exists():
                st = fp.stat()
                result.append({
                    'slotId': i,
                    'size':   st.st_size,
                    'mtime':  int(st.st_mtime * 1000),
                })
            else:
                result.append({'slotId': i, 'size': 0, 'mtime': 0})
        self._send_json(result)

    def _handle_get_save(self):
        idx = self._parse_slot()
        if idx is None:
            return self.send_error(400, 'Invalid slot')
        fp = SAVE_DIR / SLOT_NAME.format(idx)
        if not fp.exists():
            return self.send_error(404, 'Slot empty')
        data = fp.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle_post_save(self):
        idx = self._parse_slot()
        if idx is None:
            return self.send_error(400, 'Invalid slot')
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > MAX_BODY:
            return self.send_error(413, 'Bad body size')
        data = self.rfile.read(length)
        fp  = SAVE_DIR / SLOT_NAME.format(idx)
        tmp = fp.with_suffix('.ghsave.tmp')
        # Atomic write — process killed mid-save won't corrupt the slot
        tmp.write_bytes(data)
        os.replace(tmp, fp)
        self.send_response(200)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def _handle_delete_save(self):
        idx = self._parse_slot()
        if idx is None:
            return self.send_error(400, 'Invalid slot')
        fp = SAVE_DIR / SLOT_NAME.format(idx)
        if fp.exists():
            fp.unlink()
        self.send_response(200)
        self.send_header('Content-Length', '0')
        self.end_headers()


if __name__ == '__main__':
    port = 7676
    print(f'Serving at http://127.0.0.1:{port}')
    HTTPServer(('127.0.0.1', port), GameHandler).serve_forever()
