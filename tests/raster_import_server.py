"""Isolated browser regression fixture; no host/printer service is started."""
import json
import mimetypes
import os
from pathlib import Path
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bridge

bridge.DATA = Path(os.environ['PH_TEST_DATA_ROOT'])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == '/fixture' and os.environ.get('PH_TEST_IMAGE'):
            source = Path(os.environ['PH_TEST_IMAGE'])
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(source.name)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(source.stat().st_size))
            self.end_headers()
            with source.open('rb') as stream:
                while chunk := stream.read(1024 * 1024):
                    self.wfile.write(chunk)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(b'<input type="file">')

    def do_POST(self):
        try:
            length = int(self.headers['Content-Length'])
            if not 0 < length <= bridge.MAX_BODY:
                raise ValueError('Invalid body size')
            data = bridge.prepare_raster(json.loads(self.rfile.read(length)))
            encoded = json.dumps(data).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
        except Exception as error:
            self.send_error(400, str(error))


server = HTTPServer(('127.0.0.1', 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
