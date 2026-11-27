"""Bind the verified native preview scene without invoking any preview/print handler."""
import base64
import hashlib
import json
import os
import socket
import urllib.parse
import urllib.request
from cdp_loader import CDP_PORT, MAX_MESSAGE, NoRedirects, allowed_editor, _send, _receive

EDITOR_SHA = 'd304207c3e1a44c20936384d6a85544410b3f753ff1ae87d07247c4e70e7d709'


def prepare_preview(page_url):
    if not allowed_editor(page_url):
        raise ValueError('Invalid preview editor URL')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirects())
    with opener.open(f'http://127.0.0.1:{CDP_PORT}/json/list', timeout=3) as response:
        raw = response.read(MAX_MESSAGE + 1)
    if len(raw) > MAX_MESSAGE:
        raise ValueError('Target listing too large')
    targets = [t for t in json.loads(raw) if t.get('type') == 'page' and t.get('url') == page_url]
    if len(targets) != 1:
        raise ValueError('Preview target is not unique')
    endpoint = urllib.parse.urlsplit(targets[0]['webSocketDebuggerUrl'])
    if endpoint.scheme != 'ws' or endpoint.hostname != '127.0.0.1' or endpoint.port != CDP_PORT or not endpoint.path.startswith('/devtools/page/') or endpoint.query or endpoint.fragment or endpoint.username:
        raise ValueError('Invalid preview CDP endpoint')
    with socket.create_connection(('127.0.0.1', CDP_PORT), timeout=3) as sock:
        sock.settimeout(10)
        with sock.makefile('rwb') as stream:
            key = base64.b64encode(os.urandom(16)).decode('ascii')
            stream.write((f'GET {endpoint.path} HTTP/1.1\r\nHost: 127.0.0.1:{CDP_PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode('ascii'))
            stream.flush()
            if not stream.readline(4096).startswith(b'HTTP/1.1 101 '):
                raise ValueError('Preview CDP upgrade failed')
            headers = {}
            for _ in range(64):
                line = stream.readline(4096)
                if line in (b'\r\n', b'\n'):
                    break
                name, value = line.split(b':', 1)
                headers[name.lower().strip()] = value.strip()
            expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
            if headers.get(b'sec-websocket-accept') != expected:
                raise ValueError('Preview CDP handshake mismatch')
            seq = 0

            def call(method, **params):
                nonlocal seq
                seq += 1
                _send(stream, 1, json.dumps({'id': seq, 'method': method, 'params': params}).encode())
                for _ in range(1600):
                    reply = _receive(stream)
                    if reply.get('id') == seq:
                        result = reply.get('result', {})
                        if 'error' in reply or 'exceptionDetails' in result:
                            raise ValueError('Native preview interface preparation failed')
                        return result
                raise ValueError('Native preview reply bound exceeded')

            ready = call('Runtime.evaluate', expression='window.__PH_NATIVE_PREVIEW_SCENE_READY===3', returnByValue=True)
            if ready.get('result', {}).get('value'):
                return {'ready': True}
            identity = call('Runtime.evaluate', expression="(async()=>{const u=performance.getEntriesByType('resource').map(x=>x.name).find(u=>new URL(u).origin===location.origin&&new URL(u).pathname.endsWith('/2d-editor-DTNHGTzM.js'));if(!u)return null;const r=await fetch(u,{cache:'force-cache'});if(!r.ok)return null;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('')})()", awaitPromise=True, returnByValue=True)
            if identity.get('result', {}).get('value') != EDITOR_SHA:
                raise ValueError('Native preview editor version is not verified')
            # Bound the raster stage before canvas clones, PNGs and GPU buffers
            # are allocated. The printer path continues to call the original.
            raster = call('Runtime.evaluate', expression="(async()=>{const u=performance.getEntriesByType('resource').map(x=>x.name).find(u=>new URL(u).origin===location.origin&&new URL(u).pathname.endsWith('/cavasUtil-ByCG8TNr.js'));if(!u)return null;const r=await fetch(u,{cache:'force-cache'});if(!r.ok)return null;const source=await r.text();return {source,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(x=>x.toString(16).padStart(2,'0')).join('')}})()", awaitPromise=True, returnByValue=True)
            raster = raster.get('result', {}).get('value') or {}
            if raster.get('hash') != 'e8476b5f1cbe1de5d8da12d173f672ce6e43db6f5dccc32c5769089c1c05412e':
                raise ValueError('Native preview raster version is not verified')
            source = raster['source']
            start = source.index('async getCanvasGrayImgOf3dRelief(')
            end = source.index('async get3dReliefColorImg(', start)
            method = source[start:end].replace('async getCanvasGrayImgOf3dRelief(', 'async function(', 1)
            anchor = 'var T=X.scaleToWidth(S.format_size_w,m,_);'
            if method.count(anchor) != 1:
                raise ValueError('Preview raster sizing anchor mismatch')
            method = method.replace(anchor, '_=Math.min(_,4096*25.4/Math.max(S.format_size_w,m));' + anchor)
            expression = "(()=>{const manager=ci.getInstance();if(manager.__phRasterPreviewBounded)return true;const original=manager.getCanvasGrayImgOf3dRelief,bounded=" + method + ";manager.getCanvasGrayImgOf3dRelief=function(...args){if(!window.__PH_PREVIEW_SESSION_ACTIVE||args[4]===true)return original.apply(this,args);window.EPCReliefPreview.stats.rasterBounded=(window.EPCReliefPreview.stats.rasterBounded||0)+1;const controller=window.__EPC_COMPOSITION;controller?.snapshot?.();if(controller?.sync?.().mode==='top')controller.validate();return bounded.apply(this,args)};manager.__phRasterPreviewBounded=true;return true})()"
            manager = call('Runtime.evaluate', expression='window.__EPC_HOST.manager()')['result']['objectId']
            sizing = call('Runtime.evaluate', expression='window.__EPC_HOST.manager().getCanvasDpi')['result']['objectId']
            breakpoint = None
            paused = False
            try:
                call('Debugger.enable')
                breakpoint = call('Debugger.setBreakpointOnFunctionCall', objectId=sizing)['breakpointId']
                seq += 1
                _send(stream, 1, json.dumps({'id': seq, 'method': 'Runtime.callFunctionOn', 'params': {'objectId': manager, 'functionDeclaration': 'function(){return this.getCanvasDpi()}', 'returnByValue': True}}).encode())
                for _ in range(1600):
                    event = _receive(stream)
                    if event.get('method') == 'Debugger.paused':
                        paused = True
                        frame = event['params']['callFrames'][0]
                        applied = call('Debugger.evaluateOnCallFrame', callFrameId=frame['callFrameId'], expression=expression, returnByValue=True)
                        if applied.get('result', {}).get('value') is not True:
                            raise ValueError('Native raster preview protection failed')
                        break
                else:
                    raise ValueError('Native preview sizing frame unavailable')
            finally:
                if breakpoint:
                    try:
                        call('Debugger.removeBreakpoint', breakpointId=breakpoint)
                    except Exception:
                        pass
                if paused:
                    try:
                        call('Debugger.resume')
                    except Exception:
                        pass
                call('Debugger.disable')
            handler = call('Runtime.evaluate', expression="(()=>{const b=document.querySelector('button[class*=\"_ButtonPreview_\"]');if(!b)return null;return b[Object.keys(b).find(k=>k.startsWith('__reactProps'))]?.onClick})()")
            object_id = handler.get('result', {}).get('objectId')
            if not object_id:
                raise ValueError('Native preview button is not ready')
            props = call('Runtime.getProperties', objectId=object_id)
            scopes = next((p['value']['objectId'] for p in props.get('internalProperties', []) if p['name'] == '[[Scopes]]'), None)
            if not scopes:
                raise ValueError('Native preview module scope is unavailable')
            for scope in call('Runtime.getProperties', objectId=scopes, ownProperties=True).get('result', []):
                value = scope.get('value', {})
                if value.get('description') != 'Module':
                    continue
                module_props = call('Runtime.getProperties', objectId=value['objectId'], ownProperties=True).get('result', [])
                engine = next((p['value']['objectId'] for p in module_props if p['name'] == 'po' and p.get('value', {}).get('objectId')), None)
                if not engine:
                    continue
                for prop in module_props:
                    if prop['name'] == 'QA' and prop.get('value', {}).get('objectId'):
                        applied = call('Runtime.callFunctionOn', objectId=prop['value']['objectId'], functionDeclaration="function(engine){if(!window.EPCReliefPreview?.installScene||!window.EPCReliefTiles)throw Error('Preview extension is not ready');const ok=window.EPCReliefPreview.installScene(this.prototype,engine);if(ok)window.__PH_NATIVE_PREVIEW_SCENE_READY=3;return ok}", arguments=[{'objectId': engine}], returnByValue=True)
                        if applied.get('result', {}).get('value') is True:
                            return {'ready': True}
            raise ValueError('Verified native preview scene was not found')
