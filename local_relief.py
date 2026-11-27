"""Offline, full-resolution tonal/ink relief. No model download or cloud API."""
import base64
import hashlib
import io
import json
import math
from pathlib import Path
import threading
import time
import uuid

from PIL import Image, ImageChops, ImageFilter, ImageOps


def settings(body):
    mode = body.get('mode', 'surface')
    if mode not in ('surface', 'ink', 'tone', 'detail', 'ai-depth', 'ai-strokes'):
        raise ValueError('未知本机浮雕模式')
    result = {'mode': mode, 'invert': body.get('invert', False)}
    if mode in ('ai-depth', 'ai-strokes'):
        result['aiRotation'] = body.get('aiRotation', 'auto')
        if result['aiRotation'] not in ('auto', '0', '90', '180', '270'):
            raise ValueError('AI 识别方向无效')
    if type(result['invert']) is not bool:
        raise ValueError('反向高度选项无效')
    for name, default, low, high in (('strength', 55, 0, 100), ('detail', 35, 0, 100), ('smooth', 1, 0, 8), ('background', 65, 0, 100)):
        value = body.get(name, default)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('本机浮雕参数无效：' + name)
        result[name] = float(value)
    return result


def _oriented(image, orientation):
    method = {2: Image.Transpose.FLIP_LEFT_RIGHT, 3: Image.Transpose.ROTATE_180,
              4: Image.Transpose.FLIP_TOP_BOTTOM, 5: Image.Transpose.TRANSPOSE,
              6: Image.Transpose.ROTATE_270, 7: Image.Transpose.TRANSVERSE,
              8: Image.Transpose.ROTATE_90}.get(orientation)
    if method is None:
        return image
    result = image.transpose(method)
    image.close()
    return result


def _percentile(histogram, fraction):
    target = sum(histogram) * fraction
    count = 0
    for value, samples in enumerate(histogram):
        count += samples
        if count >= target:
            return value
    return 255


def calculate(gray, alpha, options, progress=lambda value: None, cancelled=lambda: False, band_rows=1024):
    """One global normalization; haloed bands only bound temporary working memory."""
    if gray.mode != 'L' or (alpha is not None and (alpha.mode != 'L' or alpha.size != gray.size)):
        raise ValueError('原图灰度与透明度尺寸不一致')
    if not isinstance(band_rows, int) or band_rows < 1:
        raise ValueError('计算条带尺寸无效')
    histogram = gray.histogram(mask=alpha) if alpha is not None else gray.histogram()
    low, high = _percentile(histogram, .01), _percentile(histogram, .99)
    span = high - low
    tone_lut = [max(0, min(255, round((v - low) * 255 / span))) if span else 0 for v in range(256)]
    if options['mode'] != 'tone':
        tone_lut = [255 - v if span else 0 for v in tone_lut]
    radius = 8 + options['background'] * .32
    halo = math.ceil(8 * max(radius, options['smooth']) + 32)
    gamma = 2 ** ((50 - options['strength']) / 65)
    contrast = [round(255 * (v / 255) ** gamma) for v in range(256)]
    gain = 1 + options['detail'] * .12
    detail_lut = [min(255, round(v * gain)) for v in range(256)]
    output = Image.new('L', gray.size)
    try:
        for y in range(0, gray.height, band_rows):
            if cancelled():
                raise InterruptedError('本机浮雕计算已取消')
            y0, y1 = max(0, y - halo), min(gray.height, y + band_rows + halo)
            band = gray.crop((0, y0, gray.width, y1))
            try:
                if options['smooth']:
                    blurred = band.filter(ImageFilter.GaussianBlur(options['smooth']))
                    band.close()
                    band = blurred
                if options['mode'] == 'surface':
                    # Broad height is the base; high-frequency ink must not turn
                    # the entire painting into isolated printable ridges.
                    structure = band.filter(ImageFilter.GaussianBlur(3 + (100 - options['detail']) * .055))
                    tone = structure.point(tone_lut)
                    structure.close()
                    fine = band.point(tone_lut)
                    result = Image.blend(tone, fine, .08 + .14 * options['detail'] / 100)
                    tone.close()
                    fine.close()
                else:
                    tone = band.point(tone_lut)
                if options['mode'] in ('ink', 'detail'):
                    paper = band.filter(ImageFilter.GaussianBlur(radius))
                    local = ImageChops.subtract(paper, band) if options['mode'] == 'ink' else ImageChops.difference(paper, band)
                    paper.close()
                    enhanced = local.point(detail_lut)
                    local.close()
                    if options['mode'] == 'ink':
                        result = Image.blend(tone, enhanced, .5 + .45 * options['background'] / 100)
                        enhanced.close()
                    else:
                        result = enhanced
                    tone.close()
                elif options['mode'] != 'surface':
                    result = tone
                shaped = result.point(contrast)
                result.close()
                if options['invert']:
                    inverted = ImageOps.invert(shaped)
                    shaped.close()
                    shaped = inverted
                piece = shaped.crop((0, y - y0, gray.width, min(y + band_rows, gray.height) - y0))
                output.paste(piece, (0, y))
                piece.close()
                shaped.close()
            finally:
                band.close()
            progress(20 + round(65 * min(y + band_rows, gray.height) / gray.height))
        if alpha is not None:
            # Transparent pixels must not influence the common height maximum.
            visible = alpha.point([0] + [255] * 255)
            zero = Image.new('L', gray.size)
            masked = Image.composite(output, zero, visible)
            output.close()
            zero.close()
            visible.close()
            output = masked
        return output
    except BaseException:
        output.close()
        raise


class LocalRelief:
    def __init__(self, root, reader, model_root=None):
        self.root, self.reader = Path(root) / 'local-relief', reader
        self.model_root = Path(model_root) if model_root else Path(__file__).parent / 'models' / 'depth'
        self.lock = threading.Lock()
        self.jobs = {}
        self.active = None

    def create(self, body):
        options = settings(body)
        if options['mode'] in ('ai-depth', 'ai-strokes'):
            if options['mode'] == 'ai-depth':
                from ai_depth import capabilities
                info = capabilities(self.model_root)
            else:
                from ai_strokes import capabilities
                info = capabilities(self.model_root.parent / 'strokes')
            if not info['ready']:
                raise ValueError(info['message'])
        with self.lock:
            if self.active:
                raise ValueError('已有本机浮雕任务在计算，请完成或取消后再试')
            self.active = 'preparing'
        try:
            raw, width, height, suffix = self.reader(body.get('dataUrl'))
            source_sha = hashlib.sha256(raw).hexdigest()
            folder = self.root / source_sha
            folder.mkdir(parents=True, exist_ok=True)
            source = folder / ('original' + suffix)
            if source.exists():
                if hashlib.sha256(source.read_bytes()).hexdigest() != source_sha:
                    raise ValueError('本机原图缓存校验失败')
            else:
                source.write_bytes(raw)
            ident = uuid.uuid4().hex
            job = {'id': ident, 'status': 'queued', 'progress': 0, 'options': options,
                   'width': width, 'height': height, 'sourceSha256': source_sha,
                   'cancel': threading.Event(), 'source': source, 'folder': folder / ident}
            with self.lock:
                self.jobs[ident] = job
                self.active = ident
            threading.Thread(target=self._work, args=(job,), name='PhotoHubLocalRelief', daemon=True).start()
            return self.status(ident)
        except BaseException:
            with self.lock:
                if self.active == 'preparing':
                    self.active = None
            raise

    def _job(self, ident):
        if not isinstance(ident, str) or len(ident) != 32 or any(c not in '0123456789abcdef' for c in ident):
            raise ValueError('本机浮雕任务标识无效')
        with self.lock:
            job = self.jobs.get(ident)
        if not job:
            raise ValueError('本机浮雕任务已失效，请重新计算')
        return job

    def status(self, ident):
        job = self._job(ident)
        return {key: job[key] for key in ('id', 'status', 'progress', 'width', 'height', 'options', 'sourceSha256', 'maxGrayValue', 'outputSha256', 'elapsedSeconds', 'aiDepth', 'aiStrokes', 'error') if key in job}

    def cancel(self, ident):
        job = self._job(ident)
        job['cancel'].set()
        return self.status(ident)

    def result(self, ident):
        job = self._job(ident)
        if job['status'] != 'complete' or job['cancel'].is_set():
            raise ValueError('本机浮雕尚未完成或已取消')
        raw = (job['folder'] / 'height.png').read_bytes()
        if hashlib.sha256(raw).hexdigest() != job['outputSha256']:
            raise ValueError('本机高度图校验失败')
        return {**self.status(ident), 'grayDataUrl': 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii')}

    def _work(self, job):
        started = time.monotonic()
        gray = alpha = height = encoded = None
        try:
            job.update(status='running', progress=5)
            with Image.open(job['source']) as source:
                orientation = source.getexif().get(274, 1)
                gray = ImageOps.grayscale(source)
                if 'A' in source.getbands():
                    alpha = source.getchannel('A')
                elif source.info.get('transparency') is not None:
                    rgba = source.convert('RGBA')
                    alpha = rgba.getchannel('A')
                    rgba.close()
            gray = _oriented(gray, orientation)
            if alpha is not None:
                alpha = _oriented(alpha, orientation)
            if gray.size != (job['width'], job['height']):
                raise ValueError('本机浮雕方向或像素尺寸不符')
            job['progress'] = 20
            if job['options']['mode'] == 'ai-depth':
                from ai_depth import calculate as calculate_ai
                height, job['aiDepth'] = calculate_ai(job['source'], gray, alpha, job['options'], self.model_root,
                                                    lambda p: job.update(progress=p), job['cancel'].is_set)
            elif job['options']['mode'] == 'ai-strokes':
                from ai_strokes import calculate as calculate_strokes
                height, job['aiStrokes'] = calculate_strokes(job['source'], gray, alpha, job['options'], self.model_root.parent / 'strokes', lambda p: job.update(progress=p), job['cancel'].is_set)
            else:
                height = calculate(gray, alpha, job['options'], lambda p: job.update(progress=p), job['cancel'].is_set)
            if job['cancel'].is_set():
                raise InterruptedError()
            job['maxGrayValue'] = height.getextrema()[1]
            if not job['maxGrayValue']:
                raise ValueError('当前参数得到全零高度图，请调整模式或强度；原设计未改变')
            encoded = Image.merge('LA', (height, alpha)) if alpha is not None else height
            job['folder'].mkdir(parents=True, exist_ok=False)
            job['progress'] = 90
            encoded.save(job['folder'] / 'height.png', compress_level=1)
            if job['cancel'].is_set():
                raise InterruptedError()
            job.update(outputSha256=hashlib.sha256((job['folder'] / 'height.png').read_bytes()).hexdigest(),
                       elapsedSeconds=round(time.monotonic() - started, 2), progress=100, status='complete')
            (job['folder'] / 'provenance.json').write_text(json.dumps(self.status(job['id']), ensure_ascii=False, indent=2), encoding='utf-8')
        except InterruptedError:
            job['status'] = 'cancelled'
        except Exception as error:
            job.update(status='failed', error=str(error))
        finally:
            for image in (gray, alpha, encoded if encoded is not height else None, height):
                if image is not None:
                    image.close()
            with self.lock:
                if self.active == job['id']:
                    self.active = None
