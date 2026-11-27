"""Dark multi-scale ridges for an optional fine relief layer, not semantic depth."""
import math
from PIL import Image, ImageChops, ImageFilter


def _response(gray, suppression):
    # The two radii retain thin ink lines and wider brush marks. Uniform dark
    # fills and broad paper shading have little response inside the region.
    fine_background = gray.filter(ImageFilter.GaussianBlur(2))
    broad_background = gray.filter(ImageFilter.GaussianBlur(5 + suppression * .04))
    try:
        fine = ImageChops.subtract(fine_background, gray)
        broad = ImageChops.subtract(broad_background, gray)
        try:
            return ImageChops.lighter(fine, broad)
        finally:
            fine.close(); broad.close()
    finally:
        fine_background.close(); broad_background.close()


def calculate(gray, alpha, suppression=65, progress=lambda p: None, cancelled=lambda: False, band_rows=512):
    if gray.mode != 'L' or (alpha is not None and alpha.size != gray.size):
        raise ValueError('笔触原图与透明度不一致')
    radius = 5 + suppression * .04
    halo = math.ceil(radius * 8 + 16)
    histogram = [0] * 256
    # One histogram for the entire painting, not an independently normalized
    # brush texture for each print segment.
    for y in range(0, gray.height, band_rows):
        if cancelled():
            raise InterruptedError('笔触纹理计算已取消')
        y0, y1 = max(0, y - halo), min(gray.height, y + band_rows + halo)
        with gray.crop((0, y0, gray.width, y1)) as band, _response(band, suppression) as response:
            with response.crop((0, y - y0, gray.width, min(gray.height, y + band_rows) - y0)) as piece:
                if alpha is not None:
                    with alpha.crop((0, y, gray.width, min(gray.height, y + band_rows))) as mask:
                        hist = piece.histogram(mask=mask)
                else:
                    hist = piece.histogram()
                histogram = [a + b for a, b in zip(histogram, hist)]
        progress(round(50 * min(y + band_rows, gray.height) / gray.height))
    threshold = round(1 + suppression * .06)
    target = sum(histogram[threshold + 1:]) * .99
    count, upper = 0, threshold
    for value in range(threshold + 1, 256):
        count += histogram[value]
        if count >= target:
            upper = value
            break
    lut = [0 if v <= threshold or upper <= threshold else round(255 * min(1, (v - threshold) / (upper - threshold)) ** .85) for v in range(256)]
    output = Image.new('L', gray.size)
    try:
        for y in range(0, gray.height, band_rows):
            if cancelled():
                raise InterruptedError('笔触纹理计算已取消')
            y0, y1 = max(0, y - halo), min(gray.height, y + band_rows + halo)
            with gray.crop((0, y0, gray.width, y1)) as band, _response(band, suppression) as response, response.point(lut) as shaped:
                with shaped.crop((0, y - y0, gray.width, min(gray.height, y + band_rows) - y0)) as piece:
                    output.paste(piece, (0, y))
            progress(50 + round(50 * min(y + band_rows, gray.height) / gray.height))
        if alpha is not None:
            with alpha.point([0] + [255] * 255) as mask, Image.new('L', gray.size) as zero:
                masked = Image.composite(output, zero, mask)
            output.close(); output = masked
        return output, {'algorithm': 'dark-multiscale-ridges-v1', 'threshold': threshold,
                        'globalUpper': upper, 'paperSuppression': suppression, 'hasTexture': output.getextrema()[1] > 0}
    except BaseException:
        output.close()
        raise
