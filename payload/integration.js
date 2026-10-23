/* Native extension bootstrap: bounded React runtime discovery, no account reads. */
(() => {
  'use strict';
  if (window.__EPC_DISCOVERY) return;
  window.__EPC_DISCOVERY = true;
  const cfg = window.__EPC_CONFIG;
  const runtime = window.__EPC_RUNTIME = {editor: null, project: null, fiber: null};
  let attempts = 0, lastSignature = '', loadingScripts = false;
  const projectIds = new WeakMap(); let projectSequence = 0;
  function refreshProject() {
    let fiber = runtime.fiber;
    // The App component stores the live editor and project model in hooks.
    for (let parents = 0; fiber && parents < 30; parents++, fiber = fiber.return) {
      let hook = fiber.memoizedState;
      for (let i = 0; hook && typeof hook === 'object' && i < 150; i++, hook = hook.next) {
        const value = hook.memoizedState;
        if (value && value.project_info && Array.isArray(value.canvases)) {
          runtime.project = value; return value;
        }
      }
    }
    return runtime.project;
  }
  function activate() {
    if (!runtime.editor || !refreshProject()) return;
    window.__EPC_HOST ||= {
      editor: () => runtime.editor && runtime.editor.canvas && !runtime.editor.canvas.disposed ? runtime.editor : null,
      project: () => {
        const p = refreshProject(); if (!p) return null;
        let id = p.project_info.project_id;
        if (id === undefined || id === null || id === '') {
          if (!projectIds.has(p)) projectIds.set(p, ++projectSequence);
          id = 'runtime-' + projectIds.get(p);
        }
        return String(id) + ':canvas:' + String(p.canvasesIndex || 0);
      },
      dpi: () => {
        const p = refreshProject();
        if (!p) throw Error('打印项目尚未就绪');
        return p.canvases[p.canvasesIndex || 0]?.category === 103 ? 5 : 50;
      },
      loading: () => !runtime.editor || !!runtime.manager?.getIsLoadingProject?.() || !refreshProject(),
      original: async obj => {
        if (typeof obj.getOriginalSrc !== 'function') throw Error('此版本图片对象不支持原始分辨率读取');
        const src = await obj.getOriginalSrc();
        if (!src) throw Error('无法读取原始图片');
        return await new Promise((resolve, reject) => {
          const img = document.createElement('img'); img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (obj.pixelWidth && obj.pixelHeight && (img.naturalWidth < obj.pixelWidth || img.naturalHeight < obj.pixelHeight)) reject(Error('原始图片缓存缺失，拒绝使用低分辨率预览'));
            else resolve(img);
          };
          img.onerror = () => reject(Error('原始图片读取失败')); img.src = src;
        });
      }
    };
    window.__EUFY_PHOTOCRAFT_LARGE_IMAGES = true;
    if (!loadingScripts && !window.__EPC_UI) {
      loadingScripts = true;
      const filter = document.createElement('script');
      filter.src = 'http://127.0.0.1:' + cfg.port + '/large-image-import.js';
      (document.head || document.documentElement).appendChild(filter);
      const script = document.createElement('script');
      script.src = 'http://127.0.0.1:' + cfg.port + '/adapter.js';
      const timeout=setTimeout(()=>{loadingScripts=false;script.remove();},20000);
      script.onload=()=>{clearTimeout(timeout);loadingScripts=false;};
      script.onerror=()=>{clearTimeout(timeout);loadingScripts=false;script.remove();};
      (document.head || document.documentElement).appendChild(script);
    }
  }
  function scan() {
    runtime.editor = null; runtime.project = null; runtime.fiber = null;
    const queue = [], visited = new Set(), evidence = [];
    for (const el of Array.from(document.querySelectorAll('*')).slice(0, 12000)) {
      for (const key of Object.keys(el)) {
        if (key.startsWith('__reactFiber$') || key.startsWith('__reactContainer$')) {
          let fiber = el[key];
          for (let i = 0; fiber?.return && i < 200; i++) fiber = fiber.return;
          queue.push([fiber?.stateNode?.current || fiber, 'root']);
        }
      }
    }
    function inspect(value, path, fiber) {
      if (!value || typeof value !== 'object') return;
      try {
        if (value.canvas && typeof value.executeCommand === 'function' && typeof value.addImageByDpi === 'function') {
          runtime.editor = value; runtime.fiber = fiber;
          evidence.push({kind: 'editor', path, methods: ['executeCommand', 'addImageByDpi']});
        }
        if (value.project_info && Array.isArray(value.canvases)) {
          runtime.project = value;
          evidence.push({kind: 'project', path, keys: ['project_info', 'canvases']});
        }
        if (value.canvasEditor && typeof value.getProjectData === 'function') {
          runtime.manager = value;
          evidence.push({kind: 'manager', path});
        }
      } catch (_) {}
    }
    while (queue.length && visited.size < 24000) {
      const [fiber, path] = queue.pop();
      if (!fiber || typeof fiber !== 'object' || visited.has(fiber)) continue;
      visited.add(fiber);
      for (const key of ['child', 'sibling']) if (fiber[key]) queue.push([fiber[key], key]);
      for (const key of ['memoizedProps', 'pendingProps', 'stateNode']) {
        const value = fiber[key]; inspect(value, key, fiber);
        if (value && typeof value === 'object' && !value.nodeType) {
          for (const sub of Object.keys(value).slice(0, 100)) {
            const desc = Object.getOwnPropertyDescriptor(value, sub);
            if (desc && 'value' in desc) inspect(desc.value, key + '.' + sub, fiber);
          }
        }
      }
      let hook = fiber.memoizedState;
      for (let i = 0; hook && typeof hook === 'object' && i < 150; i++, hook = hook.next) {
        inspect(hook.memoizedState, 'hook.' + i, fiber);
        if (hook.memoizedState && typeof hook.memoizedState === 'object') inspect(hook.memoizedState.current, 'hook.' + i + '.current', fiber);
      }
    }
    const unique = Array.from(new Map(evidence.map(x => [JSON.stringify(x), x])).values()).slice(0, 80);
    const signature = JSON.stringify(unique);
    if (signature !== lastSignature || attempts === 0) {
      lastSignature = signature;
      fetch('http://127.0.0.1:' + cfg.port + '/diagnostics', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-EPC-Token': cfg.token}, body: JSON.stringify({kind: 'runtime-discovery', fibers: visited.size, findings: unique})}).catch(() => {});
    }
    activate();
    attempts++;
    setTimeout(scan, runtime.editor ? 3000 : 2000);
  }
  scan();
})();
