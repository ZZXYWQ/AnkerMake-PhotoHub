# AnkerMake PhotoHub 0.8.7 Public Beta. Host 5.1.3 / editor 1.25.04 only.
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

from PIL import Image, ImageOps
from standalone.photocraft_control import PhotoCraft
from cdp_loader import start_loader
from ink_control import InkController
from whole_image import prepare_whole, split_whole_height
from local_relief import LocalRelief
from native_preview import prepare_preview

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


def read_raster_data_url(url):
    """Validate raster format without re-encoding original pixels or metadata."""
    if not isinstance(url, str):
        raise ValueError('需要图片数据')
    prefixes = {'data:image/png;base64,': ('PNG', '.png'),
                'data:image/jpeg;base64,': ('JPEG', '.jpg'),
                'data:image/webp;base64,': ('WEBP', '.webp')}
    prefix = next((p for p in prefixes if url.startswith(p)), None)
    if not prefix:
        raise ValueError('需要 PNG、JPEG 或 WebP 数据')
    raw = base64.b64decode(url[len(prefix):], validate=True)
    expected, suffix = prefixes[prefix]
    with Image.open(io.BytesIO(raw)) as image:
        if image.format != expected:
            raise ValueError('图片类型与数据不一致')
        width, height = image.size
        if image.getexif().get(274, 1) in (5, 6, 7, 8):
            width, height = height, width
    with Image.open(io.BytesIO(raw)) as image:
        image.verify()
    return raw, width, height, suffix


def prepare_raster(body):
    """Return one whole raster; never replace a picture with grouped tile objects."""
    raw, width, height, suffix = read_raster_data_url(body.get('dataUrl'))
    result = {'width': width, 'height': height, 'singleObject': True,
              'dataUrl': body['dataUrl'],
              'fileName': Path(str(body.get('fileName') or 'PhotoHub' + suffix)).name}
    with Image.open(io.BytesIO(raw)) as source:
        orientation = source.getexif().get(274, 1)
        source_width, source_height = source.size
    needs_orientation = orientation in range(2, 9)
    if max(width, height) <= 16384 and width * height <= 16_777_216 and not needs_orientation:
        return result
    folder = DATA / 'exports'
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / (uuid.uuid4().hex + suffix)
    output.write_bytes(raw)
    result['savedImage'] = str(output)
    result['sourceId'] = output.stem
    if needs_orientation and suffix == '.jpg':
        # Keep the original EXIF in the saved source, and omit its APP1 block
        # from the native input. The JPEG scan, coefficients, ICC (APP2) and
        # JFIF density remain byte exact. Object transforms provide orientation.
        encoded = jpeg_without_orientation(raw, orientation)
        result['dataUrl'] = 'data:image/jpeg;base64,' + base64.b64encode(encoded).decode('ascii')
        angle, flip_x, flip_y = {2: (0, True, False), 3: (180, False, False),
                                4: (0, False, True), 5: (90, False, True),
                                6: (90, False, False), 7: (90, True, False),
                                8: (270, False, False)}[orientation]
        result.update(sourceWidth=source_width, sourceHeight=source_height,
                      orientationTransform={'angle': angle, 'flipX': flip_x, 'flipY': flip_y},
                      orientationNormalized=True)
    elif needs_orientation:
        # Native cache/decoder versions disagree about EXIF orientation. Rotate
        # decoded pixels once and encode losslessly; retain the supplied file
        # above. No JPEG recompression, resizing or separate canvas objects.
        with Image.open(io.BytesIO(raw)) as source:
            image = ImageOps.exif_transpose(source)
            stream = io.BytesIO()
            metadata = {key: source.info[key] for key in ('icc_profile', 'dpi') if source.info.get(key)}
            image.save(stream, format='PNG', compress_level=1, **metadata)
            result['dataUrl'] = 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')
            result['orientationNormalized'] = True
            image.close()
    return result


def jpeg_without_orientation(raw, expected):
    """Omit orientation-carrying EXIF; never decode/recompress JPEG scans."""
    offset = 2
    while offset + 4 <= len(raw) and raw[offset] == 0xff:
        marker = raw[offset + 1]
        if marker == 0xff:
            offset += 1
            continue
        if marker in (0xda, 0xd9):
            break
        if marker == 0x01 or 0xd0 <= marker <= 0xd7:
            offset += 2
            continue
        length = int.from_bytes(raw[offset + 2:offset + 4], 'big')
        end = offset + 2 + length
        if length < 2 or end > len(raw):
            break
        if marker == 0xe1 and raw[offset + 4:offset + 10] == b'Exif\0\0':
            start = offset + 10
            order = {'little': b'II', 'big': b'MM'}
            endian = next((key for key, value in order.items() if raw[start:start + 2] == value), None)
            if not endian or start + 8 > end:
                break
            directory = start + int.from_bytes(raw[start + 4:start + 8], endian)
            if directory < start + 8 or directory + 2 > end:
                break
            count = int.from_bytes(raw[directory:directory + 2], endian)
            for index in range(count):
                entry = directory + 2 + index * 12
                if entry + 12 > end:
                    break
                tag = int.from_bytes(raw[entry:entry + 2], endian)
                kind = int.from_bytes(raw[entry + 2:entry + 4], endian)
                items = int.from_bytes(raw[entry + 4:entry + 8], endian)
                if tag == 274 and kind == 3 and items == 1:
                    if int.from_bytes(raw[entry + 8:entry + 10], endian) != expected:
                        raise ValueError('JPEG 方向信息不一致；原图未修改')
                    return raw[:offset] + raw[end:]
        offset = end
    raise ValueError('无法无损读取 JPEG 方向信息；原图已保留')


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
    server_version = 'AnkerMakePhotoHubBridge/0.8.7'

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
            return self.send_json(200, {'version': '0.8.7', 'ready': True, 'online': getattr(self.server, 'loader', {}).get('status')})
        match = re.fullmatch(r'/relief/jobs/([a-f0-9]{32})(/result)?', self.path)
        if match:
            try:
                value = self.server.relief.result(match[1]) if match[2] else self.server.relief.status(match[1])
                return self.send_json(200, value)
            except Exception as exc:
                return self.send_json(400, {'error': str(exc)})
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
            if self.path == '/relief/preview/prepare':
                return self.send_json(200, prepare_preview(body.get('pageUrl')))
            if self.path == '/relief/preview/checkpoint':
                folder = DATA / 'preview-recovery'
                folder.mkdir(parents=True, exist_ok=True)
                target = folder / (time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8] + '.json')
                target.write_text(json.dumps(body, ensure_ascii=False), encoding='utf8')
                return self.send_json(200, {'saved': True, 'path': str(target)})
            if self.path == '/relief/jobs':
                return self.send_json(200, self.server.relief.create(body))
            if self.path == '/relief/capabilities':
                from ai_depth import capabilities
                from ai_strokes import capabilities as stroke_capabilities
                return self.send_json(200, {'aiDepth': capabilities(self.server.relief.model_root), 'aiStrokes': stroke_capabilities(self.server.relief.model_root.parent / 'strokes')})
            match = re.fullmatch(r'/relief/jobs/([a-f0-9]{32})/cancel', self.path)
            if match:
                return self.send_json(200, self.server.relief.cancel(match[1]))
            if self.path == '/raster/prepare':
                return self.send_json(200, prepare_raster(body))
            if self.path == '/whole-image/prepare':
                return self.send_json(200, prepare_whole(body, DATA, read_raster_data_url))
            if self.path == '/whole-image/height':
                return self.send_json(200, split_whole_height(body, DATA, read_raster_data_url))
            if self.path == '/ink/mask':
                if 'mask' not in body:
                    raise ValueError('缺少墨路选择')
                return self.send_json(200, self.server.ink.status(body['mask']))
            if self.path == '/ink/policy/arm':
                if 'enabled' not in body:
                    raise ValueError('缺少逐图层墨路状态')
                return self.send_json(200, self.server.ink.status(policy=body['enabled']))
            if self.path == '/artifacts':
                raw, width, height, suffix = read_raster_data_url(body.get('dataUrl', ''))
                folder = DATA / 'exports'
                folder.mkdir(parents=True, exist_ok=True)
                output = folder / (uuid.uuid4().hex + suffix)
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
    global DATA
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, default=BASE / 'config.json')
    parser.add_argument('--headless-test', action='store_true')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    if config.get('dataRoot'):
        DATA = Path(config['dataRoot'])
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
    server.relief = LocalRelief(DATA, read_raster_data_url, BASE / 'models' / 'depth')
    if not args.headless_test:
        server.ink.start()
        server.loader = start_loader(config)
    server.serve_forever()


if __name__ == '__main__':
    main()
