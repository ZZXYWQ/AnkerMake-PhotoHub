"""Offline TEED learned line detection, converted to a standalone relief field."""
import hashlib
import math
import os
from pathlib import Path
from PIL import Image, ImageOps
from ai_depth import render_field, starts

MODEL_FILE = 'teed.onnx'
MODEL_SHA = '20abca03c5eba9545633d032c88d7c8f20fd6d55ed85f2f2730482a97c78e6c3'


def capabilities(root):
    ready = (Path(root) / MODEL_FILE).is_file() and (Path(root) / 'LICENSE.txt').is_file()
    return {'ready': ready, 'name': 'TEED', 'experimental': True, 'offline': True,
            'message': '内置 AI 线条模型 · 离线运行' if ready else '内置 AI 线条模型缺失，请重新安装完整插件包'}


class Predictor:
    def __init__(self, root):
        import numpy as np
        import onnxruntime as ort
        model = Path(root) / MODEL_FILE
        if not capabilities(root)['ready'] or hashlib.file_digest(model.open('rb'), 'sha256').hexdigest() != MODEL_SHA:
            raise ValueError('AI 笔触模型缺失或校验失败，原设计未改变')
        options = ort.SessionOptions(); options.intra_op_num_threads = min(4, max(1, (os.cpu_count() or 2) // 2)); options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])
        self.mean = np.array([103.939, 116.779, 123.68], dtype=np.float32)[None, :, None, None]

    def __call__(self, patch):
        import numpy as np
        h, w = patch.shape[:2]
        padded = np.pad(patch, ((0, 1024-h), (0, 1024-w), (0, 0)), mode='edge')
        tensor = np.ascontiguousarray(padded[:, :, ::-1].transpose(2, 0, 1)[None], dtype=np.float32) - self.mean
        result = self.session.run(['edges'], {'image': tensor})[0][0, 0, :h, :w]
        if not np.isfinite(result).all():
            raise ValueError('AI 笔触返回无效数值')
        return result

    def close(self):
        self.session = None


def stitch(rgb, predict, progress=lambda p: None, cancelled=lambda: False, tile=1024):
    import numpy as np
    h, w = rgb.shape[:2]
    ys, xs = starts(h, tile), starts(w, tile)
    values = np.zeros((h, w), dtype=np.float32); weights = np.zeros_like(values)
    for index, (y, x) in enumerate((y, x) for y in ys for x in xs):
        if cancelled():
            raise InterruptedError('AI 笔触计算已取消')
        patch = rgb[y:y+tile, x:x+tile]; ph, pw = patch.shape[:2]
        result = np.asarray(predict(patch), dtype=np.float32)
        if result.shape != (ph, pw) or not np.isfinite(result).all():
            raise ValueError('AI 笔触输出尺寸或数值无效')
        fy = np.minimum(1, np.minimum(np.arange(ph)+1, np.arange(ph,0,-1))/64).astype(np.float32)
        fx = np.minimum(1, np.minimum(np.arange(pw)+1, np.arange(pw,0,-1))/64).astype(np.float32)
        feather = fy[:,None] * fx[None,:]
        values[y:y+ph,x:x+pw] += result * feather; weights[y:y+ph,x:x+pw] += feather
        progress(20 + round(55*(index+1)/(len(ys)*len(xs))))
    values /= weights
    return values, len(ys)*len(xs)


def calculate(source, gray, alpha, options, model_root, progress=lambda p: None, cancelled=lambda: False, predictor=None):
    import numpy as np
    w, h = gray.size
    scale = min(1., 1024/min(w,h), math.sqrt(28*1024*1024/(w*h)))
    size = max(1,round(w*scale)), max(1,round(h*scale))
    with Image.open(source) as original:
        orientation, stored = original.getexif().get(274,1), original.size
        original.draft('RGB', size[::-1] if orientation in (5,6,7,8) else size)
        with ImageOps.exif_transpose(original) as oriented, oriented.convert('RGB') as rgb, rgb.resize(size,Image.Resampling.LANCZOS) as resized:
            analysis = np.array(resized)
    rotation = options.get('aiRotation','auto')
    turns = (-int(rotation)//90)%4 if rotation!='auto' else (1 if orientation==6 else 3 if orientation==8 else 0) if stored[0]>stored[1]*8 else 0
    if turns: analysis=np.rot90(analysis,turns)
    owned = predictor is None; predict = predictor or Predictor(model_root)
    try: edges, count = stitch(analysis,predict,progress,cancelled)
    finally:
        if owned: predict.close()
    del analysis
    if turns: edges=np.rot90(edges,-turns)
    visible = np.ones(edges.shape,dtype=bool)
    if alpha is not None:
        with alpha.resize(size,Image.Resampling.NEAREST) as mask: visible=np.asarray(mask)>0
    threshold = .02 + .3*options['background']/100
    samples=edges[visible & (edges>threshold)]
    if samples.size==0: raise ValueError('AI 未识别出有效笔触，请降低纸面抑制或更换图片；原设计未改变')
    upper=max(threshold+1e-4,float(np.quantile(samples,.99)))
    field=np.clip((edges-threshold)/(upper-threshold),0,1).astype(np.float32)
    field **= 2**((50-options['strength'])/65)
    if options['invert']:field=1-field
    output=render_field(field,(w,h),alpha,options,progress,cancelled)
    return output,{'model':'TEED','modelSha256':MODEL_SHA,'experimental':True,'analysisSize':list(size),'outputSize':[w,h],
                   'tiles':count,'overlapPixels':512,'threshold':threshold,'globalUpper':upper,'semanticRotationQuarterTurns':turns,
                   'heightMeaning':'AI-line-probability-white-raised','runtime':'bundled-onnxruntime-cpu','depthMixed':False}
