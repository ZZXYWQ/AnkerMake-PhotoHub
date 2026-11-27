import base64
import io
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from PIL import Image, ImageOps
from bridge import read_raster_data_url, prepare_raster


class RasterImportTests(unittest.TestCase):
    def test_original_encoding_and_metadata_preserved(self):
        for fmt, mime, suffix in [('PNG', 'png', '.png'), ('JPEG', 'jpeg', '.jpg'), ('WEBP', 'webp', '.webp')]:
            with self.subTest(fmt=fmt):
                image = Image.new('RGB', (7, 3), (18, 90, 120))
                exif = Image.Exif()
                exif[274] = 6
                stream = io.BytesIO()
                image.save(stream, format=fmt, exif=exif, icc_profile=b'test-profile')
                raw = stream.getvalue()
                url = f'data:image/{mime};base64,' + base64.b64encode(raw).decode()
                actual, w, h, extension = read_raster_data_url(url)
                self.assertEqual(actual, raw)
                self.assertEqual((w, h, extension), (3, 7, suffix))

    def test_mismatched_format_rejected(self):
        stream = io.BytesIO()
        Image.new('RGB', (2, 2)).save(stream, format='PNG')
        with self.assertRaises(ValueError):
            read_raster_data_url('data:image/jpeg;base64,' + base64.b64encode(stream.getvalue()).decode())

    def test_invalid_data_rejected(self):
        for value in [None, 1, 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,!!!']:
            with self.subTest(value=value), self.assertRaises((ValueError, TypeError)):
                read_raster_data_url(value)

    def test_long_import_is_one_original_image_without_tiles(self):
        image = Image.new('RGBA', (13, 17001))
        image.putdata([(x % 256, y % 256, (x + y) % 256, y % 255)
                       for y in range(image.height) for x in range(image.width)])
        stream = io.BytesIO()
        image.save(stream, format='PNG')
        raw = stream.getvalue()
        with tempfile.TemporaryDirectory() as folder, patch('bridge.DATA', Path(folder)):
            url = 'data:image/png;base64,' + base64.b64encode(raw).decode()
            result = prepare_raster({'dataUrl': url, 'fileName': 'long.png'})
            self.assertEqual(Path(result['savedImage']).read_bytes(), raw)
            self.assertTrue(result['singleObject'])
            self.assertNotIn('tiles', result)
            self.assertEqual(result['dataUrl'], url)
            decoded = Image.open(io.BytesIO(base64.b64decode(result['dataUrl'].split(',')[1])))
            self.assertEqual(decoded.tobytes(), image.tobytes())

    def test_all_exif_orientations_preserve_decoded_pixels(self):
        for orientation in range(2, 9):
            with self.subTest(orientation=orientation), tempfile.TemporaryDirectory() as folder, patch('bridge.DATA', Path(folder)):
                image = Image.new('RGB', (7, 3))
                image.putdata([(x * 27, y * 91, (x + y) * 19) for y in range(3) for x in range(7)])
                exif = Image.Exif()
                exif[274] = orientation
                stream = io.BytesIO()
                image.save(stream, format='JPEG', exif=exif, icc_profile=b'test-profile')
                raw = stream.getvalue()
                expected = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
                result = prepare_raster({'dataUrl': 'data:image/jpeg;base64,' + base64.b64encode(raw).decode(), 'fileName': 'oriented.jpg'})
                actual = Image.open(io.BytesIO(base64.b64decode(result['dataUrl'].split(',')[1])))
                operation = {2: Image.Transpose.FLIP_LEFT_RIGHT, 3: Image.Transpose.ROTATE_180,
                             4: Image.Transpose.FLIP_TOP_BOTTOM, 5: Image.Transpose.TRANSPOSE,
                             6: Image.Transpose.ROTATE_270, 7: Image.Transpose.TRANSVERSE,
                             8: Image.Transpose.ROTATE_90}[orientation]
                transformed = actual.transpose(operation)
                self.assertEqual(transformed.size, expected.size)
                self.assertEqual(transformed.tobytes(), expected.tobytes())
                encoded = base64.b64decode(result['dataUrl'].split(',')[1])
                self.assertLess(len(encoded), len(raw))
                # The entropy-coded image scan is byte exact, not recompressed.
                self.assertEqual(encoded[encoded.index(b'\xff\xda'):], raw[raw.index(b'\xff\xda'):])
                self.assertEqual(actual.getexif().get(274, 1), 1)
                self.assertEqual(actual.info['icc_profile'], b'test-profile')
                self.assertEqual(Path(result['savedImage']).read_bytes(), raw)
                self.assertEqual((result['width'], result['height']), expected.size)
                self.assertNotIn('tiles', result)


if __name__ == '__main__':
    unittest.main()
