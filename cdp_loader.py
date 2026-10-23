# AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only; other host versions unsupported.
"""Inject only the fixed local extension bootstrap into original editor pages.

Uses the host's supported loopback CDP switch. Does not read cookies, storage,
account data, DOM, or application project content, and exposes no HTTP endpoint.
"""
import base64
import hashlib
import json
import os
import re
import socket
import struct
import threading
import urllib.parse
import urllib.request

CDP_PORT = 19849
HOSTS = frozenset(('makeitreal-beta.eufymake.com', 'makeitreal.ankermake.com', 'makeitreal.eufymake.com'))
MAX_MESSAGE = 1024 * 1024


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('CDP endpoint redirects are not permitted')


def allowed_editor(url):
    try:
        parsed = urllib.parse.urlsplit(url)
        return (parsed.scheme == 'https' and parsed.hostname in HOSTS
                and parsed.port in (None, 443) and not parsed.username and not parsed.password
                and re.match(r'^/(?:editor|apps/2dEditor)(?:/|$)', parsed.path) is not None)
    except (ValueError, TypeError):
        return False


def bootstrap(config):
    if not re.fullmatch(r'[0-9a-f]{64}', config.get('token', '')) or config.get('port') != 19847:
        raise ValueError('Invalid extension configuration')
    safe = json.dumps({'token': config['token'], 'port': 19847}, separators=(',', ':'))
    domains = json.dumps(sorted(HOSTS))
    return """(()=>{const u=new URL(location.href);if(u.protocol!=='https:'||!@@DOMAINS@@.includes(u.hostname)||(u.port&&u.port!=='443')||!/^\\/(?:editor|apps\\/2dEditor)(?:\\/|$)/.test(u.pathname))return false;Object.assign(window.__EPC_CONFIG||(window.__EPC_CONFIG={}),@@CONFIG@@);if(window.__EPC_DISCOVERY)return true;const pending=window.__EPC_CDP_PENDING;if(window.__EPC_CDP_LOADING&&pending?.script?.isConnected&&Date.now()-pending.started<15000)return true;pending?.script?.remove();window.__EPC_CDP_LOADING=true;const s=document.createElement('script');window.__EPC_CDP_PENDING={script:s,started:Date.now()};s.src='http://127.0.0.1:19847/integration.js?load='+Date.now();s.onload=()=>{if(window.__EPC_CDP_PENDING?.script===s){window.__EPC_CDP_LOADING=false;delete window.__EPC_CDP_PENDING}};s.onerror=()=>{if(window.__EPC_CDP_PENDING?.script===s){window.__EPC_CDP_LOADING=false;delete window.__EPC_CDP_PENDING}s.remove()};(document.head||document.documentElement).appendChild(s);return true})()""".replace('@@DOMAINS@@', domains).replace('@@CONFIG@@', safe)


def _read_exact(stream, count):
    value = bytearray()
    while len(value) < count:
        chunk = stream.read(count - len(value))
        if not chunk:
            raise ConnectionError('CDP socket closed')
        value.extend(chunk)
    return bytes(value)


def _send(stream, opcode, payload):
    mask = os.urandom(4)
    length = len(payload)
    prefix = bytes((0x80 | opcode, 0x80 | length)) if length < 126 else (bytes((0x80 | opcode, 0xfe)) + struct.pack('!H', length) if length < 65536 else bytes((0x80 | opcode, 0xff)) + struct.pack('!Q', length))
    stream.write(prefix + mask + bytes(value ^ mask[index % 4] for index, value in enumerate(payload)))
    stream.flush()


def _receive(stream):
    fragments = bytearray()
    while True:
        first, second = _read_exact(stream, 2)
        length = second & 0x7f
        if length == 126:
            length = struct.unpack('!H', _read_exact(stream, 2))[0]
        elif length == 127:
            length = struct.unpack('!Q', _read_exact(stream, 8))[0]
        if length > MAX_MESSAGE or len(fragments) + length > MAX_MESSAGE:
            raise ValueError('CDP message exceeds bounded reply size')
        if second & 0x80:
            raise ValueError('Unexpected masked CDP server frame')
        data = _read_exact(stream, length)
        opcode = first & 0xf
        if opcode == 8:
            raise ConnectionError('CDP peer closed')
        if opcode == 9:
            _send(stream, 10, data)
            continue
        if opcode == 10:
            continue
        if opcode not in (0, 1):
            raise ValueError('Unexpected CDP message type')
        fragments.extend(data)
        if first & 0x80:
            return json.loads(fragments.decode('utf8'))


def inject(websocket_url, expression):
    parsed = urllib.parse.urlsplit(websocket_url)
    if parsed.scheme != 'ws' or parsed.hostname != '127.0.0.1' or parsed.port != CDP_PORT or parsed.username or parsed.password or not parsed.path.startswith('/devtools/page/') or parsed.query or parsed.fragment:
        raise ValueError('CDP target is not the configured loopback page endpoint')
    with socket.create_connection(('127.0.0.1', CDP_PORT), timeout=2) as sock:
        sock.settimeout(2)
        with sock.makefile('rwb') as stream:
            key = base64.b64encode(os.urandom(16)).decode('ascii')
            request = (f'GET {parsed.path} HTTP/1.1\r\nHost: 127.0.0.1:{CDP_PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode('ascii')
            stream.write(request); stream.flush()
            status = stream.readline(4096)
            if not status.startswith(b'HTTP/1.1 101 '):
                raise ConnectionError('CDP websocket upgrade rejected')
            headers = {}
            for _ in range(64):
                line = stream.readline(4096)
                if line in (b'\r\n', b'\n'):
                    break
                if not line or b':' not in line:
                    raise ValueError('Invalid CDP upgrade response')
                name, value = line.split(b':', 1)
                headers[name.strip().lower()] = value.strip()
            else:
                raise ValueError('CDP response headers exceeded bound')
            expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode('ascii')).digest())
            if headers.get(b'sec-websocket-accept') != expected:
                raise ValueError('CDP websocket handshake mismatch')
            command = {'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': expression, 'returnByValue': True, 'silent': True}}
            _send(stream, 1, json.dumps(command, separators=(',', ':')).encode('utf8'))
            for _ in range(32):
                reply = _receive(stream)
                if reply.get('id') == 1:
                    result = reply.get('result', {})
                    return 'error' not in reply and 'exceptionDetails' not in result and result.get('result', {}).get('value') is True
            return False


def start_loader(config, stop_event=None):
    """Start a daemon; repeat fixed bootstrap to recover navigation or reloads."""
    expression = bootstrap(config)
    stop_event = stop_event or threading.Event()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects())
    status = {'running': True, 'attached': 0, 'lastError': None}

    def worker():
        while not stop_event.is_set():
            try:
                with opener.open(f'http://127.0.0.1:{CDP_PORT}/json/list', timeout=2) as response:
                    payload = response.read(MAX_MESSAGE + 1)
                if len(payload) > MAX_MESSAGE:
                    raise ValueError('CDP target listing exceeds bound')
                targets = json.loads(payload)
                if not isinstance(targets, list):
                    raise ValueError('Invalid CDP target listing')
                count = 0
                for target in targets[:64]:
                    if stop_event.is_set():
                        break
                    try:
                        if isinstance(target, dict) and target.get('type') == 'page' and allowed_editor(target.get('url')):
                            if inject(target.get('webSocketDebuggerUrl', ''), expression):
                                count += 1
                    except Exception:
                        # A closing/navigation target must not block other editors.
                        continue
                status['attached'] = count
                status['lastError'] = None
            except Exception as error:
                # Deliberately retain only class, never URLs, tokens, or page content.
                status['attached'] = 0
                status['lastError'] = type(error).__name__
            stop_event.wait(2)
        status['running'] = False

    thread = threading.Thread(target=worker, name='EufyEditorBootstrap', daemon=True)
    thread.start()
    return {'thread': thread, 'stop': stop_event, 'status': status}
