import base64
import io
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from bridge import read_raster_data_url
from local_relief import LocalRelief, calculate, settings


class LocalReliefTests(unittest.TestCase):
    def test_bands_have_no_seams(self):
        image = Image.new('L', (71, 1103))
        image.putdata([(x * 3 + y * 11 + (70 if y % 31 < 8 else 0)) % 256 for y in range(image.height) for x in range(image.width)])
        for mode in ('surface', 'ink', 'tone', 'detail'):
            options = settings({'mode': mode})
            with calculate(image, None, options, band_rows=1103) as whole, calculate(image, None, options, band_rows=127) as bands:
                self.assertEqual(whole.tobytes(), bands.tobytes(), mode)
                self.assertGreater(whole.getextrema()[1], 0)

    def test_cancel_and_alpha(self):
        gray = Image.new('L', (8, 8), 100)
        alpha = Image.new('L', gray.size, 0)
        with self.assertRaises(InterruptedError):
            calculate(gray, None, settings({}), cancelled=lambda: True)
        with calculate(gray, alpha, settings({'invert': True})) as height:
            self.assertEqual(height.getextrema(), (0, 0))

    def test_validation(self):
        for options in ({'mode': 'AI'}, {'smooth': float('nan')}, {'strength': True}, {'invert': 'false'}):
            with self.assertRaises(ValueError):
                settings(options)

    def test_one_worker_and_cancel(self):
        with tempfile.TemporaryDirectory() as folder:
            stream = io.BytesIO(); Image.new('L', (8, 8)).save(stream, format='PNG')
            service = LocalRelief(folder, lambda _: (stream.getvalue(), 8, 8, '.png'))
            with patch('local_relief.threading.Thread.start'):
                job = service.create({})
                with self.assertRaises(ValueError): service.create({})
                service.cancel(job['id'])
                service._work(service._job(job['id']))
                self.assertEqual(service.status(job['id'])['status'], 'cancelled')
                self.assertIsNone(service.active)

    def test_job_exif_and_result_integrity(self):
        with tempfile.TemporaryDirectory() as folder:
            service = LocalRelief(folder, read_raster_data_url)
            source = Image.new('RGB', (80, 16), 'white')
            for x in range(40):
                for y in range(16): source.putpixel((x, y), (x * 5, 20, 50))
            exif = Image.Exif(); exif[274] = 6
            stream = io.BytesIO(); source.save(stream, format='JPEG', exif=exif)
            job = service.create({'dataUrl': 'data:image/jpeg;base64,' + base64.b64encode(stream.getvalue()).decode()})
            deadline = time.monotonic() + 15
            while service.status(job['id'])['status'] in ('queued', 'running') and time.monotonic() < deadline: time.sleep(.01)
            result = service.result(job['id'])
            self.assertEqual((result['width'], result['height']), (16, 80))
            with Image.open(io.BytesIO(base64.b64decode(result['grayDataUrl'].split(',')[1]))) as height:
                self.assertEqual(height.size, (16, 80))
            files = list(Path(folder).rglob('height.png')); files[0].write_bytes(b'corrupt')
            with self.assertRaises(ValueError): service.result(job['id'])
            service.cancel(job['id'])
            with self.assertRaises(ValueError): service.result(job['id'])


if __name__ == '__main__': unittest.main()
