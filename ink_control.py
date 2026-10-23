# AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only; other host versions unsupported.
"""Version-checked, current-user native RIP channel controller. No printer commands."""
import ctypes as C
from ctypes import wintypes as W
import hashlib
import os
from pathlib import Path
import threading
import time

HOST_SHA = 'ab65f2f978018460b24d9d6397c91be073e95822e0497094b5ab02a495d10c97'
RIP_SHA = '17a8593d0517e205e8131d924b9e156211ea4f50210f8bfe575cdcecc438c849'


class State(C.Structure):
    _fields_ = [(n, C.c_uint32) for n in ('magic', 'version', 'pid')] + [
        (n, C.c_int32) for n in ('ready', 'fault', 'requested', 'effective', 'busy',
                                'sequence', 'acknowledged', 'command', 'result')] + [
        (n, C.c_int64) for n in ('rows', 'files', 'bytes')] + [
        ('before', C.c_int64 * 6), ('after', C.c_int64 * 6),
        ('policyRequired', C.c_int32), ('policyActive', C.c_int32), ('policyPixels', C.c_int64)]


class ProcessEntry(C.Structure):
    _fields_ = [('size', W.DWORD), ('usage', W.DWORD), ('pid', W.DWORD),
                ('heap', C.c_size_t), ('module', W.DWORD), ('threads', W.DWORD),
                ('parent', W.DWORD), ('priority', W.LONG), ('flags', W.DWORD),
                ('name', W.WCHAR * 260)]


class ModuleEntry(C.Structure):
    _fields_ = [('size', W.DWORD), ('moduleId', W.DWORD), ('pid', W.DWORD),
                ('globalUsage', W.DWORD), ('usage', W.DWORD), ('base', C.c_void_p),
                ('length', W.DWORD), ('handle', W.HMODULE),
                ('name', W.WCHAR * 256), ('path', W.WCHAR * 260)]


class InkController:
    def __init__(self, base, config):
        self.base = Path(base)
        self.host = Path(config.get('hostExecutable') or
                         Path(os.environ['LOCALAPPDATA']) / 'eufyMake Studio/eufymake studio.exe')
        self.lock = threading.Lock()
        self.pid = self.mapping = self.view = 0
        self.k = C.WinDLL('kernel32', use_last_error=True)
        signatures = {
            'CreateToolhelp32Snapshot': (W.HANDLE, [W.DWORD, W.DWORD]),
            'Process32FirstW': (W.BOOL, [W.HANDLE, C.POINTER(ProcessEntry)]),
            'Process32NextW': (W.BOOL, [W.HANDLE, C.POINTER(ProcessEntry)]),
            'Module32FirstW': (W.BOOL, [W.HANDLE, C.POINTER(ModuleEntry)]),
            'Module32NextW': (W.BOOL, [W.HANDLE, C.POINTER(ModuleEntry)]),
            'CloseHandle': (W.BOOL, [W.HANDLE]),
            'OpenProcess': (W.HANDLE, [W.DWORD, W.BOOL, W.DWORD]),
            'QueryFullProcessImageNameW': (W.BOOL, [W.HANDLE, W.DWORD, W.LPWSTR, C.POINTER(W.DWORD)]),
            'OpenFileMappingW': (W.HANDLE, [W.DWORD, W.BOOL, W.LPCWSTR]),
            'MapViewOfFile': (C.c_void_p, [W.HANDLE, W.DWORD, W.DWORD, W.DWORD, C.c_size_t]),
            'UnmapViewOfFile': (W.BOOL, [C.c_void_p]),
            'VirtualAllocEx': (C.c_void_p, [W.HANDLE, C.c_void_p, C.c_size_t, W.DWORD, W.DWORD]),
            'VirtualFreeEx': (W.BOOL, [W.HANDLE, C.c_void_p, C.c_size_t, W.DWORD]),
            'WriteProcessMemory': (W.BOOL, [W.HANDLE, C.c_void_p, C.c_void_p, C.c_size_t, C.POINTER(C.c_size_t)]),
            'CreateRemoteThread': (W.HANDLE, [W.HANDLE, C.c_void_p, C.c_size_t, C.c_void_p, C.c_void_p, W.DWORD, C.POINTER(W.DWORD)]),
            'WaitForSingleObject': (W.DWORD, [W.HANDLE, W.DWORD]),
            'GetModuleHandleW': (W.HMODULE, [W.LPCWSTR]),
            'GetProcAddress': (C.c_void_p, [W.HMODULE, C.c_char_p]),
            'GetModuleHandleExW': (W.BOOL, [W.DWORD, C.c_void_p, C.POINTER(W.HMODULE)]),
            'GetModuleFileNameW': (W.DWORD, [W.HMODULE, W.LPWSTR, W.DWORD]),
        }
        for name, (restype, args) in signatures.items():
            f = getattr(self.k, name)
            f.restype, f.argtypes = restype, args

    def start(self):
        # Load once per host process, including before the user opens ink settings.
        # A closed host is normal; no input hooks or rapid retry loop are used.
        def run():
            while True:
                try:
                    if self._find() != self.pid or not self.view:
                        self.status()
                except (OSError, ValueError):
                    pass
                time.sleep(3)
        threading.Thread(target=run, name='PhotoHubInkLoader', daemon=True).start()

    def _modules(self, pid):
        snap = self.k.CreateToolhelp32Snapshot(0x18, pid)
        if snap == C.c_void_p(-1).value:
            raise OSError('无法读取 eufyMake 模块列表')
        try:
            e = ModuleEntry(size=C.sizeof(ModuleEntry))
            good = self.k.Module32FirstW(snap, C.byref(e))
            while good:
                yield e.name.lower(), int(e.base), e.path
                good = self.k.Module32NextW(snap, C.byref(e))
        finally:
            self.k.CloseHandle(snap)

    def _find(self):
        snap = self.k.CreateToolhelp32Snapshot(2, 0)
        if snap == C.c_void_p(-1).value:
            raise OSError('无法读取本机进程')
        try:
            e = ProcessEntry(size=C.sizeof(ProcessEntry))
            good = self.k.Process32FirstW(snap, C.byref(e))
            found = []
            while good:
                if e.name.lower() == self.host.name.lower():
                    p = self.k.OpenProcess(0x1000, False, e.pid)
                    if p:
                        try:
                            name, size = C.create_unicode_buffer(32768), W.DWORD(32768)
                            if self.k.QueryFullProcessImageNameW(p, 0, name, C.byref(size)) and Path(name.value).resolve() == self.host.resolve():
                                found.append(int(e.pid))
                        finally:
                            self.k.CloseHandle(p)
                good = self.k.Process32NextW(snap, C.byref(e))
            if len(found) != 1:
                raise ValueError('请只打开一个 eufyMake 主程序后再设置墨路')
            return found[0]
        finally:
            self.k.CloseHandle(snap)

    def _connect(self, pid):
        m = self.k.OpenFileMappingW(0xF001F, False, f'Local\\PhotoHubInk-{pid}')
        if not m:
            return False
        view = self.k.MapViewOfFile(m, 0xF001F, 0, 0, C.sizeof(State))
        if not view:
            self.k.CloseHandle(m)
            return False
        if self.view:
            self.k.UnmapViewOfFile(self.view)
            self.k.CloseHandle(self.mapping)
        self.pid, self.mapping, self.view = pid, m, view
        return True

    def _inject(self, pid):
        module = (self.base / 'native/PhotoHubInk.dll').resolve()
        if not module.is_file():
            raise ValueError('缺少墨路控制组件，请重新安装 PhotoHub')
        for path, expected in ((self.host, HOST_SHA), (self.host.parent / 'ColorEngineAPI.dll', RIP_SHA)):
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError('当前 eufyMake 原生版本不匹配，已拒绝启用墨路过滤')
        modules = list(self._modules(pid))
        if not any(n == 'colorengineapi.dll' for n, _, _ in modules):
            raise ValueError('原生 RIP 尚未就绪，请等待项目载入后重试')
        if any(n == module.name.lower() for n, _, _ in modules):
            # Never inject a second copy over an initializing or failed component.
            return
        local = self.k.GetProcAddress(self.k.GetModuleHandleW('kernel32.dll'), b'LoadLibraryW')
        owner = W.HMODULE()
        if not self.k.GetModuleHandleExW(6, local, C.byref(owner)):
            raise OSError('无法解析本机模块加载入口')
        name = C.create_unicode_buffer(32768)
        self.k.GetModuleFileNameW(owner, name, 32768)
        remote_base = next((base for n, base, _ in modules if n == Path(name.value).name.lower()), None)
        if remote_base is None:
            raise OSError('无法匹配目标加载模块')
        entry = remote_base + local - owner.value
        process = self.k.OpenProcess(0x43A, False, pid)
        if not process:
            raise OSError('Windows 拒绝加载墨路控制组件')
        memory = thread = 0
        finished = False
        try:
            raw = (str(module) + '\0').encode('utf-16-le')
            memory = self.k.VirtualAllocEx(process, None, len(raw), 0x3000, 4)
            written = C.c_size_t()
            if not memory or not self.k.WriteProcessMemory(process, memory, raw, len(raw), C.byref(written)) or written.value != len(raw):
                raise OSError('无法传入组件路径')
            thread = self.k.CreateRemoteThread(process, None, 0, entry, memory, 0, None)
            if not thread:
                raise OSError('Windows 拒绝启动组件加载')
            finished = self.k.WaitForSingleObject(thread, 15000) == 0
            if not finished:
                raise OSError('墨路组件加载超时；请重新启动 eufyMake 后重试')
        finally:
            if thread:
                self.k.CloseHandle(thread)
            # Keep the tiny path allocation alive if the target loader timed out.
            if memory and (finished or not thread):
                self.k.VirtualFreeEx(process, memory, 0, 0x8000)
            self.k.CloseHandle(process)
        if not any(Path(p).resolve() == module for _, _, p in self._modules(pid)):
            raise OSError('墨路组件未能加载，请检查安全软件提示')

    def _ensure(self):
        pid = self._find()
        if pid != self.pid or not self.view:
            if not self._connect(pid):
                self._inject(pid)
                for _ in range(150):
                    if self._connect(pid):
                        break
                    time.sleep(.03)
                else:
                    raise OSError('墨路组件连接超时')
        s = State.from_address(self.view)
        for _ in range(150):
            if s.ready or s.fault:
                break
            time.sleep(.03)
        if s.magic != 0x31494850 or s.version != 2 or s.pid != pid or not s.ready:
            raise ValueError(f'墨路组件未就绪（{s.fault}）；本次未应用通道设置')
        return s

    def status(self, mask=None, policy=None):
        if mask is not None and (type(mask) is not int or not 0 <= mask <= 15):
            raise ValueError('墨路掩码必须是 0～15 的整数')
        if policy is not None and type(policy) is not bool:
            raise ValueError('逐图层墨路状态必须是布尔值')
        if mask is not None and policy is not None:
            raise ValueError('一次只能更改一类墨路设置')
        with self.lock:
            s = self._ensure()
            if mask is not None or policy is not None:
                s.command = mask if policy is None else 17 if policy else 16
                seq = s.sequence + 1
                s.sequence = seq
                for _ in range(100):
                    if s.acknowledged == seq:
                        break
                    time.sleep(.03)
                if s.acknowledged != seq:
                    raise ValueError('墨路设置未确认，未显示为已应用')
                if s.result:
                    raise ValueError('RIP 任务正在运行，请等本次任务结束后更改墨路')
            return {'ready': True, 'mask': s.requested, 'effectiveMask': s.effective,
                    'busy': bool(s.busy), 'fault': s.fault,
                    'rows': s.rows, 'cachedFiles': s.files, 'bytes': s.bytes,
                    'nativePlaneOrder': ['K', 'C', 'M', 'Y', 'W1', 'W2'],
                    'beforeNonzero': list(s.before), 'afterNonzero': list(s.after),
                    'layerPolicySupported': True, 'layerPolicyRequired': bool(s.policyRequired),
                    'layerPolicyActive': bool(s.policyActive), 'layerPolicyPixels': s.policyPixels}
