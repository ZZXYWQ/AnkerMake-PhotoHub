/* Native extension bootstrap: bounded React runtime discovery, no account reads. */
(() => {
  'use strict';
  const cfg = window.__EPC_CONFIG;
  if (!cfg || !Number.isInteger(cfg.port) || typeof cfg.token !== 'string') return;
  if (window.__EPC_DISCOVERY) return;
  window.__EPC_DISCOVERY = true;
  const runtime = window.__EPC_RUNTIME = {editor: null, project: null, fiber: null};
  let attempts = 0, lastSignature = '', loadingScripts = false, discoveringManager = false, managerVerified = false;
  // The 1.23 editor keeps its ProjectManager in a module singleton instead of
  // exposing the editor/project pair directly in React hooks. Only import a
  // module whose bytes and public singleton export have been verified.
  const managerModules = [
    {name: 'Generating_img-Sr0X61KY.js', hash: 'd94001702f1164a060c4453d399249feea7b36acf4f7241cd4e7e0a8cc67a6a5', key: 'ut'},
    {name: 'cavasUtil-ROGidih4.js', hash: '32addb8a6fe5a1a15ebfc00f9547c61635e2e765533b1548340621d1363701a0', key: 'R'}
  ];
  function validEditor(editor) {
    const canvas = editor?.canvas, upper = canvas?.upperCanvasEl, lower = canvas?.lowerCanvasEl;
    return !!canvas && !canvas.disposed && typeof editor.executeCommand === 'function' && typeof editor.addImageByDpi === 'function' &&
      !!upper?.isConnected && !!lower?.isConnected && upper.ownerDocument === document && lower.ownerDocument === document &&
      Array.from(document.querySelectorAll('canvas')).includes(upper) && Array.from(document.querySelectorAll('canvas')).includes(lower);
  }
  async function discoverManager() {
    if (discoveringManager || managerVerified && validEditor(runtime.manager?.canvasEditor)) return;
    const urls = performance.getEntriesByType('resource').map(item => item.name);
    const profile = managerModules.find(item => urls.some(url => {
      try { const parsed = new URL(url); return parsed.origin === location.origin && parsed.pathname.endsWith('/' + item.name); } catch { return false; }
    }));
    if (!profile) return;
    const url = urls.find(url => new URL(url).origin === location.origin && new URL(url).pathname.endsWith('/' + profile.name));
    discoveringManager = true;
    try {
      const response = await fetch(url, {cache: 'force-cache'});
      if (!response.ok) throw Error('原版项目模块读取失败');
      const source = await response.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== profile.hash) throw Error('原版项目模块版本尚未适配');
      const module = await import(url), type = module[profile.key];
      if (typeof type?.getInstance !== 'function' || typeof type.prototype?.getProjectData !== 'function' || typeof type.prototype?.changeEditorSaveState !== 'function') throw Error('原版项目接口不匹配');
      const manager = type.getInstance(), editor = manager?.canvasEditor;
      const project = manager?.getProjectData();
      if (!validEditor(editor) || !project?.project_info || !Array.isArray(project.canvases)) return;
      runtime.manager = manager;
      runtime.editor = editor;
      managerVerified = true;
      delete runtime.discoveryError;
      activate();
    } catch (error) {
      runtime.discoveryError = error.message || String(error);
    } finally { discoveringManager = false; }
  }
  const projectIds = new WeakMap(); let projectSequence = 0;
  function refreshProject() {
    if (managerVerified && runtime.manager && typeof runtime.manager.getProjectData === 'function') {
      if (!validEditor(runtime.manager.canvasEditor)) return null;
      const value = runtime.manager.getProjectData();
      if (value?.project_info && Array.isArray(value.canvases)) {
        runtime.project = value;
        runtime.editor = runtime.manager.canvasEditor;
        return value;
      }
    }
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
    if (managerModules.some(item => performance.getEntriesByType('resource').some(resource => {
      try { const url = new URL(resource.name); return url.origin === location.origin && url.pathname.endsWith('/' + item.name); } catch { return false; }
    })) && (!managerVerified || !validEditor(runtime.manager?.canvasEditor))) return;
    window.__EPC_HOST ||= {
      manager: () => managerVerified ? runtime.manager : null,
      editor: () => validEditor(managerVerified ? runtime.manager?.canvasEditor : runtime.editor) ? (managerVerified ? runtime.manager.canvasEditor : runtime.editor) : null,
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
        if (typeof runtime.manager?.getCanvasDpi === 'function') return runtime.manager.getCanvasDpi();
        const p = refreshProject();
        if (!p) throw Error('打印项目尚未就绪');
        return p.canvases[p.canvasesIndex || 0]?.category === 103 ? 5 : 50;
      },
      loading: () => {
        const manager = runtime.manager;
        return !validEditor(managerVerified ? manager?.canvasEditor : runtime.editor) ||
          !!manager?.getIsLoadingProject?.() || !!manager?.isLoadingProject || !!manager?._isLoadFirstInProgress ||
          !!manager?.localProjectLoadFailed || !!manager?.projectLoadFailed || !refreshProject();
      },
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
        if (!managerVerified && value.canvasEditor && typeof value.getProjectData === 'function') {
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
    if (runtime.manager) refreshProject();
    activate();
    discoverManager();
    attempts++;
    setTimeout(scan, runtime.editor ? 3000 : 2000);
  }
  scan();
})();
