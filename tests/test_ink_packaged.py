"""Frozen bridge smoke test in an isolated fixture, without host/printer actions."""
import base64
import http.client
import io
from PIL import Image
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
source = Path(os.environ.get('PH_STAGE_ROOT', str(ROOT / ('dist/release-payload-' + version))))
fixture = Path(os.environ.get('PH_TEST_ROOT', str(ROOT / 'tests'))) / ('ink-packaged-' + secrets.token_hex(4))
shutil.copytree(source, fixture / 'payload')
token = secrets.token_hex(32)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
config = fixture / 'config.json'
config.write_text(json.dumps({'token': token, 'port': port, 'hostExecutable': str(fixture/'absent-host.exe')}))
env = dict(os.environ, LOCALAPPDATA=str(fixture/'data'))
args = [str(fixture/'payload/bridge.exe'), '--headless-test', '--config', str(config)]
p = subprocess.Popen(args, env=env, creationflags=subprocess.CREATE_NO_WINDOW)

def req(method, path, body=None, authorized=True):
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
    try:
        conn.request(method, path, None if body is None else json.dumps(body),
                     {'X-EPC-Token': token if authorized else 'bad', 'Content-Type': 'application/json'})
        r = conn.getresponse()
        return r.status, r.read()
    finally:
        conn.close()

try:
    for _ in range(100):
        try:
            status, raw = req('GET', '/health')
            break
        except OSError:
            if p.poll() is not None:
                raise
            time.sleep(.1)
    assert status == 200 and json.loads(raw)['version'] == version
    assert req('GET', '/ink/status', authorized=False)[0] == 403
    for mask in (-1, 16, 'C', True):
        status, raw = req('POST', '/ink/mask', {'mask': mask})
        assert status == 400 and '0～15' in json.loads(raw)['error']
    assert req('GET', '/ink-control.js')[0] == 200
    assert req('GET', '/ink-layer.js')[0] == 200
    assert req('POST', '/ink/policy/arm', {'enabled': 'yes'})[0] == 400
    assert req('POST', '/ink/policy/arm', {'enabled': True}, authorized=False)[0] == 403
    buffer = io.BytesIO()
    Image.new('RGBA', (1, 1), (255, 0, 0, 255)).save(buffer, format='PNG')
    png = base64.b64encode(buffer.getvalue()).decode()
    status, raw = req('POST', '/artifacts', {'dataUrl': 'data:image/png;base64,'+png})
    assert status == 200 and json.loads(raw)['width'] == 1, (status, raw)
    status, raw = req('POST', '/raster/prepare', {'dataUrl': 'data:image/png;base64,'+png, 'fileName': 'test.png'})
    prepared = json.loads(raw)
    assert status == 200 and prepared['singleObject'] and 'tiles' not in prepared and prepared['dataUrl'].endswith(png), (status, raw)
    relief_image = Image.new('L', (16, 16), 255)
    relief_image.paste(0, (3, 3, 12, 12))
    relief_buffer = io.BytesIO(); relief_image.save(relief_buffer, format='PNG')
    relief_url = 'data:image/png;base64,' + base64.b64encode(relief_buffer.getvalue()).decode()
    assert req('POST', '/relief/jobs', {'dataUrl': relief_url}, authorized=False)[0] == 403
    heights = {}
    for mode, detail in [('ink', 65), ('surface', 35)]:
        status, raw = req('POST', '/relief/jobs', {'dataUrl': relief_url, 'mode': mode, 'detail': detail})
        assert status == 200, raw
        job = json.loads(raw)['id']
        for _ in range(100):
            status, raw = req('GET', '/relief/jobs/' + job)
            if json.loads(raw)['status'] not in ('queued', 'running'): break
            time.sleep(.05)
        status, raw = req('GET', '/relief/jobs/' + job + '/result')
        assert status == 200 and json.loads(raw)['maxGrayValue'] > 0, raw
        with Image.open(io.BytesIO(base64.b64decode(json.loads(raw)['grayDataUrl'].split(',')[1]))) as relief:
            assert relief.size == (16, 16)
            heights[mode] = relief.tobytes()
    assert heights['ink'] != heights['surface'], 'both menu algorithms must produce distinct height data'
    assert req('POST', '/relief/jobs/' + job + '/cancel', {})[0] == 200
    assert req('GET', '/relief/jobs/' + job + '/result')[0] == 400
    duplicate = subprocess.Popen(args, env=env, creationflags=subprocess.CREATE_NO_WINDOW)
    assert duplicate.wait(timeout=15) == 0
    assert req('GET', '/health')[0] == 200
    (fixture/'ink-packaged-results.json').write_text(json.dumps({'pass': True, 'version':version, 'authenticated':True, 'invalidMasksRejected':True, 'invalidPolicyRejected':True, 'pngArtifact':True, 'rasterPrepare':True, 'duplicateLauncher':True}, indent=2))
    print('PASS frozen bridge: ink, authentication, original raster, local relief create/status/result/cancel, duplicate launcher')
finally:
    # PyInstaller onefile has a bootloader child; terminate this owned test tree.
    if p.poll() is None:
        subprocess.run(['taskkill', '/PID', str(p.pid), '/T', '/F'],
                       capture_output=True, check=False)
    p.wait(timeout=10)
