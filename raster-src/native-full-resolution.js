/* Keep the complete native source on long-image canvases. No geometry changes. */
(()=>{'use strict';
const pending=new WeakMap(),bound=new WeakSet(),previous=new WeakMap();
let verified=false,checking=null,enabled=true,generation=0;
try{enabled=localStorage.getItem('photohub.fullResolution')!=='false';}catch{}
async function verify(){
 if(verified)return true;
 if(checking)return checking;
 checking=(async()=>{
  const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>{try{const p=new URL(u);return p.origin===location.origin&&p.pathname.endsWith('/Image-DPZAKoo6.js');}catch{return false;}});
  if(!url)return false;
  const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return false;
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
  verified=hash==='869b7fbdd7aec644ca98543048cfb2e7b44704b1c83f2ac5341c8bf68a6a8bee';
  return verified;
 })();try{return await checking;}catch(error){window.EPCFullResolution.lastError=error.message;return false;}finally{checking=null;}
}
function eligible(o){return o?.type==='image'&&Math.max(o.pixelWidth||o.width||0,o.pixelHeight||o.height||0)>30000;}
function clearLod(o){o._skipDownsample=true;o._dsToken=(o._dsToken||0)+1;delete o._dsBaseElement;delete o._dsTier;o.objectCaching=false;}
function restore(o){const old=previous.get(o);if(!old)return;previous.delete(o);o._dsToken=(o._dsToken||0)+1;if(o.__epcOriginalLodCheck){o._lodCheck=o.__epcOriginalLodCheck;delete o.__epcOriginalLodCheck;}if(o._cacheHash===old.hash&&o._hash===old.source&&!o.filters?.length&&!o._isCropping){const values=old.values,el=values._element,w=el?.naturalWidth||el?.width,h=el?.naturalHeight||el?.height;if(Math.max(w||0,h||0)>4096){const preview=document.createElement('canvas'),scale=4096/Math.max(w,h);preview.width=Math.max(1,Math.round(w*scale));preview.height=Math.max(1,Math.round(h*scale));const ctx=preview.getContext('2d');if(ctx){ctx.drawImage(el,0,0,preview.width,preview.height);Object.assign(values,{_element:preview,_originalElement:preview,_dsBaseElement:preview,_dsTier:4096,_skipDownsample:false});}}for(const[k,v]of Object.entries(values))o[k]=v;o.dirty=true;o.canvas?.requestRenderAll();}}
function remember(o){if(!previous.has(o))previous.set(o,{hash:o._cacheHash,source:o._hash,values:Object.fromEntries(['_element','_originalElement','_skipDownsample','_dsBaseElement','_dsTier','objectCaching'].map(k=>[k,o[k]]))});}
function setEnabled(value,host){enabled=!!value;generation++;try{localStorage.setItem('photohub.fullResolution',String(enabled));}catch{}if(host?.editor()?.canvas){const visit=o=>{if(!enabled)restore(o);for(const c of o?._objects||[])visit(c);};host.editor().canvas.getObjects().forEach(visit);if(enabled)install(host);}return enabled;}
function ensure(o,host){
 if(!verified||!enabled||!eligible(o)||o._isCropping||o.filters?.length)return Promise.resolve(false);
 if(pending.has(o))return pending.get(o);
 remember(o);const epoch=generation;
 clearLod(o);
 if(!o.__epcOriginalLodCheck&&typeof o._lodCheck==='function'){
  const original=o._lodCheck;o.__epcOriginalLodCheck=original;
  o._lodCheck=function(...args){if(enabled&&eligible(this)){ensure(this,host);return;}return original.apply(this,args);};
 }
 const width=o.pixelWidth||o.width,height=o.pixelHeight||o.height,el=o._element,cacheHash=o._cacheHash,hash=o._hash;
 if(el&&(el.naturalWidth||el.width)>=width&&(el.naturalHeight||el.height)>=height){o._originalElement=el;return Promise.resolve(true);}
 const job=(async()=>{
  const original=await host.original(o);
  if(!original||(original.naturalWidth||original.width)<width||(original.naturalHeight||original.height)<height)throw Error('完整原图读取失败，未用缩略图替代原图');
  if(!enabled||epoch!==generation||!o.canvas||o.canvas.disposed||o._cacheHash!==cacheHash||o._hash!==hash||o._isCropping||o.filters?.length)return false;
  clearLod(o);o._element=original;o._originalElement=original;o.dirty=true;
  for(let p=o.group;p;p=p.group)p.dirty=true;
  o.canvas.requestRenderAll();return true;
 })().catch(error=>{window.EPCFullResolution.lastError=error.message;return false;}).finally(()=>pending.delete(o));
 pending.set(o,job);return job;
}
async function install(host){
 if(!host?.editor()||!await verify())return false;
 const canvas=host.editor()?.canvas;if(!canvas||canvas.disposed)return false;
 const visit=o=>{if(eligible(o))ensure(o,host);for(const child of o?._objects||[])visit(child);};
 if(!bound.has(canvas)){
  bound.add(canvas);canvas.on('object:added',e=>visit(e.target));
  canvas.on('selection:created',e=>(e.selected||[]).forEach(visit));
  canvas.on('selection:updated',e=>(e.selected||[]).forEach(visit));
  canvas.on('mouse:wheel',()=>{const o=canvas.getActiveObject();if(o)visit(o);});
 }
 canvas.getObjects().forEach(visit);return true;
}
window.EPCFullResolution={install,ensure,setEnabled,get enabled(){return enabled;},get verified(){return verified;},lastError:null};
})();
