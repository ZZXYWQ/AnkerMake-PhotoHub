"""Protocol tests use a temporary synthetic loopback server, never the user app."""
import base64
import hashlib
import importlib.util
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import struct
import threading
import time
import unittest

spec = importlib.util.spec_from_file_location('cdp_loader', Path(__file__).resolve().parents[1] / 'cdp_loader.py')
loader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loader)
CONFIG = {'token': '0' * 64, 'port': 19847}


class Handler(BaseHTTPRequestHandler):
    commands = []

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/json/list':
            targets = [
                None,
                {'id': 'closing', 'type': 'page', 'url': 'https://makeitreal-beta.eufymake.com/editor', 'webSocketDebuggerUrl': 'ws://127.0.0.1:1/devtools/page/closing'},
                {'id': 'editor', 'type': 'page', 'url': 'https://makeitreal-beta.eufymake.com/editor', 'webSocketDebuggerUrl': f'ws://127.0.0.1:{self.server.server_port}/devtools/page/editor'},
                {'id': 'login', 'type': 'page', 'url': 'https://makeitreal-beta.eufymake.com/loginvms', 'webSocketDebuggerUrl': f'ws://127.0.0.1:{self.server.server_port}/devtools/page/login'},
            ]
            body = json.dumps(targets).encode()
            self.send_response(200); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
            return
        if self.path != '/devtools/page/editor':
            self.send_error(404); return
        accept = base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
        self.protocol_version = 'HTTP/1.1'
        self.send_response(101); self.send_header('Upgrade', 'websocket'); self.send_header('Connection', 'Upgrade'); self.send_header('Sec-WebSocket-Accept', accept); self.end_headers()
        first, second = loader._read_exact(self.rfile, 2)
        assert first == 0x81 and second & 0x80
        length = second & 127
        if length == 126:
            length = struct.unpack('!H', loader._read_exact(self.rfile, 2))[0]
        elif length == 127:
            length = struct.unpack('!Q', loader._read_exact(self.rfile, 8))[0]
        mask = loader._read_exact(self.rfile, 4)
        payload = loader._read_exact(self.rfile, length)
        message = json.loads(bytes(x ^ mask[i % 4] for i, x in enumerate(payload)))
        self.commands.append(message)
        reply = json.dumps({'id': 1, 'result': {'result': {'type': 'boolean', 'value': True}}}).encode()
        # Fragmented text with an interleaved ping exercises bounded framing.
        midpoint = len(reply) // 2
        self.wfile.write(bytes((0x01, midpoint)) + reply[:midpoint])
        self.wfile.write(b'\x89\x01x')
        self.wfile.write(bytes((0x80, len(reply) - midpoint)) + reply[midpoint:]); self.wfile.flush()
        self.close_connection = True


class LoaderTests(unittest.TestCase):
    def test_origin_scope(self):
        for url in ('https://makeitreal-beta.eufymake.com/editor', 'https://makeitreal.ankermake.com/apps/2dEditor/?type=11'):
            self.assertTrue(loader.allowed_editor(url))
        for url in ('https://makeitreal-beta.eufymake.com/loginvms', 'https://makeitreal-beta.eufymake.com.evil.example/editor', 'https://makeitreal-beta.eufymake.com:444/editor', 'http://makeitreal-beta.eufymake.com/editor', 'file:///tmp/editor', 'https://user@makeitreal-beta.eufymake.com/editor'):
            self.assertFalse(loader.allowed_editor(url))

    def test_fixed_bootstrap_and_protocol(self):
        expression = loader.bootstrap(CONFIG)
        self.assertIn('window.__EPC_CONFIG', expression)
        self.assertNotIn('@@CONFIG@@', expression)
        for forbidden in ('document.cookie', 'localStorage', 'sessionStorage', 'fetch('):
            self.assertNotIn(forbidden, expression)
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        prior_port = loader.CDP_PORT
        loader.CDP_PORT = server.server_port
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        active = None
        try:
            self.assertTrue(loader.inject(f'ws://127.0.0.1:{server.server_port}/devtools/page/editor', expression))
            active = loader.start_loader(CONFIG)
            deadline = time.monotonic() + 4
            while active['status']['attached'] != 1 and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertEqual(active['status']['attached'], 1)
            self.assertTrue(all(x['method'] == 'Runtime.evaluate' and x['params']['expression'] == expression for x in Handler.commands))
        finally:
            if active:
                active['stop'].set(); active['thread'].join(timeout=3)
            server.shutdown(); server.server_close(); loader.CDP_PORT = prior_port

    def test_rejects_nonlocal_websocket(self):
        for url in ('ws://example.com:19849/devtools/page/x', 'ws://127.0.0.1:19850/devtools/page/x', 'ws://127.0.0.1:19849/devtools/browser/x'):
            with self.assertRaises(ValueError):
                loader.inject(url, loader.bootstrap(CONFIG))

    def test_disallows_cdp_redirects(self):
        with self.assertRaises(ValueError):
            loader.NoRedirects().redirect_request(None, None, 302, '', {}, 'https://example.com/json/list')


if __name__ == '__main__':
    unittest.main()
