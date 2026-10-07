#!/usr/bin/env python3
"""Serve only the prepared release directory for local Wi-Fi downloads."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'releases'

class Downloads(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.apk': 'application/vnd.android.package-archive'}

    def list_directory(self, path):
        self.send_error(403, 'Open the download page instead')
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if self.path.split('?')[0].endswith('.apk'):
            name = Path(self.path.split('?')[0]).name
            self.send_header('Content-Disposition', f'attachment; filename="{name}"')
        super().end_headers()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8788)
    parser.add_argument('--bind', default='0.0.0.0')
    args = parser.parse_args()
    if not (ROOT / 'index.html').is_file():
        raise SystemExit('Build the Android release before starting downloads')
    handler = partial(Downloads, directory=str(ROOT))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f'Download server listening on {args.bind}:{args.port}; files in releases/ only', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
