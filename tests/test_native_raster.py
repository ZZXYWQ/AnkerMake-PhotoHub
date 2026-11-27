"""Synthetic protocol regression: a failed importer patch must resume the page."""
import base64
import hashlib
import json
import struct
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import native_raster as native
from cdp_loader import _read_exact


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def frame(self, message):
        raw = json.dumps(message).encode()
        head = bytes((0x81, len(raw))) if len(raw) < 126 else b'\x81\x7e' + struct.pack('!H', len(raw))
        self.wfile.write(head + raw)
        self.wfile.flush()

    def do_GET(self):
        self.protocol_version = 'HTTP/1.1'
        accept = base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
        self.send_response(101)
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', accept)
        self.end_headers()
        try:
            while True:
                first, second = _read_exact(self.rfile, 2)
                length = second & 127
                if length == 126:
                    length = struct.unpack('!H', _read_exact(self.rfile, 2))[0]
                elif length == 127:
                    length = struct.unpack('!Q', _read_exact(self.rfile, 8))[0]
                mask = _read_exact(self.rfile, 4)
                raw = _read_exact(self.rfile, length)
                message = json.loads(bytes(v ^ mask[i % 4] for i, v in enumerate(raw)))
                method, params = message['method'], message['params']
                self.server.commands.append(method)
                result = {}
                if method == 'Runtime.evaluate':
                    result = {'result': {'type': 'function', 'objectId': 'pure'}} if params.get('awaitPromise') else {'result': {'value': {'loaded': True, 'ready': False}}}
                elif method == 'Debugger.enable':
                    self.frame({'method': 'Debugger.scriptParsed', 'params': {'url': 'https://fixture.invalid/editor/assets/' + native.PROFILE['name'], 'scriptId': 'source'}})
                elif method == 'Debugger.getScriptSource':
                    result = {'scriptSource': 'synthetic source, never executed'}
                elif method == 'Debugger.setBreakpointOnFunctionCall':
                    result = {'breakpointId': 'owned-breakpoint'}
                elif method == 'Runtime.callFunctionOn':
                    self.frame({'method': 'Debugger.paused', 'params': {'callFrames': [{'functionName': 'gUe', 'callFrameId': 'owned-frame'}]}})
                elif method == 'Debugger.evaluateOnCallFrame':
                    result = {'exceptionDetails': {'text': 'synthetic failure'}} if self.server.fail_patch else {'result': {'value': True}}
                self.frame({'id': message['id'], 'result': result})
        except (ConnectionError, OSError):
            pass
        self.close_connection = True


class NativeRasterTests(unittest.TestCase):
    def test_rejects_unverified_source(self):
        with self.assertRaises(ValueError):
            native.patch_expression(b'unknown editor')

    def test_rejects_nonlocal_target(self):
        with self.assertRaises(ValueError):
            native.patch_native_import('ws://example.com:19849/devtools/page/a')

    def test_success_and_failure_remove_breakpoint_and_resume(self):
        for fail in (False, True):
            with self.subTest(fail=fail):
                server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
                server.commands, server.fail_patch = [], fail
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                try:
                    with patch.object(native, 'CDP_PORT', server.server_port), patch.object(native, 'patch_expression', return_value='synthetic patch'):
                        url = f'ws://127.0.0.1:{server.server_port}/devtools/page/editor'
                        if fail:
                            with self.assertRaises(ValueError):
                                native.patch_native_import(url)
                        else:
                            self.assertEqual(native.patch_native_import(url), 'ready')
                    self.assertEqual(server.commands[-3:], ['Debugger.removeBreakpoint', 'Debugger.resume', 'Debugger.disable'])
                    self.assertNotIn('Page.reload', server.commands)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join(2)


if __name__ == '__main__':
    unittest.main()
