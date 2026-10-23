/* The host replacement tool enters/exits crop mode but leaves save suspended. */
(()=>{'use strict';
let cached=null;
async function managerFor(ed,host){let m=host.manager?.();if(!m&&window.__EPC_RUNTIME?.manager)m=window.__EPC_RUNTIME.manager;if(!m&&cached?.canvasEditor===ed)m=cached;
 if(!m&&window.__EPC_RUNTIME){const url=performance.getEntriesByType('resource').map(e=>e.name).find(u=>/\/cavasUtil-[\w-]+\.js(?:\?|$)/.test(u)&&new URL(u).origin===location.origin);if(url){const module=await import(url);const candidate=module.R?.getInstance?.();if(candidate?.canvasEditor===ed&&typeof candidate.changeEditorSaveState==='function'){m=candidate;window.__EPC_RUNTIME.manager=m;}}if(!m)throw Error('当前版本无法确认原版保存接口，未修改图片');}
 if(m){if(m.canvasEditor!==ed||typeof m.changeEditorSaveState!=='function')throw Error('原版保存接口不匹配，未修改图片');cached=m;}return m;
}
async function replace({ed,host,o,src}){const m=await managerFor(ed,host),project=host.project?.();if(m?.getIsLoadingProject?.()||o._isCropping)throw Error('原版仍在加载或裁剪，请完成当前操作后重试');try{return await ed.executeCommand('replaceImageCommand',{objectId:o.id,src});}finally{if(m&&host.editor()===ed&&host.project?.()===project&&!m._isLoadFirstInProgress&&!m.localProjectLoadFailed&&!m.projectLoadFailed&&!ed.canvas.getObjects().some(item=>item._isCropping))m.changeEditorSaveState(true,false);}}
window.EPCLayerDocument.replace=replace;
})();
