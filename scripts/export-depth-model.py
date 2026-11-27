"""Build-time export only; packaged installations use bundled ONNX Runtime."""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    import numpy as np
    import onnxruntime as ort
    import torch
    from transformers import AutoModelForDepthEstimation
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    original = args.source / 'model.safetensors'
    expected = '3152477ce0d8d6978d76b995120de97cb5b928701fd0f817769f59e249a16b70'
    if hashlib.file_digest(original.open('rb'), 'sha256').hexdigest() != expected:
        raise ValueError('Official model checksum mismatch')
    torch.set_num_threads(4)
    model = AutoModelForDepthEstimation.from_pretrained(args.source, local_files_only=True, attn_implementation='eager').eval()

    class Export(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.model = model

        def forward(self, pixel_values):
            return self.model(pixel_values=pixel_values).predicted_depth

    wrapper = Export().eval()
    sample = torch.randn(1, 3, 518, 518)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with torch.inference_mode():
        torch.onnx.export(wrapper, (sample,), str(args.output), input_names=['pixel_values'], output_names=['depth'], opset_version=17, dynamo=False, external_data=False)
        expected_output = wrapper(sample).cpu().numpy()
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(args.output), sess_options=options, providers=['CPUExecutionProvider'])
    result = session.run(None, {'pixel_values': sample.numpy()})[0]
    np.testing.assert_allclose(result, expected_output, rtol=.002, atol=.002)
    metadata = {'name': 'Depth Anything V2 Small', 'license': 'Apache-2.0', 'experimental': True,
                'source': 'https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf',
                'revision': '5426e4f0f36572d16453bbda7a8389317b1bef99', 'sourceSha256': expected,
                'sha256': hashlib.file_digest(args.output.open('rb'), 'sha256').hexdigest(),
                'inputSize': 518, 'mean': [.485, .456, .406], 'std': [.229, .224, .225],
                'onnxValidationMaxError': float(np.max(np.abs(result - expected_output)))}
    args.output.with_suffix('.json').write_text(json.dumps(metadata, indent=2), encoding='utf8')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
