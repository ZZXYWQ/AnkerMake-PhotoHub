"""Independent PhotoCraft 0.9.0 capability-scoped authenticated control client."""
from __future__ import annotations
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import threading
import time

RUNTIME = Path(__file__).parent / 'runtime' / 'photocraft-0.9.0-windows-x64-portable'

class ControlError(RuntimeError):
    pass

class PhotoCraft:
    def __init__(self, workspace, port=0, headless=False, runtime=RUNTIME, hidden=False):
        self.workspace = Path(workspace).resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.runtime = Path(runtime).resolve()
        self.headless = headless
        self.hidden = hidden
        self.port = port
        self.process = None
        self.token_file = self.workspace / '.control-token'
        self.lock = threading.RLock()
        self.log = None

    def start(self):
        if self.process and self.process.poll() is None:
            return self
        if not self.port:
            with socket.socket() as s:
                s.bind(('127.0.0.1', 0))
                self.port = s.getsockname()[1]
        # A fresh token belongs only to this plugin session, never to another PhotoCraft.
        self.token_file.write_text(secrets.token_hex(32), encoding='ascii')
        if os.name == 'nt':
            account = subprocess.check_output(['whoami'], text=True).strip()
            subprocess.run(['icacls', str(self.token_file), '/inheritance:r', '/grant:r', account + ':F'], check=True, stdout=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
        executable = self.runtime / ('photocraft-cli.exe' if self.headless else 'photocraft.exe')
        args = [str(executable)] + (['serve', '--port', str(self.port)] if self.headless else ['--control', str(self.port)])
        args += ['--control-token-file', str(self.token_file), '--automation-read-root', str(self.workspace), '--automation-write-root', str(self.workspace)]
        self.log = (self.workspace / 'photocraft.log').open('ab')
        startupinfo = None
        if os.name == 'nt' and self.hidden:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 0
        self.process = subprocess.Popen(args, cwd=self.runtime, stdout=self.log, stderr=self.log, startupinfo=startupinfo, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' and self.headless else 0)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise ControlError('PhotoCraft exited; see photocraft.log')
            try:
                with socket.create_connection(('127.0.0.1', self.port), timeout=.3):
                    return self
            except OSError:
                time.sleep(.2)
        raise ControlError('PhotoCraft did not start in 30 seconds')

    def call(self, method, params=None):
        # Each call authenticates a fresh socket: no stale idle connection, no edit retry.
        with self.lock:
            token = self.token_file.read_text(encoding='ascii').strip()
            with socket.create_connection(('127.0.0.1', self.port), timeout=5) as sock:
                sock.settimeout(55)
                with sock.makefile('rwb') as stream:
                    for ident, name, values in [('auth', 'auth', {'token': token}), ('request', method, params or {})]:
                        stream.write((json.dumps({'id': ident, 'method': name, 'params': values}) + '\n').encode())
                        stream.flush()
                        raw = stream.readline(64 * 1024 * 1024)
                        if not raw:
                            raise ControlError('Connection closed; operation may have completed. Inspect before retrying.')
                        reply = json.loads(raw)
                        if reply.get('id') != ident or not reply.get('ok'):
                            raise ControlError(str(reply.get('error', 'Invalid response ID')))
                    return reply.get('result')

    def relative_path(self, path):
        p = Path(path)
        if not p.is_absolute():
            p = self.workspace / p
        return p.resolve().relative_to(self.workspace).as_posix()

    def create(self, width, height, background='transparent', name='eufyMake artwork'):
        params = dict(width=int(width), height=int(height), background=background, mode='rgb', depth=8, name=name)
        return self.call('doc.new', params) if self.headless else self.execute('file.new', params)

    def open(self, path):
        return self.call('doc.open' if self.headless else 'app.open', {'path': self.relative_path(path)})

    def save(self, path):
        return self.call('doc.save' if self.headless else 'app.save', {'path': self.relative_path(path)})

    def export_png(self, path):
        if Path(path).suffix.lower() != '.png':
            raise ValueError('PNG export requires .png extension')
        return self.save(path)

    def execute(self, command, params=None):
        return self.call('engine.execute', {'command': command, 'params': params or {}})

    def inspect(self):
        return self.call('doc.inspect') if self.headless else self.execute('document.inspect')

    def close(self):
        if self.process and self.process.poll() is None:
            if self.headless:
                self.process.terminate()
            else:
                self.call('app.quit')
            self.process.wait(timeout=10)
        if self.log:
            self.log.close()
