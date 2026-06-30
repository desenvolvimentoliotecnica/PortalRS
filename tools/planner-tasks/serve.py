#!/usr/bin/env python3
"""Servidor local com MIME correto para .mjs (python -m http.server serve .mjs como text/plain)."""
import mimetypes
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/json', '.json')


class PlannerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.rstrip('/').endswith('tasks.json'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        base, ext = __import__('os').path.splitext(path)
        if ext.lower() == '.mjs':
            return 'application/javascript'
        return super().guess_type(path)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8877
    server = HTTPServer(('', port), PlannerHandler)
    print(f'Export Planner em http://localhost:{port}/index.html', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
