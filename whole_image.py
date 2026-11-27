"""One analysis image and one height field for a lossless tiled color source."""
import base64
import hashlib
import io
import json
from pathlib import Path
import re
import uuid

from PIL import Image, ImageOps


def _png_url(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG', compress_level=1)
    return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


def _source(root, ident):
    if not isinstance(ident, str) or not re.fullmatch('[a-f0-9]{32}', ident):
        raise ValueError('整图源标识无效')
    paths = [root / 'exports' / (ident + ext) for ext in ('.png', '.jpg', '.webp')]
    paths.append(root / 'whole-images' / ident / 'source.png')
    found = [p for p in paths if p.is_file()]
    if len(found) != 1:
        raise ValueError('整图源缓存缺失，请重新读取原始图片')
    return found[0]


def _rectangles(body):
    width, height, tiles = body.get('width'), body.get('height'), body.get('tiles')
    if not all(type(n) is int and n > 0 for n in (width, height)):
        raise ValueError('整图尺寸无效')
    if not isinstance(tiles, list) or not tiles:
        raise ValueError('缺少原始图片块')
    if width * height * 4 > 2 * 1024**3:
        raise ValueError('整图解码需要超过 2 GiB 内存；原图未修改')
    area = 0
    for i, tile in enumerate(tiles):
        x, y, w, h = (tile.get(k) for k in ('x', 'y', 'width', 'height'))
        if not all(type(n) is int for n in (x, y, w, h)) or min(x, y) < 0 or min(w, h) < 1 or x + w > width or y + h > height:
            raise ValueError('原始图片块坐标无效')
        for other in tiles[:i]:
            if min(x + w, other['x'] + other['width']) > max(x, other['x']) and min(y + h, other['y'] + other['height']) > max(y, other['y']):
                raise ValueError('原始图片块存在重叠')
        area += w * h
    if area != width * height:
        raise ValueError('原始图片块不完整，不能独立生成各块浮雕')
    return width, height, tiles


def prepare_whole(body, root, reader):
    root = Path(root)
    ident = body.get('sourceId')
    if ident:
        path = _source(root, ident)
        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source).convert('RGBA')
    else:
        width, height, tiles = _rectangles(body)
        image = Image.new('RGBA', (width, height))
        for tile in tiles:
            raw, w, h, _ = reader(tile.get('dataUrl'))
            if (w, h) != (tile['width'], tile['height']):
                raise ValueError('原始图片块像素尺寸不符')
            with Image.open(io.BytesIO(raw)) as source:
                normalized = ImageOps.exif_transpose(source).convert('RGBA')
                image.paste(normalized, (tile['x'], tile['y']))
                normalized.close()
        ident = uuid.uuid4().hex
        folder = root / 'whole-images' / ident
        folder.mkdir(parents=True, exist_ok=False)
        image.save(folder / 'source.png', compress_level=1)
    try:
        width, height = image.size
        scale = min(1, 4096 / max(width, height), (8_388_608 / (width * height))**.5)
        size = (max(1, round(width * scale)), max(1, round(height * scale)))
        proxy = image.resize(size, Image.Resampling.LANCZOS)
        result = {'sourceId': ident, 'width': width, 'height': height,
                  'proxyWidth': proxy.width, 'proxyHeight': proxy.height,
                  'proxyDataUrl': _png_url(proxy), 'colorPixelsUnchanged': True}
        proxy.close()
        return result
    finally:
        image.close()


def split_whole_height(body, root, reader):
    """Resample the entire AI result once, then crop. Never normalize per tile."""
    width, height, tiles = _rectangles(body)
    path = _source(Path(root), body.get('sourceId'))
    with Image.open(path) as source:
        source_size = source.size
        if source.getexif().get(274, 1) in (5, 6, 7, 8):
            source_size = source_size[::-1]
    if source_size != (width, height):
        raise ValueError('整图高度与原始色图坐标不符')
    raw, _, _, _ = reader(body.get('grayDataUrl'))
    with Image.open(io.BytesIO(raw)) as source:
        # Keep the native RGBA values, including alpha. This is an AI height
        # field supplied by the original app, never a luminance substitute.
        image = source.convert('RGBA').resize((width, height), Image.Resampling.BILINEAR)
    try:
        result = []
        for tile in tiles:
            x, y, w, h = (tile[k] for k in ('x', 'y', 'width', 'height'))
            piece = image.crop((x, y, x + w, y + h))
            result.append({'id': tile.get('id'), 'x': x, 'y': y, 'width': w, 'height': h,
                           'grayDataUrl': _png_url(piece), 'pixelSha256': hashlib.sha256(piece.tobytes()).hexdigest()})
            piece.close()
        folder = Path(root) / 'whole-images' / body['sourceId']
        folder.mkdir(parents=True, exist_ok=True)
        height_id = uuid.uuid4().hex
        image.save(folder / (height_id + '.png'), compress_level=1)
        maximum = max(maximum for minimum, maximum in image.convert('RGB').getextrema())
        manifest = {'sourceId': body['sourceId'], 'heightId': height_id,
                    'width': width, 'height': height, 'globalMaxGrayValue': maximum,
                    'aiInputHeightSha256': hashlib.sha256(raw).hexdigest(),
                    'wholePixelSha256': hashlib.sha256(image.tobytes()).hexdigest(),
                    'tiles': [{k: v for k, v in t.items() if k != 'grayDataUrl'} for t in result]}
        (folder / (height_id + '.json')).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        return {**manifest, 'tiles': result}
    finally:
        image.close()
