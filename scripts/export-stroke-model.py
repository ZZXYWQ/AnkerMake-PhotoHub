"""Build-time TEED export. Upstream source/weights remain archived on the work drive."""
import argparse
import hashlib
import json
import sys
from pathlib import Path


def main():
    import torch
    import numpy as np
    import onnxruntime as ort
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    weights = args.source / '5_model.pth'
    expected = '0322caf70f588355aaaf59c2bf5872b21a4b7e9f679971a7a3bb1f69b56a01ba'
    if hashlib.file_digest(weights.open('rb'), 'sha256').hexdigest() != expected:
        raise ValueError('TEED source checkpoint checksum mismatch')
    sys.path.insert(0, str(args.source))
    namespace = {'__name__': 'teed_export'}
    source = (args.source / 'ted.py').read_text(encoding='utf8')
    source = source.replace('from utils.img_processing import count_parameters', '')
    exec(compile(source, str(args.source / 'ted.py'), 'exec'), namespace)
    model = namespace['TED']().eval()
    model.load_state_dict(torch.load(weights, map_location='cpu', weights_only=True))
    torch.set_num_threads(4)

    class Export(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.net = model

        def forward(self, image):
            return torch.sigmoid(torch.stack(self.net(image), dim=0).mean(dim=0))

    wrapper = Export().eval()
    sample = torch.rand(1, 3, 1024, 1024) * 255
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with torch.inference_mode():
        torch.onnx.export(wrapper, (sample,), str(args.output), input_names=['image'], output_names=['edges'], opset_version=17, dynamo=False, external_data=False)
        reference = wrapper(sample).cpu().numpy()
    options = ort.SessionOptions(); options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(args.output), sess_options=options, providers=['CPUExecutionProvider'])
    result = session.run(None, {'image': sample.numpy()})[0]
    np.testing.assert_allclose(result, reference, rtol=.002, atol=.002)
    meta = {'name': 'TEED', 'license': 'MIT', 'source': 'https://github.com/xavysp/TEED',
            'revision': '40fa4b1391dc6424f88989d0ca75d5b592c8681d', 'checkpoint': 'checkpoints/BIPED/5/5_model.pth',
            'sourceSha256': expected, 'sha256': hashlib.file_digest(args.output.open('rb'), 'sha256').hexdigest(),
            'inputSize': 1024, 'input': 'BGR float32 0..255 minus BIPED mean',
            'onnxValidationMaxError': float(np.max(np.abs(result - reference)))}
    args.output.with_suffix('.json').write_text(json.dumps(meta, indent=2), encoding='utf8')
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
