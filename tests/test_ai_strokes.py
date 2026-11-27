import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
from PIL import Image
from ai_strokes import stitch, calculate
from local_relief import settings


class AIStrokeTests(unittest.TestCase):
    def test_overlap_keeps_lines_and_both_dimensions(self):
        data = np.random.default_rng(10).integers(0,256,(137,229,3),dtype=np.uint8)
        result, count = stitch(data,lambda p:p[:,:,0]/255.,tile=64)
        np.testing.assert_allclose(result,data[:,:,0]/255.,atol=1e-6)
        self.assertGreater(count,4)
        with self.assertRaises(InterruptedError):stitch(data,lambda p:None,cancelled=lambda:True)

    def test_no_depth_model_is_called_and_full_size_preserved(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source.png';rgb=np.zeros((130,61,3),dtype=np.uint8);rgb[::5,:,0]=255
            Image.fromarray(rgb).save(path);gray=Image.fromarray(rgb[:,:,0]);options=settings({'mode':'ai-strokes','smooth':0})
            with patch('ai_depth.Predictor',side_effect=AssertionError('Depth must not run')):
                height, meta=calculate(path,gray,None,options,root,predictor=lambda p:p[:,:,0]/255.)
            self.assertEqual(height.size,(61,130));self.assertFalse(meta['depthMixed']);self.assertEqual(meta['model'],'TEED');self.assertGreater(height.getextrema()[1],0);height.close()


if __name__=='__main__':unittest.main()
