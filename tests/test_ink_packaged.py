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
source = ROOT / 'dist/release-payload-0.6.1'
fixture = ROOT / 'tests' / ('ink-packaged-' + secrets.token_hex(4))
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
    assert status == 200 and json.loads(raw)['version'] == '0.6.1'
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
    duplicate = subprocess.Popen(args, env=env, creationflags=subprocess.CREATE_NO_WINDOW)
    assert duplicate.wait(timeout=15) == 0
    assert req('GET', '/health')[0] == 200
    (ROOT/'tests/ink-packaged-results.json').write_text(json.dumps({'pass': True, 'version':'0.6.1', 'authenticated':True, 'invalidMasksRejected':True, 'invalidPolicyRejected':True, 'pngArtifact':True, 'duplicateLauncher':True}, indent=2))
    print('PASS frozen bridge: native ink script, authentication, invalid masks, PNG save, duplicate launcher')
finally:
    p.terminate()
    p.wait(timeout=10)
