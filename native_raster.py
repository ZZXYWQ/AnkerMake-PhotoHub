"""Version-checked changes to the native raster importer, without file interception.

Only the public editor module is read. Account and project data are not queried.
A breakpoint on an explicitly invoked pure sizing function supplies the original
module scope; it is removed and the page resumed in finally, before disconnect.
"""
import base64
import hashlib
import json
import os
import socket
import urllib.parse
from cdp_loader import CDP_PORT, _send, _receive

PROFILE = {'name': 'i18n-DRyMlxIt.js', 'sha256': 'afbdffa1d1a427ab70497e1657646904a0d9ce95e77346b483e74ef29cef47bf', 'patches': [['n=(e,n)=>e>3e4||n>3e4?`string_image_side_limit_exceeded`:e*n>16384e4?t[o]:null', 'n=(e,n)=>window.__EUFY_PHOTOCRAFT_LARGE_IMAGES===true?null:e>3e4||n>3e4?`string_image_side_limit_exceeded`:e*n>16384e4?t[o]:null'], ['if(l>524288e3)return s(`string_image_too_large`),!1;', 'if(window.__EUFY_PHOTOCRAFT_LARGE_IMAGES!==true&&l>524288e3)return s(`string_image_too_large`),!1;'], ['function gUe(e,t,n){return!t||!n?!1:e>47185920||Math.max(t,n)>11339||t*n>1e8}', 'function gUe(e,t,n){if(window.__EUFY_PHOTOCRAFT_LARGE_IMAGES===true)return!1;return!t||!n?!1:e>47185920||Math.max(t,n)>11339||t*n>1e8}'], ['kC=async()=>{let e=Z$();', 'kC=async()=>{if(window.__EUFY_PHOTOCRAFT_LARGE_IMAGES===true)return`keep`;let e=Z$();'], ['i=e.height,a=12800;if(r>a||i>a)', 'i=e.height,a=window.__EUFY_PHOTOCRAFT_LARGE_IMAGES===true?Infinity:12800;if(r>a||i>a)']]}
REVISION = '1.25.04-native-raster-1'


def patch_expression(raw):
    if hashlib.sha256(raw).hexdigest() != PROFILE['sha256']:
        raise ValueError('Unsupported native import module')
    source = raw.decode('utf-8')
    for old, new in PROFILE['patches']:
        if source.count(old) != 1:
            raise ValueError('Native import patch anchor mismatch')
    start = source.index('async function kUe(')
    end = source.index('var AUe=', start)
    check = source[start:end]
    for old, new in PROFILE['patches']:
        check = check.replace(old, new)
    check = check.replace('async function kUe(', 'async function PHNativeCheck(', 1)
    # Compile the original checker in its own module scope. Native integrity,
    # format, error and account-independent import behavior remain in place.
    return ("(()=>{if(window.__EPC_NATIVE_RASTER_PATCH===" + json.dumps(REVISION) + ")return true;"
            "O4();zC();AUe();zUe();const oldResize=kC,oldPlan=gUe,oldSize=SNe;"
            "kC=async()=>window.__EUFY_PHOTOCRAFT_LARGE_IMAGES===true?'keep':oldResize();"
            "gUe=(...args)=>window.__EUFY_PHOTOCRAFT_LARGE_IMAGES===true?false:oldPlan(...args);"
            + check + ";kUe=PHNativeCheck;"
            "SNe=async e=>{if(window.__EUFY_PHOTOCRAFT_LARGE_IMAGES!==true)return oldSize(e);"
            "const size=await D4(e);if(!size)return null;return {...size,url:e}};"
            "window.__EPC_NATIVE_IMPORT_FILE=file=>LUe({isDrop:true,selectFile:[file]});"
            "window.__EPC_NATIVE_RASTER_PATCH=" + json.dumps(REVISION) + ";return true})()")


def patch_native_import(websocket_url):
    parsed = urllib.parse.urlsplit(websocket_url)
    if (parsed.scheme != 'ws' or parsed.hostname != '127.0.0.1' or parsed.port != CDP_PORT
            or not parsed.path.startswith('/devtools/page/') or parsed.username
            or parsed.password or parsed.query or parsed.fragment):
        raise ValueError('Invalid native editor endpoint')
    with socket.create_connection(('127.0.0.1', CDP_PORT), timeout=3) as sock:
        sock.settimeout(5)
        with sock.makefile('rwb') as stream:
            key = base64.b64encode(os.urandom(16)).decode('ascii')
            stream.write((f'GET {parsed.path} HTTP/1.1\r\nHost: 127.0.0.1:{CDP_PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
            stream.flush()
            if not stream.readline(4096).startswith(b'HTTP/1.1 101 '):
                raise ConnectionError('Native patch websocket upgrade rejected')
            headers = {}
            for _ in range(64):
                line = stream.readline(4096)
                if line in (b'\r\n', b'\n'):
                    break
                name, value = line.split(b':', 1)
                headers[name.lower().strip()] = value.strip()
            expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
            if headers.get(b'sec-websocket-accept') != expected:
                raise ValueError('Native patch websocket handshake mismatch')
            seq, events = 0, []
            def send(method, params=None):
                nonlocal seq
                seq += 1
                _send(stream, 1, json.dumps({'id': seq, 'method': method, 'params': params or {}}, separators=(',', ':')).encode())
                return seq
            def call(method, params=None):
                request_id = send(method, params)
                for _ in range(1600):
                    reply = _receive(stream)
                    if reply.get('id') == request_id:
                        if 'error' in reply:
                            raise ValueError('Native patch CDP method failed')
                        return reply.get('result', {})
                    if reply.get('method'):
                        events.append(reply)
                raise ValueError('Native patch event bound exceeded')
            probe = call('Runtime.evaluate', {'expression': "(()=>({ready:window.__EPC_NATIVE_RASTER_PATCH===" + json.dumps(REVISION) + ",loaded:performance.getEntriesByType('resource').some(r=>{try{return new URL(r.name).origin===location.origin&&new URL(r.name).pathname.endsWith('/" + PROFILE['name'] + "')}catch{return false}})}))()", 'returnByValue': True, 'silent': True})
            value = probe.get('result', {}).get('value', {})
            if value.get('ready'):
                return 'ready'
            if not value.get('loaded'):
                return 'pending'
            enabled, breakpoint, paused = False, None, False
            try:
                call('Debugger.enable')
                enabled = True
                candidates = [r['params'] for r in events if r.get('method') == 'Debugger.scriptParsed' and r['params'].get('url', '').split('?')[0].endswith('/' + PROFILE['name'])]
                if len(candidates) != 1:
                    raise ValueError('Native module identity ambiguous')
                script = candidates[0]
                result = call('Debugger.getScriptSource', {'scriptId': script['scriptId']})
                expression = patch_expression(result.get('scriptSource', '').encode('utf-8'))
                function = call('Runtime.evaluate', {'expression': 'import(' + json.dumps(script['url']) + ').then(m=>m.v)', 'awaitPromise': True})
                object_id = function.get('result', {}).get('objectId')
                if not object_id:
                    raise ValueError('Native pure sizing function unavailable')
                breakpoint = call('Debugger.setBreakpointOnFunctionCall', {'objectId': object_id})['breakpointId']
                send('Runtime.callFunctionOn', {'objectId': object_id, 'functionDeclaration': 'function(){return this(1,1,1)}', 'returnByValue': True})
                for _ in range(1600):
                    reply = _receive(stream)
                    if reply.get('method') == 'Debugger.paused':
                        paused = True
                        frames = reply.get('params', {}).get('callFrames', [])
                        if not frames or frames[0].get('functionName') not in ('gUe', ''):
                            raise ValueError('Unexpected native sizing frame')
                        applied = call('Debugger.evaluateOnCallFrame', {'callFrameId': frames[0]['callFrameId'], 'expression': expression, 'returnByValue': True, 'silent': True})
                        if 'exceptionDetails' in applied or applied.get('result', {}).get('value') is not True:
                            raise ValueError('Native importer patch failed')
                        return 'ready'
                raise ValueError('Native sizing breakpoint not observed')
            finally:
                if breakpoint:
                    try: call('Debugger.removeBreakpoint', {'breakpointId': breakpoint})
                    except Exception: pass
                if paused:
                    try: call('Debugger.resume')
                    except Exception: pass
                if enabled:
                    try: call('Debugger.disable')
                    except Exception: pass
