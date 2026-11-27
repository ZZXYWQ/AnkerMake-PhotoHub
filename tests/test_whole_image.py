import base64
import io
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from bridge import read_raster_data_url
from whole_image import prepare_whole, split_whole_height


def url(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()


def decode(value):
    return Image.open(io.BytesIO(base64.b64decode(value.split(',')[1]))).convert('RGBA')


class WholeImageTests(unittest.TestCase):
    def fixture(self):
        color = Image.new('RGBA', (13, 17001))
        color.putdata([(x * 17, y % 256, (x + y) % 256, 255) for y in range(color.height) for x in range(color.width)])
        tiles = []
        for index, y in enumerate(range(0, color.height, 8192)):
            tile = color.crop((0, y, 13, min(y + 8192, color.height)))
            tiles.append({'id': str(index), 'x': 0, 'y': y, 'width': 13, 'height': tile.height, 'dataUrl': url(tile)})
        return color, {'width': 13, 'height': 17001, 'tiles': tiles}

    def test_color_source_unchanged_and_one_global_height_field(self):
        color, body = self.fixture()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            prepared = prepare_whole(body, root, read_raster_data_url)
            source = Image.open(root / 'whole-images' / prepared['sourceId'] / 'source.png')
            self.assertEqual(source.tobytes(), color.tobytes())
            self.assertLessEqual(prepared['proxyHeight'], 4096)
            # One simulated ORIGINAL APP result, deliberately spanning different
            # ranges in each output tile. No independently generated tile input.
            native_gray = Image.new('RGBA', (3, 7))
            native_gray.putdata([(y * 31, y * 31, y * 31, 255) for y in range(7) for x in range(3)])
            result = split_whole_height({**body, 'sourceId': prepared['sourceId'], 'grayDataUrl': url(native_gray)}, root, read_raster_data_url)
            expected = native_gray.resize(color.size, Image.Resampling.BILINEAR)
            joined = Image.new('RGBA', color.size)
            for tile in result['tiles']:
                joined.paste(decode(tile['grayDataUrl']), (tile['x'], tile['y']))
            self.assertEqual(joined.tobytes(), expected.tobytes())
            self.assertEqual(result['globalMaxGrayValue'], 186)
            for boundary in (8192, 16384):
                self.assertEqual(joined.crop((0, boundary - 1, 13, boundary + 1)).tobytes(), expected.crop((0, boundary - 1, 13, boundary + 1)).tobytes())

    def test_incomplete_or_overlapping_source_rejected(self):
        _, body = self.fixture()
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                prepare_whole({**body, 'tiles': body['tiles'][:-1]}, root, read_raster_data_url)
            duplicated = [*body['tiles'], body['tiles'][0]]
            with self.assertRaises(ValueError):
                prepare_whole({**body, 'tiles': duplicated}, root, read_raster_data_url)

    def test_unsafe_or_missing_source_id_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            for ident in ('../outside', '0' * 32):
                with self.assertRaises(ValueError):
                    prepare_whole({'sourceId': ident}, root, read_raster_data_url)


if __name__ == '__main__':
    unittest.main()
