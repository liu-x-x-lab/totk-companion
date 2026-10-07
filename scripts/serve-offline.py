#!/usr/bin/env python3
"""Serve an extracted offline web bundle on this computer, without external resources."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

directory = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
print("海拉鲁离线手册：http://127.0.0.1:4178/\n按 Ctrl+C 退出。", flush=True)
try:
    ThreadingHTTPServer(("127.0.0.1", 4178), handler).serve_forever()
except KeyboardInterrupt:
    pass
