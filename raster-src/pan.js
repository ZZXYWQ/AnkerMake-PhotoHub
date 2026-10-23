/* Handle middle-button panning inside this editor without browser autoscroll.
   No OS mouse hooks, remote-session changes, or synthetic global input. */
(() => {
 window.EPCPanGuard={install({editor}){
  window.__EPC_PAN_GUARD?.dispose();let drag=null,disposed=false;const listeners=[];
  const on=(target,type,fn)=>{target.addEventListener(type,fn,{capture:true,passive:false});listeners.push([target,type,fn]);};
  function end(){const old=drag;drag=null;if(!old)return;old.canvas.isDragging=false;old.element.style.cursor=old.cursor;try{if(old.element.hasPointerCapture(old.id))old.element.releasePointerCapture(old.id);}catch{}old.canvas.requestRenderAll?.();}
  function down(e){if(e.button!==1||!document.body.classList.contains('epc-native-layout'))return;let canvas;try{canvas=editor()?.canvas;}catch{return;}
   const target=e.target,el=target?.closest?.('canvas.upper-canvas,[data-epc-raster],svg[aria-label="原画布轮廓节点编辑"]');
   if(!canvas||!el||window.__EPC_APP?.raster?.isBusy())return;
   e.preventDefault();e.stopImmediatePropagation();end();drag={canvas,element:el,id:e.pointerId,x:e.clientX,y:e.clientY,cursor:el.style.cursor};el.style.cursor='grabbing';try{el.setPointerCapture(e.pointerId);}catch{}
  }
  function move(e){if(!drag)return;if(!(e.buttons&4)){end();return;}if(e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();const d=drag,r=d.canvas.upperCanvasEl.getBoundingClientRect(),dx=(e.clientX-d.x)*d.canvas.width/r.width,dy=(e.clientY-d.y)*d.canvas.height/r.height;if(Number.isFinite(dx)&&Number.isFinite(dy)){const v=d.canvas.viewportTransform.slice();v[4]+=dx;v[5]+=dy;d.canvas.setViewportTransform(v);d.canvas.requestRenderAll();}d.x=e.clientX;d.y=e.clientY;}
  function up(e){if(drag&&(e.button===1||e.type==='pointercancel')){e.preventDefault();e.stopImmediatePropagation();end();}}
  function mouse(e){if(e.button===1&&(drag||e.target?.closest?.('canvas.upper-canvas,[data-epc-raster],svg[aria-label="原画布轮廓节点编辑"]'))&&document.body.classList.contains('epc-native-layout')){e.preventDefault();e.stopImmediatePropagation();}}
  on(window,'pointerdown',down);on(window,'pointermove',move);on(window,'pointerup',up);on(window,'pointercancel',up);on(window,'blur',end);on(window,'lostpointercapture',end);on(window,'mousedown',mouse);on(window,'mouseup',mouse);on(window,'auxclick',mouse);
  on(document,'visibilitychange',()=>{if(document.hidden)end();});on(document,'keydown',e=>{if(e.key==='Escape')end();});
  const api={isDragging:()=>!!drag,dispose(){if(disposed)return;disposed=true;end();for(const [target,type,fn]of listeners)target.removeEventListener(type,fn,true);}};window.__EPC_PAN_GUARD=api;return api;
 }};
})();
