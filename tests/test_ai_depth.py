import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from ai_depth import align, calculate, capabilities, starts, stitch
from local_relief import settings, LocalRelief


class AIDepthTests(unittest.TestCase):
    def test_calibrated_overlap_and_both_axes(self):
        h, w = 1800, 128
        truth = np.linspace(0, 1, h * w, dtype=np.float32).reshape(h, w)
        rgb = np.stack([truth] * 3, axis=2)
        count = 0

        def predictor(patch):
            nonlocal count
            count += 1
            return patch[:, :, 0] * (1 + count * .02) + count * .01

        actual, tiles = stitch(rgb, predictor)
        fitted = (actual - actual.min()) / (actual.max() - actual.min())
        np.testing.assert_allclose(fitted, truth, atol=2e-4)
        self.assertGreater(len(tiles), 10)
        count = 0
        horizontal, _ = stitch(rgb.transpose(1, 0, 2), predictor)
        np.testing.assert_allclose(horizontal, actual.T, atol=1e-6)
        self.assertEqual(starts(1000, 128)[-1], 872)

    def test_cancel_invalid_and_flat_overlap(self):
        rgb = np.zeros((256, 64, 3), dtype=np.uint8)
        with self.assertRaises(InterruptedError):
            stitch(rgb, lambda x: None, cancelled=lambda: True)
        with self.assertRaises(ValueError):
            stitch(rgb, lambda x: np.full(x.shape[:2], np.nan))
        scale, shift = align(np.full((20, 20), 3.), np.ones((20, 20)), np.ones((20, 20), dtype=bool))
        self.assertEqual((scale, shift), (1., 2.))

    def test_full_dimensions_exif_transparency_and_inversion(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.jpg'
            color = Image.new('RGB', (1200, 64))
            color.putdata([(x % 256, y, 80) for y in range(64) for x in range(1200)])
            exif = Image.Exif(); exif[274] = 6
            color.save(path, exif=exif)
            gray = Image.new('L', (64, 1200), 180)
            alpha = Image.new('L', gray.size, 255)
            alpha.paste(0, (0, 0, 8, 1200))
            def predict(rgb):
                return rgb[:, :, 0].astype(np.float32)
            options = settings({'mode': 'ai-depth', 'detail': 0, 'smooth': 0, 'strength': 50})
            a, meta = calculate(path, gray, alpha, options, folder, predictor=predict)
            b, _ = calculate(path, gray, alpha, {**options, 'invert': True}, folder, predictor=predict)
            try:
                self.assertEqual(a.size, (64, 1200))
                self.assertEqual(meta['outputSize'], [64, 1200])
                self.assertEqual(a.getpixel((1, 400)), 0)
                self.assertAlmostEqual(a.getpixel((20, 300)) + b.getpixel((20, 300)), 255, delta=1)
            finally:
                a.close(); b.close()

    def test_missing_model_never_falls_back_or_saves_source(self):
        with tempfile.TemporaryDirectory() as folder:
            called = []
            service = LocalRelief(folder, lambda value: called.append(value), Path(folder) / 'absent')
            self.assertFalse(capabilities(service.model_root)['ready'])
            with self.assertRaisesRegex(ValueError, '模型缺失'):
                service.create({'mode': 'ai-depth'})
            self.assertFalse(called)
            self.assertIsNone(service.active)


if __name__ == '__main__':
    unittest.main()
