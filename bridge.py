# AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only; other host versions unsupported.
"""Local, token-authenticated PhotoCraft bridge. No account/printer APIs."""
import argparse
import base64
import hmac
import io
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
import threading
import time
import uuid
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image
from standalone.photocraft_control import PhotoCraft
from cdp_loader import start_loader
from ink_control import InkController

BASE = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
DATA = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'EufyPhotoCraftBridge'
SESSIONS = {}
LOCK = threading.Lock()
MAX_BODY = 512 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = None  # User requested no original 30k/163.84MP import gate.


def read_png(raw):
    with Image.open(io.BytesIO(raw)) as im:
        if im.format != 'PNG':
            raise ValueError('需要 PNG 图像')
        size = im.size
        # Reject corrupt input without converting or downsampling it.
        im.verify()
        return size


def new_session(body, headless=False):
    if body.get('mode') not in ('new', 'edit'):
        raise ValueError('无效的编辑模式')
    ident = uuid.uuid4().hex
    workspace = DATA / 'projects' / ident
    meta = body.get('metadata', {})
    if body.get('mode') == 'edit':
        url = body.get('dataUrl', '')
        if not isinstance(url, str) or not url.startswith('data:image/png;base64,'):
            raise ValueError('编辑输入必须是 PNG')
        raw = base64.b64decode(url.split(',', 1)[1], validate=True)
        width, height = read_png(raw)
        if width * height * 4 > 2 * 1024**3:
            raise ValueError('解码内存超过第一版 2 GiB 保护值；未缩小图片')
    else:
        width, height = int(body.get('width', 2000)), int(body.get('height', 2000))
        if width < 1 or height < 1 or width * height * 4 > 2 * 1024**3:
            raise ValueError('画布为空或解码内存超过第一版 2 GiB 保护值；未缩小图片')
    runtime = BASE / 'standalone/runtime/photocraft-0.9.0-windows-x64-portable'
    workspace.mkdir(parents=True, exist_ok=False)
    if body['mode'] == 'edit':
        (workspace / 'input.png').write_bytes(raw)
    app = PhotoCraft(workspace, runtime=runtime, headless=headless)
    try:
        app.start()
        if body.get('mode') == 'edit':
            app.open('input.png')
        else:
            app.create(width, height)
        app.save('working.psd')
    except Exception:
        try:
            app.close()
        except Exception:
            pass
        raise
    record = {'id': ident, 'workspace': str(workspace), 'mode': body.get('mode', 'new'),
              'width': width, 'height': height, 'metadata': meta, 'created': time.time()}
    (workspace / 'session.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf8')
    with LOCK:
        SESSIONS[ident] = {'app': app, 'record': record, 'lock': threading.Lock()}
    return record


def export_session(ident):
    with LOCK:
        session = SESSIONS.get(ident)
    if not session:
        raise ValueError('会话已失效，请重新打开图片；已有作品仍在本机保留')
    with session['lock']:
        app = session['app']
        if app.process.poll() is not None:
            raise ValueError('PhotoCraft 窗口已关闭，请先重新建立编辑会话')
        # Keep a layered revision before saving the print composite.
        revision = uuid.uuid4().hex[:12]
        app.save(f'revision-{revision}.psd')
        name = f'print-{revision}.png'
        app.export_png(name)
        raw = (app.workspace / name).read_bytes()
        width, height = read_png(raw)
        return {'id': ident, 'width': width, 'height': height,
                'dataUrl': 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii'),
                'savedProject': str(app.workspace / f'revision-{revision}.psd')}


class LocalServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR otherwise permits duplicate listeners on one port.
    allow_reuse_address = False


class Handler(BaseHTTPRequestHandler):
    server_version = 'EufyPhotoCraftBridge/0.3.0'

    def log_message(self, *_):
        pass

    def send_json(self, code, result):
        raw = json.dumps(result, ensure_ascii=False).encode('utf8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-EPC-Token')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def authorized(self):
        host = self.headers.get('Host', '')
        valid_host = host in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}')
        return valid_host and hmac.compare_digest(self.headers.get('X-EPC-Token', ''), self.server.token)

    def do_GET(self):
        public_path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if public_path in ('/integration.js', '/adapter.js', '/embedded-ui.js', '/contours.js', '/contour-host.js', '/large-image-import.js', '/context-menu.js', '/native-ui.js', '/raster-tools.js', '/canvas-contours.js', '/ink-control.js', '/ink-layer.js') or public_path.startswith('/editor/'):
            if self.headers.get('Host') not in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'):
                return self.send_json(403, {'error': 'Invalid local host'})
            root = (BASE if getattr(sys, 'frozen', False) else BASE / 'payload').resolve()
            target = (root / public_path.lstrip('/')).resolve()
            if public_path.endswith('/'):
                target = target / 'index.html'
            if not target.is_relative_to(root) or not target.is_file():
                return self.send_json(404, {'error': 'Resource not found'})
            mime = 'application/wasm' if target.suffix == '.wasm' else mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
            if target.suffix in ('.js', '.html', '.css'):
                mime += '; charset=utf-8'
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(target.stat().st_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            with target.open('rb') as source:
                while chunk := source.read(1024 * 1024):
                    self.wfile.write(chunk)
            return
        if not self.authorized():
            return self.send_json(403, {'error': '本机扩展身份验证失败'})
        if self.path == '/health':
            return self.send_json(200, {'version': '0.6.1', 'ready': True, 'online': getattr(self.server, 'loader', {}).get('status')})
        if self.path == '/ink/status':
            try:
                return self.send_json(200, self.server.ink.status())
            except Exception as exc:
                return self.send_json(409, {'error': str(exc)})
        self.send_json(404, {'error': '不存在的接口'})

    def do_POST(self):
        if not self.authorized():
            return self.send_json(403, {'error': '本机扩展身份验证失败'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY:
                return self.send_json(413, {'error': '请求超过本机桥接内存上限；没有缩小图片'})
            body = json.loads(self.rfile.read(length))
            if self.path == '/ink/mask':
                if 'mask' not in body:
                    raise ValueError('缺少墨路选择')
                return self.send_json(200, self.server.ink.status(body['mask']))
            if self.path == '/ink/policy/arm':
                if 'enabled' not in body:
                    raise ValueError('缺少逐图层墨路状态')
                return self.send_json(200, self.server.ink.status(policy=body['enabled']))
            if self.path == '/artifacts':
                url = body.get('dataUrl', '')
                if not isinstance(url, str) or not url.startswith('data:image/png;base64,'):
                    raise ValueError('需要 PNG 数据')
                raw = base64.b64decode(url.split(',', 1)[1], validate=True)
                width, height = read_png(raw)
                folder = DATA / 'exports'
                folder.mkdir(parents=True, exist_ok=True)
                output = folder / (uuid.uuid4().hex + '.png')
                output.write_bytes(raw)
                return self.send_json(200, {'savedImage': str(output), 'width': width, 'height': height})
            if self.path == '/diagnostics':
                DATA.mkdir(parents=True, exist_ok=True)
                with (DATA / 'integration-diagnostics.jsonl').open('a', encoding='utf8') as output:
                    output.write(json.dumps(body, ensure_ascii=False) + '\n')
                return self.send_json(200, {'ok': True})
            if self.path == '/sessions':
                return self.send_json(200, new_session(body, self.server.headless))
            match = re.fullmatch(r'/sessions/([a-f0-9]{32})/export', self.path)
            if match:
                return self.send_json(200, export_session(match[1]))
            self.send_json(404, {'error': '不存在的接口'})
        except Exception as exc:
            self.send_json(400, {'error': str(exc)})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, default=BASE / 'config.json')
    parser.add_argument('--headless-test', action='store_true')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    if not re.fullmatch('[a-f0-9]{64}', config['token']):
        raise ValueError('Invalid installation token')
    port = int(config.get('port', 19847))
    try:
        server = LocalServer(('127.0.0.1', port), Handler)
    except OSError:
        # Reopening the launcher reuses only this installation's authenticated service.
        request = urllib.request.Request(f'http://127.0.0.1:{port}/health', headers={'X-EPC-Token': config['token']})
        with urllib.request.urlopen(request, timeout=3) as response:
            if json.load(response).get('ready') is True:
                return
        raise
    server.token, server.headless = config['token'], args.headless_test
    server.ink = InkController(BASE, config)
    if not args.headless_test:
        server.ink.start()
        server.loader = start_loader(config)
    server.serve_forever()


if __name__ == '__main__':
    main()
