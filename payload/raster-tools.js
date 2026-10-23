/* Pixel selections operate at source resolution; all lengthy scans yield. */
(() => {
 'use strict';
 const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
 async function flood(data,w,h,x,y,tolerance=24,contiguous=true,valid=()=>true){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||data.length!==w*h*4)throw Error('像素数据无效');
  const n=w*h,start=Math.floor(y)*w+Math.floor(x),mask=new Uint8ClampedArray(n);
  if(x<0||y<0||x>=w||y>=h)return mask;
  const sample=data.slice(start*4,start*4+4),matches=i=>{
   const k=i*4;
   // Invisible RGB values must not split a transparent region.
   if(!sample[3]&&!data[k+3])return true;
   return Math.abs(sample[0]-data[k])<=tolerance&&Math.abs(sample[1]-data[k+1])<=tolerance&&Math.abs(sample[2]-data[k+2])<=tolerance&&Math.abs(sample[3]-data[k+3])<=tolerance;
  };
  const checkpoint=async()=>{await yieldUI();if(!valid())throw Error('编辑已取消或项目已变化');};
  if(!contiguous){for(let i=0;i<n;i++){if(matches(i))mask[i]=255;if(i&&i%65536===0)await checkpoint();}return mask;}
  const seen=new Uint8Array(n),queue=new Uint32Array(n);let read=0,write=1;queue[0]=start;seen[start]=1;
  const push=i=>{if(!seen[i]){seen[i]=1;queue[write++]=i;}};
  while(read<write){const i=queue[read++];if(matches(i)){mask[i]=255;const col=i%w;if(col)push(i-1);if(col<w-1)push(i+1);if(i>=w)push(i-w);if(i<n-w)push(i+w);}if(read%65536===0)await checkpoint();}
  return mask;
 }
 function combine(previous,next,mode){
  if(!previous||mode==='replace')return next;
  for(let i=0;i<next.length;i++)next[i]=mode==='add'?Math.max(previous[i],next[i]):mode==='subtract'?Math.max(0,previous[i]-next[i]):Math.min(previous[i],next[i]);
  return next;
 }
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;if(!c.getContext('2d'))throw Error('无法分配编辑内存');return c;}
 function maskCanvas(mask,w,h,tinted=false){const c=canvas(w,h),ctx=c.getContext('2d'),d=ctx.createImageData(w,h);for(let i=0;i<mask.length;i++){const j=i*4;d.data[j]=tinted?30:255;d.data[j+1]=tinted?150:255;d.data[j+2]=255;d.data[j+3]=tinted?Math.round(mask[i]*.25):mask[i];}ctx.putImageData(d,0,0);return c;}
 function maskFromCanvas(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,m=new Uint8ClampedArray(c.width*c.height);for(let i=0;i<m.length;i++)m[i]=d[i*4+3];return m;}
 async function filter(image,operation,p={},valid=()=>true){
  const d=image.data,w=image.width,h=image.height;
  const b=Number(p.brightness||0),contrast=Number(p.contrast||0),amount=Number(p.amount??1);
  const low=Number(p.black??0),high=Number(p.white??255),gamma=Number(p.gamma??1);
  if(![b,contrast,amount,low,high,gamma].every(Number.isFinite)||Math.abs(b)>1||Math.abs(contrast)>1||amount<0||amount>3||low<0||high>255||low>=high||gamma<.1||gamma>10)throw Error('图像调整参数无效');
  const points=[0,Number(p.q1??64),Number(p.q2??128),Number(p.q3??192),255];
  if(points.some(v=>!Number.isFinite(v)||v<0||v>255))throw Error('曲线输出须为 0–255');
  const lut=Array.from({length:256},(_,v)=>{const seg=Math.min(3,Math.floor(v/64)),xs=[0,64,128,192,255],t=(v-xs[seg])/(xs[seg+1]-xs[seg]);return points[seg]*(1-t)+points[seg+1]*t;});
  if(!['grayscale','invert','brightnessContrast','saturation','levels','curves','sharpen'].includes(operation))throw Error('未知图像调整');
  const src=operation==='sharpen'?new Uint8ClampedArray(d):null,factor=(1+contrast)/(1-contrast+1e-6);
  for(let i=0;i<d.length;i+=4){const lum=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];for(let k=0;k<3;k++){
   const v=d[i+k];
   if(src){const x=(i/4)%w,y=Math.floor(i/4/w);let neighbors=0;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const j=(Math.max(0,Math.min(h-1,y+dy))*w+Math.max(0,Math.min(w-1,x+dx)))*4;neighbors+=src[j+3]?src[j+k]:src[i+k];}d[i+k]=v+amount*(4*v-neighbors);}
   else d[i+k]=operation==='grayscale'?lum:operation==='invert'?255-v:operation==='saturation'?lum+(v-lum)*amount:operation==='levels'?255*Math.pow(Math.max(0,Math.min(1,(v-low)/(high-low))),1/gamma):operation==='curves'?lut[v]:((v/255-.5)*factor+.5+b)*255;
  }if(i&&i%262144===0){await yieldUI();if(!valid())throw Error('编辑已取消或项目已变化');}}
  return image;
 }
 window.EPCRasterOps={flood,combine,canvas,maskCanvas,maskFromCanvas,filter};
})();

/* Editable source and settings travel inside the ordinary PNG cache payload. */
(() => {
'use strict';
const signature=[137,80,78,71,13,10,26,10],type='phUb',encoder=new TextEncoder(),decoder=new TextDecoder(),limit=256*1024*1024;
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function uint(n){return new Uint8Array([n>>>24,n>>>16&255,n>>>8&255,n&255]);}
function join(parts){const a=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){a.set(p,i);i+=p.length;}return a;}
function chunks(bytes){if(!signature.every((v,i)=>bytes[i]===v))return null;const out=[];for(let i=8;i<bytes.length;){if(i+12>bytes.length)throw Error('PNG 数据不完整');const n=new DataView(bytes.buffer,bytes.byteOffset+i,4).getUint32(0);if(n>limit||i+12+n>bytes.length)throw Error('PNG 区块过大或损坏');const name=String.fromCharCode(...bytes.slice(i+4,i+8));out.push({name,start:i,end:i+12+n,data:bytes.subarray(i+8,i+8+n),checksum:new DataView(bytes.buffer,bytes.byteOffset+i+8+n,4).getUint32(0)});i+=12+n;if(name==='IEND')break;}return out;}
async function read(src){let bytes;try{bytes=new Uint8Array(await(await fetch(typeof src==='string'?src:src.src)).arrayBuffer());}catch{return null;}const list=chunks(bytes);if(!list)return null;const item=list.find(c=>c.name===type);if(!item)return null;if(crc(join([encoder.encode(type),item.data]))!==item.checksum)throw Error('PhotoHub 可编辑数据校验失败，请保留原文件');if(item.data.length>limit)throw Error('可编辑数据过大');const doc=JSON.parse(decoder.decode(item.data));validate(doc);return doc;}
function validate(d){if(d?.version!==1||!/^data:image\/png;base64,/.test(d.base||'')||d.mask&&!/^data:image\/png;base64,/.test(d.mask)||!Array.isArray(d.adjustments)||d.adjustments.length>32)throw Error('PhotoHub 可编辑数据格式不受支持');for(const a of d.adjustments)if(!['brightnessContrast','saturation','levels','curves','grayscale','invert','blur','sharpen'].includes(a.operation))throw Error('未知调整类型');}
async function image(src){const im=new Image();im.src=src;await im.decode();return im;}
function defaults(base){return{version:1,base,mask:null,maskEnabled:true,adjustments:[],effects:{stroke:0,strokeColor:'#000000',shadow:0,shadowX:0,shadowY:0,shadowColor:'#000000',shadowOpacity:.5}};}
async function render(doc){validate(doc);const base=await image(doc.base),w=base.naturalWidth,h=base.naturalHeight,ops=EPCRasterOps,c=ops.canvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(base,0,0);
 for(const a of doc.adjustments){if(a.operation==='blur'){const r=Number(a.params?.radius??2);if(!Number.isFinite(r)||r<0||r>40)throw Error('模糊半径无效');const tmp=ops.canvas(w,h),x=tmp.getContext('2d');x.filter=`blur(${r}px)`;x.drawImage(c,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(tmp,0,0);tmp.width=tmp.height=0;}else{const pixels=ctx.getImageData(0,0,w,h);await ops.filter(pixels,a.operation,a.params);ctx.putImageData(pixels,0,0);}}
 if(doc.mask&&doc.maskEnabled!==false){const mask=await image(doc.mask);if(mask.naturalWidth!==w||mask.naturalHeight!==h)throw Error('蒙版尺寸与原图不一致');ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';}
 const e={...defaults('').effects,...doc.effects};if(![e.stroke,e.shadow,e.shadowX,e.shadowY,e.shadowOpacity].every(Number.isFinite)||e.stroke<0||e.stroke>20||e.shadow<0||e.shadow>40||Math.abs(e.shadowX)>200||Math.abs(e.shadowY)>200||e.shadowOpacity<0||e.shadowOpacity>1||![e.strokeColor,e.shadowColor].every(v=>/^#[\da-f]{6}$/i.test(v)))throw Error('图层效果参数无效');
 if(e.stroke||e.shadow||e.shadowX||e.shadowY){const result=ops.canvas(w,h),r=result.getContext('2d');if(e.shadow||e.shadowX||e.shadowY){const sh=ops.canvas(w,h),s=sh.getContext('2d');s.filter=`blur(${e.shadow}px)`;s.drawImage(c,e.shadowX,e.shadowY);s.filter='none';s.globalCompositeOperation='source-in';s.fillStyle=e.shadowColor;s.fillRect(0,0,w,h);r.globalAlpha=e.shadowOpacity;r.drawImage(sh,0,0);r.globalAlpha=1;sh.width=sh.height=0;}if(e.stroke){const d=ctx.getImageData(0,0,w,h),radius=Math.ceil(e.stroke),a=new Uint8Array(w*h),tmp=new Uint8Array(w*h);for(let i=0;i<a.length;i++)a[i]=d.data[i*4+3];const q=new Int32Array(Math.max(w,h));for(let y=0;y<h;y++){let head=0,tail=0,next=0;for(let x=0;x<w;x++){const right=Math.min(w-1,x+radius);while(next<=right){while(tail>head&&a[y*w+q[tail-1]]<=a[y*w+next])tail--;q[tail++]=next++;}while(tail>head&&q[head]<x-radius)head++;tmp[y*w+x]=a[y*w+q[head]];}if(y%128===0)await new Promise(resolve=>setTimeout(resolve,0));}for(let x=0;x<w;x++){let head=0,tail=0,next=0;for(let y=0;y<h;y++){const bottom=Math.min(h-1,y+radius);while(next<=bottom){while(tail>head&&tmp[q[tail-1]*w+x]<=tmp[next*w+x])tail--;q[tail++]=next++;}while(tail>head&&q[head]<y-radius)head++;a[y*w+x]=tmp[q[head]*w+x];}if(x%128===0)await new Promise(resolve=>setTimeout(resolve,0));}const stroke=ops.maskCanvas(a,w,h),s=stroke.getContext('2d');s.globalCompositeOperation='source-in';s.fillStyle=e.strokeColor;s.fillRect(0,0,w,h);r.drawImage(stroke,0,0);stroke.width=stroke.height=0;}r.drawImage(c,0,0);c.width=c.height=0;return result;}return c;
}
async function encode(canvas,doc){validate(doc);const bytes=new Uint8Array(await(await fetch(canvas.toDataURL('image/png'))).arrayBuffer()),data=encoder.encode(JSON.stringify(doc));if(data.length>limit)throw Error('可编辑图像数据超过 256MB，请分层处理');const list=chunks(bytes),iend=list.find(c=>c.name==='IEND'),payload=join([encoder.encode(type),data]),chunk=join([uint(data.length),payload,uint(crc(payload))]),blob=new Blob([bytes.subarray(0,iend.start),chunk,bytes.subarray(iend.start)],{type:'image/png'});return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});}
async function fromElement(el){const found=await read(el);if(found)return found;const c=EPCRasterOps.canvas(el.naturalWidth||el.width,el.naturalHeight||el.height);c.getContext('2d').drawImage(el,0,0);const result=defaults(c.toDataURL('image/png'));c.width=c.height=0;return result;}
window.EPCLayerDocument={read,defaults,render,encode,fromElement,image};
})();

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

/* Direct eufyMake canvas raster editing; no external editor window. */
(() => {
 'use strict';
 const sig=o=>JSON.stringify([o.id,o._cacheHash,o.width,o.height,o.left,o.top,o.scaleX,o.scaleY,o.angle,o.skewX,o.skewY,o.flipX,o.flipY,o.cropX,o.cropY,o.opacity]);
 function inverse(m,p){const d=m[0]*m[3]-m[1]*m[2];if(!Number.isFinite(d)||Math.abs(d)<1e-12)throw Error('图片变换不可逆。');return{x:(m[3]*(p.x-m[4])-m[2]*(p.y-m[5]))/d,y:(-m[1]*(p.x-m[4])+m[0]*(p.y-m[5]))/d};}
 function create({editor,host,status=()=>{},save=async()=>{},onOptionsChange=()=>{}}){
  const ops=window.EPCRasterOps;
  let state=null,starting=null,previewing=false,tool='brush',options={color:'#000000',color2:'#ffffff',size:20,opacity:1,tolerance:24,contiguous:true,selectionMode:'replace'},working=false,preparation=0,requestedMask=false;
  const say=s=>status(s);
  function begin(){if(state)return Promise.resolve(state);if(!starting)starting=prepare().finally(()=>{starting=null;});return starting;}
  async function prepare(){if(state)return state;const generation=preparation,ed=editor(),o=ed?.canvas?.getActiveObject();if(!o||o.type!=='image'||!ed.canvas.getObjects().includes(o))throw Error('请选中一张普通图片。');
   if(o.group||o._parentId||o.clipPath||o.cropX||o.cropY||(o.cropPath&&o.cropKey!=='free')||o.filters?.length||o.isCanvasTexture||o._isTextureGroup||o._isOutlineTag||/workspace/i.test(o.id||''))throw Error('此工具暂不支持分组、裁切、蒙版、滤镜或工艺层图片；请先准备普通图片。');
   const initialSignature=sig(o),initialProject=host.project?.();let src=o._epcRawElement||await host.original(o);const layerDoc=await window.EPCLayerDocument?.read(src);let baseImage=null;if(layerDoc){src=await EPCLayerDocument.image(layerDoc.base);}if(requestedMask){baseImage=src;src=layerDoc?.mask?await EPCLayerDocument.image(layerDoc.mask):null;if(!src){src=ops.canvas(baseImage.naturalWidth||baseImage.width,baseImage.naturalHeight||baseImage.height);const x=src.getContext('2d');x.fillStyle='white';x.fillRect(0,0,src.width,src.height);}}const w=src?.naturalWidth||src?.width,h=src?.naturalHeight||src?.height;if(sig(o)!==initialSignature||host.project?.()!==initialProject)throw Error('读取期间原图或项目已变化，请重试。');if(!w||!h)throw Error('无法读取原图。');if(o.cropPath&&(o.width!==w||o.height!==h))throw Error('此图片存在裁切区域，请先准备未裁切的普通图片。');if((o.pixelWidth&&w<o.pixelWidth)||(o.pixelHeight&&h<o.pixelHeight))throw Error('原图缓存不可用，拒绝编辑低清预览。');
   if(generation!==preparation)throw Error('已取消图片读取');
   const buffer=document.createElement('canvas');buffer.width=w;buffer.height=h;const context=buffer.getContext('2d',{willReadFrequently:true});if(!context)throw Error('无法分配原图内存。');context.drawImage(src,0,0);context.getImageData(0,0,1,1);
   const overlay=document.createElement('canvas');overlay.dataset.epcRaster='true';overlay.style.cssText='position:fixed;z-index:2147482500;touch-action:none;cursor:crosshair';document.body.append(overlay);
   state={ed,o,buffer,context,overlay,layerDoc,baseImage,maskEditor:requestedMask,signature:sig(o),project:host.project?.(),dirty:false,down:false,last:null,selection:null,history:[],future:[],captures:new Set(),origin:null,cloneOffset:null,gesture:null};
   const current=state;const syncMenu=()=>{if(state!==current)return;const open=[...document.querySelectorAll('div[class*="_menu_div_"]')].some(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none');const z=open?'1':'2147482500';if(overlay.style.zIndex!==z)overlay.style.zIndex=z;};current.menuObserver=new MutationObserver(syncMenu);current.menuObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});syncMenu();
   overlay.addEventListener('pointerdown',down);for(const type of ['pointerdown','pointerup','mousedown','mouseup','contextmenu'])overlay.addEventListener(type,forwardRight);overlay.addEventListener('pointermove',move);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',abortGesture,true);window.addEventListener('blur',abortGesture);overlay.addEventListener('lostpointercapture',abortGesture);document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',preview);window.addEventListener('scroll',preview,true);ed.canvas.on?.('after:render',preview);preview();return state;
  }
  function check(){const s=state;if(!s)throw Error('请先选择绘制工具。');if(editor()!==s.ed||!s.ed.canvas.getObjects().includes(s.o)||sig(s.o)!==s.signature||host.project?.()!==s.project)throw Error('原图或打印项目已变化，请取消编辑后重新开始。');return s;}
  function point(event){const s=check(),c=s.ed.canvas,r=c.upperCanvasEl.getBoundingClientRect();if(!r.width||!r.height)throw Error("画布不可见");const p=inverse(c.viewportTransform,{x:(event.clientX-r.left)*c.width/r.width,y:(event.clientY-r.top)*c.height/r.height}),q=inverse(s.o.calcTransformMatrix(),p);return{x:(q.x+s.o.width/2)*s.buffer.width/s.o.width,y:(q.y+s.o.height/2)*s.buffer.height/s.o.height};}
  function inside(p,s){if(p.x<0&&p.x>-1e-7)p.x=0;if(p.y<0&&p.y>-1e-7)p.y=0;return p.x>=0&&p.y>=0&&p.x<s.buffer.width&&p.y<s.buffer.height;}
  function preview(){if(!state||previewing)return;previewing=true;const s=state,c=s.ed.canvas,r=c.lowerCanvasEl.getBoundingClientRect(),el=s.overlay;el.style.left=r.left+'px';el.style.top=r.top+'px';el.style.width=r.width+'px';el.style.height=r.height+'px';el.width=c.lowerCanvasEl.width;el.height=c.lowerCanvasEl.height;const ctx=el.getContext('2d'),old=s.o._render,caching=s.o.objectCaching,dirty=s.o.dirty;try{s.o.objectCaching=false;s.o._render=function(ctx){if(s.maskEditor){const maskPreview=s.maskPreview||(s.maskPreview=ops.canvas(s.buffer.width,s.buffer.height)),mx=maskPreview.getContext('2d');mx.globalCompositeOperation='source-over';mx.clearRect(0,0,maskPreview.width,maskPreview.height);mx.drawImage(s.baseImage,0,0);mx.globalCompositeOperation='destination-in';mx.drawImage(s.buffer,0,0);ctx.drawImage(maskPreview,-this.width/2,-this.height/2,this.width,this.height);}else ctx.drawImage(s.buffer,-this.width/2,-this.height/2,this.width,this.height);if(s.tint)ctx.drawImage(s.tint,-this.width/2,-this.height/2,this.width,this.height);if(s.gesture&&["select-rect","select-ellipse","lasso","gradient"].includes(s.gesture.tool)){const g=s.gesture;ctx.save();ctx.translate(-this.width/2,-this.height/2);ctx.scale(this.width/s.buffer.width,this.height/s.buffer.height);ctx.strokeStyle="#008ad8";ctx.lineWidth=1/(c.getZoom?.()||1)*s.buffer.width/this.width;ctx.beginPath();if(g.tool==="select-rect")ctx.rect(g.start.x,g.start.y,g.end.x-g.start.x,g.end.y-g.start.y);else if(g.tool==="select-ellipse")ctx.ellipse((g.start.x+g.end.x)/2,(g.start.y+g.end.y)/2,Math.abs(g.end.x-g.start.x)/2,Math.abs(g.end.y-g.start.y)/2,0,0,Math.PI*2);else{ctx.moveTo(g.start.x,g.start.y);for(const p of g.points)ctx.lineTo(p.x,p.y);ctx.lineTo(g.end.x,g.end.y);}ctx.stroke();ctx.restore();}};ctx.setTransform(el.width/c.width,0,0,el.height/c.height,0,0);c.renderCanvas(ctx,c.getObjects());}finally{s.o._render=old;s.o.objectCaching=caching;s.o.dirty=dirty;previewing=false;}}
  function current(s){try{return state===s&&check()===s;}catch{return false;}}
  function remember(){const s=check(),bytes=s.buffer.width*s.buffer.height*5;if(bytes>192*1024*1024)throw Error('此图过大，无法分配本次编辑撤销内存；未修改图片');const entry={image:s.context.getImageData(0,0,s.buffer.width,s.buffer.height),mask:s.selection?.slice()||null,dirty:s.dirty};s.history.push(entry);s.future=[];const count=Math.max(1,Math.min(12,Math.floor(192*1024*1024/bytes)));while(s.history.length>count)s.history.shift();}
  function setSelection(mask){const s=check();s.selection=mask;s.mask=mask?ops.maskCanvas(mask,s.buffer.width,s.buffer.height):null;s.tint=mask?ops.maskCanvas(mask,s.buffer.width,s.buffer.height,true):null;preview();}
  function undo(redo=false){if(working)throw Error('请等待当前处理结束');const s=check(),from=redo?s.future:s.history,to=redo?s.history:s.future;if(!from.length)return false;const entry=from.pop();to.push({image:s.context.getImageData(0,0,s.buffer.width,s.buffer.height),mask:s.selection?.slice()||null,dirty:s.dirty});s.context.putImageData(entry.image,0,0);s.dirty=entry.dirty;setSelection(entry.mask);return true;}
  function clipScratch(s,scratch,x=0,y=0){if(s.mask){const c=scratch.getContext('2d');c.globalCompositeOperation='destination-in';c.drawImage(s.mask,-x,-y);c.globalCompositeOperation='source-over';}}
  function stamp(a,b){const s=check(),radius=options.size/2+2;
   const x=Math.max(0,Math.floor(Math.min(a.x,b.x)-radius)),y=Math.max(0,Math.floor(Math.min(a.y,b.y)-radius));
   const right=Math.min(s.buffer.width,Math.ceil(Math.max(a.x,b.x)+radius)),bottom=Math.min(s.buffer.height,Math.ceil(Math.max(a.y,b.y)+radius));if(right<=x||bottom<=y)return;
   const patch=ops.canvas(right-x,bottom-y),ctx=patch.getContext('2d');ctx.translate(-x,-y);ctx.strokeStyle=s.maskEditor?'#ffffff':options.color;ctx.fillStyle=s.maskEditor?'#ffffff':options.color;ctx.lineWidth=options.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.arc(b.x,b.y,options.size/2,0,Math.PI*2);ctx.fill();ctx.setTransform(1,0,0,1,0,0);
   if(tool==='clone'||tool==='heal'){
    if(!s.cloneOffset)throw Error('先按 Alt 并点击图片，设置取样点');
    ctx.globalCompositeOperation='source-in';ctx.drawImage(s.cloneSource,-s.cloneOffset.x-x,-s.cloneOffset.y-y);ctx.globalCompositeOperation='source-over';
    if(tool==='heal'){
     // Sampled healing: local mean matching, not content-aware generation.
     const dest=s.context.getImageData(x,y,patch.width,patch.height),src=ctx.getImageData(0,0,patch.width,patch.height);let count=0;const delta=[0,0,0];
     for(let i=0;i<src.data.length;i+=4)if(src.data[i+3]&&dest.data[i+3]){count++;for(let k=0;k<3;k++)delta[k]+=dest.data[i+k]-src.data[i+k];}
     if(count)for(let i=0;i<src.data.length;i+=4)for(let k=0;k<3;k++)src.data[i+k]+=delta[k]/count;ctx.putImageData(src,0,0);
    }
   }
   clipScratch(s,patch,x,y);s.context.save();s.context.globalAlpha=options.opacity;s.context.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';s.context.drawImage(patch,x,y);s.context.restore();patch.width=patch.height=0;s.dirty=true;preview();
  }
  async function region(p,fillMode=false){const s=check();working=true;try{const image=s.context.getImageData(0,0,s.buffer.width,s.buffer.height),mask=await ops.flood(image.data,image.width,image.height,p.x,p.y,options.tolerance,options.contiguous,()=>current(s));if(!current(s))return;remember();if(fillMode){const paint=ops.maskCanvas(mask,image.width,image.height),c=paint.getContext('2d');c.globalCompositeOperation='source-in';c.fillStyle=options.color;c.fillRect(0,0,paint.width,paint.height);clipScratch(s,paint);s.context.save();s.context.globalAlpha=options.opacity;s.context.drawImage(paint,0,0);s.context.restore();s.dirty=true;preview();}else{setSelection(ops.combine(s.selection,mask,options.selectionMode));say('蓝色覆盖表示像素选区；绘画、填充和调整仅影响选区。');}}finally{working=false;}}
  function capture(s,e){try{s.overlay.setPointerCapture(e.pointerId);s.captures.add(e.pointerId);}catch{}}
  function release(s){const ids=[...s.captures];s.captures.clear();for(const id of ids)try{if(s.overlay.hasPointerCapture(id))s.overlay.releasePointerCapture(id);}catch{}}
  function abortGesture(){if(!state)return;const s=state;s.down=false;s.last=null;s.gesture=null;release(s);preview();}
  function visibility(){if(document.hidden)abortGesture();}
  function down(e){if(working||e.button!==0)return;try{const s=check(),p=point(e);if(!inside(p,s))return;e.preventDefault();
   if((tool==='clone'||tool==='heal')&&e.altKey){s.origin=p;s.cloneOffset=null;say('已设置取样点；在目标位置拖动绘制。');return;}
   if(tool==='eyedropper'){const v=s.context.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;options.color='#'+Array.from(v.slice(0,3),x=>x.toString(16).padStart(2,'0')).join('');onOptionsChange({...options});return;}
   if(tool==='wand'||tool==='fill'){region(p,tool==='fill').catch(error=>say(error.message));return;}
   if(['clone','heal'].includes(tool)){if(!s.origin)throw Error('先按 Alt 并点击图片，设置取样点');s.cloneOffset={x:s.origin.x-p.x,y:s.origin.y-p.y};s.cloneSource=ops.canvas(s.buffer.width,s.buffer.height);s.cloneSource.getContext('2d').drawImage(s.buffer,0,0);}
   remember();capture(s,e);s.down=true;s.last=p;s.gesture={tool,start:p,end:p,points:[p]};if(['brush','eraser','clone','heal'].includes(tool))stamp(p,p);
  }catch(error){abortGesture();say(error.message);}}
  function move(e){if(!state?.down||working)return;if(!(e.buttons&1)){abortGesture();return;}try{const s=check(),p=point(e);s.gesture.end=p;if(tool==='lasso'){if(s.gesture.points.length>=20000)throw Error('套索节点过多，请分段选择');s.gesture.points.push(p);}if(['brush','eraser','clone','heal'].includes(tool))stamp(s.last,p);else preview();s.last=p;}catch(error){abortGesture();say(error.message);}}
  function up(e){if(!state)return;const s=state;if(e&&e.button!==0)return;const g=s.gesture;s.down=false;s.last=null;s.gesture=null;release(s);if(!g)return;try{check();if(['select-rect','select-ellipse','lasso'].includes(g.tool)){
   const c=ops.canvas(s.buffer.width,s.buffer.height),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.beginPath();const x=Math.min(g.start.x,g.end.x),y=Math.min(g.start.y,g.end.y),w=Math.abs(g.end.x-g.start.x),h=Math.abs(g.end.y-g.start.y);
   if(g.tool==='select-rect')ctx.rect(x,y,w,h);else if(g.tool==='select-ellipse')ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else{ctx.moveTo(g.start.x,g.start.y);for(const p of g.points)ctx.lineTo(p.x,p.y);ctx.closePath();}ctx.fill();setSelection(ops.combine(s.selection,ops.maskFromCanvas(c),options.selectionMode));
  }else if(g.tool==='gradient'){
   if(Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)<.5)return;const c=ops.canvas(s.buffer.width,s.buffer.height),ctx=c.getContext('2d'),grad=ctx.createLinearGradient(g.start.x,g.start.y,g.end.x,g.end.y);grad.addColorStop(0,options.color);grad.addColorStop(1,options.color2);ctx.fillStyle=grad;ctx.fillRect(0,0,c.width,c.height);clipScratch(s,c);s.context.save();s.context.globalAlpha=options.opacity;s.context.drawImage(c,0,0);s.context.restore();s.dirty=true;
  }preview();}catch(error){say(error.message);}}
  async function selection(operation,p={}){if(working)throw Error('请等待处理完成');const s=await begin();check();remember();const w=s.buffer.width,h=s.buffer.height;
   if(operation==='all')setSelection(new Uint8ClampedArray(w*h).fill(255));
   else if(operation==='none')setSelection(null);
   else if(operation==='invert'){const m=s.selection?.slice()||new Uint8ClampedArray(w*h).fill(255);for(let i=0;i<m.length;i++)m[i]=255-m[i];setSelection(m);}
   else if(operation==='feather'){if(!s.mask)throw Error('请先创建像素选区');const radius=Number(p.radius??3);if(!Number.isFinite(radius)||radius<0||radius>100)throw Error('羽化半径须为 0–100 像素');const c=ops.canvas(w,h),ctx=c.getContext('2d');ctx.filter=`blur(${radius}px)`;ctx.drawImage(s.mask,0,0);setSelection(ops.maskFromCanvas(c));}
   else if(['delete','fill','cutout'].includes(operation)){if(!s.mask)throw Error('请先创建像素选区');s.context.save();if(operation==='cutout'){s.context.globalCompositeOperation='destination-in';s.context.drawImage(s.mask,0,0);}else{const c=ops.canvas(w,h),ctx=c.getContext('2d');ctx.drawImage(s.mask,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=options.color;ctx.fillRect(0,0,w,h);s.context.globalCompositeOperation=operation==='delete'?'destination-out':'source-over';s.context.globalAlpha=operation==='delete'?1:options.opacity;s.context.drawImage(c,0,0);}s.context.restore();s.dirty=true;preview();}
   else throw Error('未知选区操作');
  }
  async function adjust(operation,params={}){if(working)throw Error('请等待处理完成');const s=await begin();check();working=true;try{remember();const original=s.context.getImageData(0,0,s.buffer.width,s.buffer.height);let result;
   if(operation==='blur'){const radius=Number(params.radius??2);if(!Number.isFinite(radius)||radius<0||radius>40)throw Error('模糊半径须为 0–40 原图像素');const c=ops.canvas(s.buffer.width,s.buffer.height),ctx=c.getContext('2d');ctx.filter=`blur(${radius}px)`;ctx.drawImage(s.buffer,0,0);result=ctx.getImageData(0,0,c.width,c.height);}
   else result=await ops.filter(new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),operation,params,()=>current(s));
   if(!current(s))return;
   if(s.selection)for(let i=0;i<s.selection.length;i++){const a=s.selection[i]/255;for(let k=0;k<4;k++)result.data[i*4+k]=original.data[i*4+k]*(1-a)+result.data[i*4+k]*a;}
   s.context.putImageData(result,0,0);s.dirty=true;preview();
  }finally{working=false;}}

  function forwardRight(event){
   if(!state||(event.button!==2&&event.type!=='contextmenu'))return;
   const s=state,target=s.ed.canvas.upperCanvasEl;if(!target)return;
   event.preventDefault();event.stopPropagation();
   const init={bubbles:true,cancelable:true,composed:true,clientX:event.clientX,clientY:event.clientY,screenX:event.screenX,screenY:event.screenY,button:event.button,buttons:event.buttons,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey,pointerId:event.pointerId,pointerType:event.pointerType||'mouse',isPrimary:event.isPrimary};
   target.dispatchEvent(event.type.startsWith('pointer')?new PointerEvent(event.type,init):new MouseEvent(event.type,init));
   // Cancelling pointerdown suppresses the browser's compatibility mouse events.
   // Recreate those events explicitly, and retain the matching pointerup even when
   // the native context menu temporarily lowers the editing overlay.
   if(event.type==='pointerdown'){
    target.dispatchEvent(new MouseEvent('mousedown',init));
    try{s.overlay.setPointerCapture(event.pointerId);}catch{}
   }
   if(event.type==='pointerup')target.dispatchEvent(new MouseEvent('mouseup',init));
  }

  function cancel(){preparation++;abortGesture();if(state){state.menuObserver?.disconnect();state.ed.canvas.off?.('after:render',preview);state.overlay.remove();state=null;window.removeEventListener('resize',preview);window.removeEventListener('scroll',preview,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',abortGesture,true);window.removeEventListener('blur',abortGesture);document.removeEventListener('visibilitychange',visibility);}say('已退出图片编辑。');}
  async function activate(name){const maskMode=name.startsWith('mask-');if(maskMode)name=name.slice(5);if(state&&state.maskEditor!==maskMode)await finish();requestedMask=maskMode;if(!['brush','eraser','eyedropper','fill','wand','select-rect','select-ellipse','lasso','gradient','clone','heal'].includes(name))throw Error('未知绘制工具。');if(working)throw Error('请等待处理完成');await begin();check();abortGesture();tool=name;say(state.maskEditor?'蒙版编辑：画笔显示原图，橡皮隐藏原图；完成后保留可编辑蒙版。':state.layerDoc?'正在编辑原始像素；完成后会重新应用已保存的蒙版和图层调整。':'直接在画布图片上操作；完成后点击应用，取消可放弃修改。');}
  async function finish(){if(working)throw Error('正在应用图片。');const s=check();if(!s.dirty){cancel();return false;}working=true;try{let dataUrl=s.buffer.toDataURL('image/png');if(s.layerDoc||s.maskEditor){const doc=s.layerDoc||EPCLayerDocument.defaults((()=>{const c=ops.canvas(s.baseImage.naturalWidth||s.baseImage.width,s.baseImage.naturalHeight||s.baseImage.height);c.getContext('2d').drawImage(s.baseImage,0,0);return c.toDataURL('image/png');})());if(s.maskEditor){doc.mask=dataUrl;doc.maskEnabled=true;}else doc.base=dataUrl;const rendered=await EPCLayerDocument.render(doc);dataUrl=await EPCLayerDocument.encode(rendered,doc);rendered.width=rendered.height=0;}if(!dataUrl.startsWith('data:image/png;base64,'))throw Error('图片超出浏览器导出能力。');await save(dataUrl);check();const command=await EPCLayerDocument.replace({ed:s.ed,host,o:s.o,src:dataUrl});if(!command?.newHash)throw Error('宿主未确认替换成功，请检查项目。');cancel();say('图片已应用，可使用 eufyMake 撤销。');return true;}finally{working=false;}}
  return{activate,adjust,selection,undo,finish,cancel,exportSelection:()=>state?.mask?.toDataURL('image/png')||null,isBusy:()=>working,hasSelection:()=>!!state?.selection,setOptions(next){const merged={...options,...next};if(!Number.isFinite(Number(merged.size))||merged.size<.1||merged.size>4096||!Number.isFinite(Number(merged.opacity))||merged.opacity<0||merged.opacity>1||!/^#[\da-f]{6}$/i.test(merged.color))throw Error('画笔参数无效。');if(!Number.isFinite(Number(merged.tolerance))||merged.tolerance<0||merged.tolerance>255||!/^#[\da-f]{6}$/i.test(merged.color2)||!['replace','add','subtract','intersect'].includes(merged.selectionMode))throw Error('选区参数无效');options={...merged,size:Number(merged.size),opacity:Number(merged.opacity),tolerance:Number(merged.tolerance),contiguous:!!merged.contiguous};onOptionsChange({...options});},getOptions:()=>({...options}),isActive:()=>!!state};
 }
 window.EPCRaster={create};
})();

/* Persistent adjustments and masks use the native replacement command. */
(()=>{'use strict';
function create({editor,host,raster,finish,status,save}){
 function selected(){const ed=editor(),o=ed.canvas.getActiveObject();if(!o||o.type!=='image'||o.group||o._parentId||o.cropX||o.cropY||o.filters?.length||/workspace/i.test(o.id||''))throw Error('请选择未裁切的普通图片或 PSD 图片图层');return{ed,o,project:host.project()};}
 async function documentFor(o){return EPCLayerDocument.fromElement(await host.original(o));}
 async function info(){const {o}=selected(),doc=await documentFor(o);return{adjustments:doc.adjustments,effects:doc.effects,mask:!!doc.mask,maskEnabled:doc.maskEnabled!==false,blendMode:o.globalCompositeOperation||'source-over'};}
 async function update(edit){await finish();const {ed,o,project}=selected(),doc=await documentFor(o),originalSrc=(await host.original(o)).src;await edit(doc);const canvas=await EPCLayerDocument.render(doc);try{const src=await EPCLayerDocument.encode(canvas,doc);if(editor()!==ed||host.project()!==project||!ed.canvas.getObjects().includes(o)||(await host.original(o)).src!==originalSrc)throw Error('图层或项目已变化，未应用');await save(src);const result=await EPCLayerDocument.replace({ed,host,o,src});if(!result?.newHash)throw Error('原版未确认图层更新');status('可编辑图层设置已应用，可使用原版保存和撤销。');return true;}finally{canvas.width=canvas.height=0;}}
 async function apply(v){return update(doc=>{doc.adjustments=[{operation:'brightnessContrast',params:{brightness:Number(v.brightness)/100,contrast:Number(v.contrast)/100}},{operation:'saturation',params:{amount:1+Number(v.saturation)/100}},{operation:'levels',params:{black:Number(v.black),white:Number(v.white),gamma:Number(v.gamma)}},{operation:'curves',params:{q1:Number(v.q1),q2:Number(v.q2),q3:Number(v.q3)}}];doc.effects={stroke:Number(v.stroke),strokeColor:v.strokeColor,shadow:Number(v.shadow),shadowX:Number(v.shadowX),shadowY:Number(v.shadowY),shadowColor:v.shadowColor,shadowOpacity:Number(v.shadowOpacity)/100};});}
 async function mask(operation){const selectedMask=operation==='selection'?raster.exportSelection():null;if(operation==='selection'&&!selectedMask)throw Error('请先建立像素选区');return update(async doc=>{if(operation==='selection')doc.mask=selectedMask;else if(operation==='remove')doc.mask=null;else if(operation==='toggle')doc.maskEnabled=doc.maskEnabled===false;else if(operation==='invert'){if(!doc.mask)throw Error('此图层还没有蒙版');const im=await EPCLayerDocument.image(doc.mask),c=EPCRasterOps.canvas(im.width,im.height),x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height);for(let i=3;i<d.data.length;i+=4)d.data[i]=255-d.data[i];x.putImageData(d,0,0);doc.mask=c.toDataURL('image/png');}else throw Error('未知蒙版操作');});}
 async function reset(){return update(doc=>{doc.adjustments=[];doc.effects=EPCLayerDocument.defaults('').effects;});}
 async function blend({mode}){const modes=['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'];if(!modes.includes(mode))throw Error('未知混合模式');await finish();const {ed,o}=selected();const result=await ed.executeCommand('propertyCommand',{ids:[o.id],properties:['globalCompositeOperation'],oldValues:{[o.id]:[o.globalCompositeOperation||'source-over']},newValues:{[o.id]:[mode]}});if(!result||o.globalCompositeOperation!==mode)throw Error('原版未确认混合模式');ed.canvas.requestRenderAll();status('混合模式已应用，可使用原版撤销。');}
 return{info,apply,mask,reset,blend};
}
window.EPCLayerControls={create};})();
