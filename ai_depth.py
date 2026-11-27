"""Offline experimental relative depth. Model and CPU runtime ship with the plugin."""
import hashlib
import json
import math
import os
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

MODEL_FILE = 'depth-anything-v2-small.onnx'
MODEL_SHA = 'e5aa5f7aeb50f00ff3bd2e9d09bbf6f3395fff9ebc2d994303d1294b042f2207'


def capabilities(root):
    root = Path(root)
    ready = (root / MODEL_FILE).is_file() and (root / 'LICENSE.txt').is_file()
    return {'ready': ready, 'name': 'Depth Anything V2 Small', 'experimental': True,
            'offline': True, 'device': 'CPU',
            'message': '内置模型已就绪，离线计算，不消耗积分' if ready else '内置 AI 模型缺失，请重新安装完整插件包'}


class Predictor:
    def __init__(self, root):
        # Lazy imports: normal editing and the tonal modes do not load AI libraries.
        import numpy as np
        import onnxruntime as ort
        model = Path(root) / MODEL_FILE
        if not capabilities(root)['ready']:
            raise ValueError(capabilities(root)['message'])
        if hashlib.file_digest(model.open('rb'), 'sha256').hexdigest() != MODEL_SHA:
            raise ValueError('内置 AI 模型校验失败，请重新安装完整插件包；原设计未改变')
        options = ort.SessionOptions()
        options.intra_op_num_threads = min(4, max(1, (os.cpu_count() or 2) // 2))
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        self.session = ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])
        self.mean = np.array([.485, .456, .406], dtype=np.float32)[None, :, None, None]
        self.std = np.array([.229, .224, .225], dtype=np.float32)[None, :, None, None]

    def __call__(self, rgb):
        import numpy as np
        h, w = rgb.shape[:2]
        side = max(h, w)
        top, left = (side - h) // 2, (side - w) // 2
        padded = np.pad(rgb, ((top, side - h - top), (left, side - w - left), (0, 0)), mode='edge')
        with Image.fromarray(padded) as image, image.resize((518, 518), Image.Resampling.BICUBIC) as resized:
            values = np.asarray(resized, dtype=np.float32).transpose(2, 0, 1)[None] / 255
        values = np.ascontiguousarray((values - self.mean) / self.std)
        depth = self.session.run(['depth'], {'pixel_values': values})[0][0]
        if not np.isfinite(depth).all():
            raise ValueError('AI 返回无效深度，原设计未改变')
        with Image.fromarray(depth.astype(np.float32)) as image:
            with image.transform((w, h), Image.Transform.EXTENT,
                                 (left * 518 / side, top * 518 / side, (left + w) * 518 / side, (top + h) * 518 / side),
                                 Image.Resampling.BILINEAR) as resized:
                return np.array(resized, dtype=np.float32)

    def close(self):
        self.session = None


def starts(length, window):
    if length <= window:
        return [0]
    result = list(range(0, length - window + 1, max(1, window // 2)))
    if result[-1] != length - window:
        result.append(length - window)
    return result


def align(reference, predicted, valid):
    """Positive affine calibration in the shared area; no per-tile normalization."""
    import numpy as np
    x, y = predicted[valid][::8], reference[valid][::8]
    if x.size < 32:
        return 1., 0.
    keep = np.isfinite(x) & np.isfinite(y)
    x, y = x[keep], y[keep]
    if x.size < 32:
        return 1., 0.
    scale = 1.
    for _ in range(2):
        variance = float(np.var(x))
        if variance > 1e-8:
            scale = float(np.clip(np.mean((x - x.mean()) * (y - y.mean())) / variance, .25, 4.))
        shift = float(np.median(y - scale * x))
        residual = np.abs(y - (scale * x + shift))
        good = residual <= max(float(np.quantile(residual, .9)), 1e-6)
        x, y = x[good], y[good]
        if x.size < 32:
            break
    return scale, shift


def stitch(rgb, predict, progress=lambda value: None, cancelled=lambda: False):
    """Square, overlapping windows preserve local context on either scroll axis."""
    import numpy as np
    horizontal = rgb.shape[1] > rgb.shape[0]
    image = rgb.transpose(1, 0, 2) if horizontal else rgb
    length, width = image.shape[:2]
    window = min(length, width)
    positions = starts(length, window)
    total = np.zeros((length, width), dtype=np.float32)
    weight = np.zeros_like(total)
    ramp = np.maximum(.02, np.minimum(np.linspace(0, 2, window), np.linspace(2, 0, window))).astype(np.float32)[:, None]
    calibration = []
    for index, y in enumerate(positions):
        if cancelled():
            raise InterruptedError('AI 深度计算已取消')
        # Keep the scene upright for the model. Transposing the RGB patch itself
        # turns every horizontal scroll into a sideways, mirrored scene.
        patch = rgb[:, y:y + window] if horizontal else rgb[y:y + window]
        predicted = np.asarray(predict(patch), dtype=np.float32)
        if horizontal:
            predicted = predicted.T
        if predicted.shape != (window, width) or not np.isfinite(predicted).all():
            raise ValueError('AI 深度输出尺寸或数值无效')
        old, weights = total[y:y + window], weight[y:y + window]
        common = weights > 0
        if common.any():
            reference = np.divide(old, weights, out=np.zeros_like(old), where=common)
            scale, shift = align(reference, predicted, common)
            predicted = predicted * scale + shift
        else:
            scale, shift = 1., 0.
        calibration.append({'start': y, 'scale': scale, 'shift': shift})
        old += predicted * ramp
        weights += ramp
        progress(20 + round(55 * (index + 1) / len(positions)))
    if cancelled():
        raise InterruptedError('AI 深度计算已取消')
    total /= weight
    return (total.T if horizontal else total), calibration


def calculate(source, gray, alpha, options, model_root, progress=lambda value: None, cancelled=lambda: False, predictor=None):
    import numpy as np
    w, h = gray.size
    # Bounded analysis resolution is independent of the original and output size.
    scale = min(1., 768 / min(w, h), math.sqrt(24 * 1024 * 1024 / (w * h)))
    size = max(1, round(w * scale)), max(1, round(h * scale))
    if min(size) < 8:
        raise ValueError('图片过窄，无法进行 AI 深度识别；原设计未改变')
    with Image.open(source) as original:
        orientation = original.getexif().get(274, 1)
        stored_size = original.size
        original.draft('RGB', size[::-1] if orientation in (5, 6, 7, 8) else size)
        with ImageOps.exif_transpose(original) as oriented, oriented.convert('RGB') as rgb:
            with rgb.resize(size, Image.Resampling.LANCZOS) as resized:
                analysis = np.array(resized)
    rotation = options.get('aiRotation', 'auto')
    turns = (-int(rotation) // 90) % 4 if rotation != 'auto' else (1 if orientation == 6 else 3 if orientation == 8 else 0) if stored_size[0] > stored_size[1] * 8 else 0
    if turns:
        analysis = np.rot90(analysis, turns)
    owned = predictor is None
    predict = predictor or Predictor(model_root)
    try:
        depth, calibration = stitch(analysis, predict, progress, cancelled)
    finally:
        if owned:
            predict.close()
    del analysis
    if turns:
        depth = np.rot90(depth, -turns)
    visible = np.ones(depth.shape, dtype=bool)
    if alpha is not None:
        with alpha.resize(size, Image.Resampling.NEAREST) as small_alpha:
            visible = np.asarray(small_alpha) > 0
    samples = depth[visible]
    if samples.size == 0:
        raise ValueError('图片完全透明，未生成 AI 浮雕')
    low, high = np.quantile(samples, [.01, .99])
    if high - low <= 1e-6:
        raise ValueError('AI 未识别出有效深度层次；请换用其他模式或图片，原设计未改变')
    depth = np.clip((depth - low) / (high - low), 0, 1).astype(np.float32)
    gamma = 2 ** ((50 - options['strength']) / 65)
    depth **= gamma
    if options['invert']:
        depth = 1 - depth
    output = render_field(depth, (w, h), alpha, options, progress, cancelled)
    return output, {'model': 'Depth Anything V2 Small', 'modelSha256': MODEL_SHA,
                        'experimental': True, 'analysisSize': list(size), 'outputSize': [w, h],
                        'normalization': 'global-1-99-percentile', 'overlap': .5, 'tiles': calibration,
                        'runtime': 'bundled-onnxruntime-cpu', 'heightMeaning': 'relative-near-white',
                        'semanticRotationQuarterTurns': turns}


def render_field(depth, dimensions, alpha, options, progress=lambda p: None, cancelled=lambda: False):
    import numpy as np
    w, h = dimensions
    size = depth.shape[1], depth.shape[0]
    output = Image.new('L', (w, h))
    try:
        # Restore original output dimensions in bounded bands, not a giant RGBA canvas.
        halo = math.ceil(4 * options['smooth'] + 2)
        with Image.fromarray(depth) as field:
            for y in range(0, h, 512):
                if cancelled():
                    raise InterruptedError('AI 深度计算已取消')
                y0, y1 = max(0, y - halo), min(h, y + 512 + halo)
                with field.transform((w, y1 - y0), Image.Transform.EXTENT,
                                     (0, y0 * size[1] / h, size[0], y1 * size[1] / h), Image.Resampling.BILINEAR) as band:
                    values = np.clip(np.asarray(band) * 255, 0, 255).astype(np.uint8)
                    result = Image.fromarray(values)
                try:
                    if options['smooth']:
                        filtered = result.filter(ImageFilter.GaussianBlur(options['smooth']))
                        result.close()
                        result = filtered
                    with result.crop((0, y - y0, w, min(y + 512, h) - y0)) as piece:
                        output.paste(piece, (0, y))
                finally:
                    result.close()
                progress(83 + round(5 * min(y + 512, h) / h))
        if alpha is not None:
            with alpha.point([0] + [255] * 255) as mask, Image.new('L', (w, h)) as zero:
                masked = Image.composite(output, zero, mask)
            output.close()
            output = masked
        return output
    except BaseException:
        output.close()
        raise
