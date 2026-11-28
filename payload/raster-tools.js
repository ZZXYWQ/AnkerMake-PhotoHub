/* Shared visual language for controls added to the native editor. */
(()=>{'use strict';
const css=`
.epc-native{--ph-accent:#33bf5a;--ph-accent-soft:#effaf2;--ph-text:#25282a;--ph-muted:#85898c;--ph-line:#eceeef;--ph-fill:#f5f6f7;font:400 12px/1.5 "Mont For Anker","Microsoft YaHei UI",sans-serif!important;color:var(--ph-text)!important;box-sizing:border-box}
.epc-native *{box-sizing:border-box}.epc-native [hidden]{display:none!important}
.epc-native button,.epc-native input,.epc-native select{font:inherit!important;outline:none;transition:background-color .12s,border-color .12s}
.epc-native button{min-height:30px;border:1px solid var(--ph-line);border-radius:7px;background:#fff;color:var(--ph-text);padding:6px 12px}
.epc-native button:hover:not(:disabled){background:#f5f6f7}.epc-native button:focus-visible,.epc-native input:focus-visible,.epc-native select:focus-visible{outline:2px solid #33bf5a55;outline-offset:2px}
.epc-native button[role=switch]{min-height:0}.epc-native input[type=file]{width:100%;font:inherit;color:#85898c}.epc-native input[type=file]::file-selector-button{font:inherit;background:#f5f6f7;color:#333;border:0;border-radius:6px;padding:7px 10px;margin-right:10px}.epc-native button:disabled{opacity:.42;cursor:default}.epc-native input:not([type=checkbox]):not([type=color]):not([type=range]):not([type=file]),.epc-native select{height:30px;border:1px solid transparent!important;border-radius:7px!important;background:var(--ph-fill)!important;padding:5px 9px!important;min-width:0;color:var(--ph-text)}
.epc-native input[type=number]{width:84px;text-align:right;appearance:textfield}.epc-native input[type=number]::-webkit-inner-spin-button{appearance:none}
.epc-native input[type=color]{width:30px;height:26px;border:1px solid var(--ph-line);border-radius:6px;padding:3px;background:white}
.epc-native select{max-width:190px;cursor:pointer}.epc-native input[type=checkbox]{width:14px;height:14px;accent-color:var(--ph-accent);margin:0}
.epc-native input[role=switch]{appearance:none!important;position:relative;width:32px!important;height:18px!important;border:0!important;border-radius:18px!important;background:#d6d9db!important;flex:0 0 auto;cursor:pointer;transition:background .15s}
.epc-native input[role=switch]:before{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0002;transition:transform .15s}
.epc-native input[role=switch]:checked{background:var(--ph-accent)!important}.epc-native input[role=switch]:checked:before{transform:translateX(14px)}
.epc-native label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:30px;font:inherit!important;color:#555b5e}
.epc-native .epc-field{display:grid;gap:12px;margin:0}.epc-native .epc-section-title{font-weight:600;font-size:12px;color:#25282a;margin:0 0 12px}
.epc-native .epc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;font-weight:600;color:#25282a}
.epc-native .epc-panel-head label{min-height:18px}.epc-native .epc-panel-head small{font-size:11px;font-weight:400;color:#8b9093}
.epc-native .epc-helper{font-size:11px;line-height:1.65;color:#8b9093;margin:0}
.epc-native .epc-inline-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}.epc-native .epc-inline-row label{flex:1}.epc-native .epc-mask-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.epc-native .epc-mask-action{font-size:11px!important;padding:6px 8px;text-align:left}.epc-native button[type=submit]{background:#181b1d;color:white;border-color:#181b1d;font-weight:600}.epc-native .epc-divider{height:1px;background:var(--ph-line);margin:4px 0}
.epc-native details{border:0!important;border-top:1px solid var(--ph-line)!important;padding:12px 0 0!important;margin-top:2px}
.epc-native summary{padding:0!important;cursor:pointer;font-size:11px;color:#85898c;list-style:none;display:flex;justify-content:space-between;align-items:center}
.epc-native summary:after{content:"⌄";font-size:14px}.epc-native details[open]>summary{margin-bottom:14px}.epc-native details[open]>summary:after{transform:rotate(180deg)}
.epc-native .epc-primary{background:#181b1d!important;color:white!important;border-color:#181b1d!important;font-weight:600!important}
.epc-native .epc-primary:hover:not(:disabled){background:#303538!important}.epc-native .epc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
.epc-native progress{appearance:none;width:100%;height:3px;border:0;border-radius:3px;overflow:hidden}.epc-native progress::-webkit-progress-bar{background:#edf0ee}.epc-native progress::-webkit-progress-value{background:var(--ph-accent)}
.epc-native .epc-info{width:16px;height:16px;min-height:16px;padding:0;border:1px solid #c5c9cb;border-radius:50%;color:#8b9093;background:transparent;font-size:10px!important;line-height:14px}
#epc-native-bar{height:32px;padding:0 16px;gap:2px;border-color:#eff0f1;box-shadow:none}#epc-native-bar>button{border:0;min-height:26px;padding:4px 10px;border-radius:5px}
body.epc-native-layout #root{top:32px!important;height:calc(100% - 32px)!important}body.epc-native-layout.epc-tool-editing #root{top:68px!important;height:calc(100% - 68px)!important}
#epc-native-options{display:none!important;height:36px;top:32px;gap:14px;background:#fafbfc;padding:0 16px;border-color:var(--ph-line)}body.epc-native-layout.epc-tool-editing #epc-native-options{display:flex!important}
#epc-native-options input,#epc-native-options select{height:26px!important}#epc-native-options label{gap:7px;min-height:26px;font-size:11px!important}
#epc-native-options [data-role=mode]{display:none}#epc-native-options>span:first-child{font-weight:600;padding-right:12px;border-right:1px solid var(--ph-line)}
#epc-native-side{top:32px;width:288px;padding:18px 16px;background:#fff;border-color:var(--ph-line);box-shadow:5px 0 16px #16201908}body.epc-tool-editing #epc-native-side{top:68px}
#epc-native-side>[data-ph-panel-header]{position:sticky;top:-18px;z-index:1;background:#fff;padding:0 0 14px;margin:0 0 16px;border-bottom:1px solid var(--ph-line)}
#epc-native-side>[data-ph-panel-header]>span{font-size:13px;font-weight:600}#epc-native-side [data-close]{width:24px;height:24px;min-height:24px;border:0;padding:0;color:#8b9093;font-size:18px!important}
#epc-native-side .epc-tool-group{margin-bottom:22px}#epc-native-side .epc-tool-group>h3{font:600 11px/1.5 "Mont For Anker","Microsoft YaHei UI",sans-serif;color:#92979a;margin:0 0 10px}
#epc-native-side .epc-tool-grid{grid-template-columns:1fr 1fr;gap:4px}#epc-native-side .epc-tool-grid button{display:flex;align-items:center;gap:9px;min-height:36px;border-color:transparent;padding:8px;text-align:left;background:transparent;font-size:11px}
.epc-tool-icon{display:inline-flex;width:18px;height:18px;flex:0 0 18px;align-items:center;justify-content:center}.epc-tool-icon svg{width:18px;height:18px;stroke:#656c70;stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
#epc-native-entry>span{font:inherit!important;display:flex!important;align-items:center;justify-content:center;height:30px}#epc-native-entry svg{width:23px;height:23px;stroke:#73797c;stroke-width:1.5;fill:none}
#epc-local-relief-mode{outline:0}#epc-local-relief-mode:focus-visible{outline:2px solid #33bf5a55;outline-offset:2px}#epc-local-relief-panel{border:0!important;border-top:1px solid var(--ph-line)!important;border-radius:0!important;padding:18px 0 0!important;margin:16px 0 0!important;background:transparent}
#epc-local-relief-panel select{max-width:176px;width:176px}#epc-local-relief-panel [data-progress]{font-size:11px;line-height:1.6;color:#85898c;overflow-wrap:anywhere}
#epc-image-limit{position:relative!important;left:auto!important;bottom:auto!important;width:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:14px 0!important;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:default}#epc-image-limit[hidden]{display:none!important}#epc-image-limit .epc-limit-icon{display:flex;justify-content:center}#epc-image-limit svg{width:23px;height:23px;stroke:#73797c;stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}#epc-image-limit .menu-item-text{font-size:11px;margin:0;color:#6f767a}#epc-image-limit button[role=switch]{position:relative;width:28px;height:16px;min-height:0;padding:0;border:0;border-radius:10px;background:#33bf5a}#epc-image-limit button[role=switch]>span{position:absolute;top:2px;right:2px;width:12px;height:12px;background:white;border-radius:50%}#epc-image-limit button[role=switch][aria-checked=false]{background:#d6d9db!important}#epc-image-limit button[role=switch][aria-checked=false]>span{right:14px!important}
#epc-composition-panel{padding:16px!important;border-color:var(--ph-line)!important}#epc-composition-panel [role=group]{gap:0!important;padding:3px;background:var(--ph-fill);border-radius:8px}
#epc-composition-panel [data-mode]{border:0!important;background:transparent!important;border-radius:6px;font-size:11px!important}#epc-composition-panel [data-mode][aria-pressed=true]{background:#fff!important;color:#2ca651;box-shadow:0 1px 4px #1620190a}
#epc-ink-control{margin-top:16px!important;padding-top:16px!important;border-color:var(--ph-line)!important}#epc-ink-control [data-channels]{display:grid!important;grid-template-columns:repeat(4,1fr);gap:6px!important}#epc-ink-control [data-channels] label{justify-content:center;gap:7px!important;min-height:30px;border:1px solid var(--ph-line);background:var(--ph-fill);border-radius:7px;font-weight:500!important}#epc-ink-control [data-channels] label:has(input:checked){border-color:#b8eac5;background:#f5fbf6}#epc-ink-control [data-all]{font-size:11px!important;color:#85898c!important;padding:0;min-height:20px}#epc-ink-control [data-note]{font-size:11px!important}#epc-ink-control [data-channels] label{position:relative;gap:6px!important;cursor:pointer}#epc-ink-control [data-channels] label input{position:absolute;width:1px;height:1px;opacity:0}#epc-ink-control [data-channels] label:after{content:"";width:10px;font-size:10px;color:#33bf5a}#epc-ink-control [data-channels] label:has(input:checked):after{content:"✓"}#epc-ink-control [data-channels] label:has(input:disabled){opacity:.45;cursor:default}#epc-ink-control [data-channels] label:focus-within{outline:2px solid #33bf5a55;outline-offset:2px}#epc-ink-control .epc-channel-mark{font-size:12px;font-weight:600}#epc-ink-control [data-ink=C]{color:#219bc2}#epc-ink-control [data-ink=M]{color:#ce4386}#epc-ink-control [data-ink=Y]{color:#b59c1e}#epc-ink-control [data-ink=K]{color:#30363a}
#epc-print-algorithm{font:400 12px/1.5 "Mont For Anker","Microsoft YaHei UI",sans-serif!important}#epc-print-algorithm button{min-height:36px!important;border:0!important;padding:8px 12px!important;color:#333!important}#epc-print-algorithm [data-check]{color:#33bf5a}
.epc-native[role=menu]{border:1px solid var(--ph-line)!important;border-radius:9px!important;padding:5px!important;box-shadow:0 5px 22px #16201912!important}.epc-native [role=menuitem]{border-radius:5px;padding:7px 10px;min-height:30px}
#epc-native-status{font-size:12px!important;border-color:#eceeef;box-shadow:0 4px 20px #1620190d;border-radius:8px;padding:9px 14px;max-width:500px}
`;
const paths={wand:'m5 19 10-10m-2-2 4 4M5 3v4M3 5h4m11 9v4m-2-2h4M10 2v2',
 'select-rect':'M4 4h16v16H4z','select-ellipse':'M20 12a8 6 0 1 1-16 0 8 6 0 1 1 16 0',
 lasso:'M9 18c-5-1-7-5-4-9 3-5 14-4 15 2 1 4-7 9-11 5-2-2 0-4 2-3 4 1 3 7-1 8',
 brush:'m14 5 5 5m-9 5L20 5l-2-2L8 13m2 2c-1 5-5 5-7 5 2-2 0-5 5-7z',
 eraser:'m5 17-2-2 11-11 6 6-11 11H5l-2-2m7-10 6 6M9 21h12',
 eyedropper:'m14 4 6 6m-3-7 4 4-3 3-2-2-10 10-3 1 1-3L14 6l-1-1z',
 fill:'m4 11 8-8 8 8-8 8zm0 0h16m-12-9 5 5m6 7c0 0-3 4-3 5a3 3 0 0 0 6 0c0-1-3-5-3-5',
 clone:'M5 19h14v3H5zM8 16v-4h2V8a3 3 0 1 1 4 0v4h2v4z',
 heal:'m5 10 5-5a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6-6zm3-3 9 9m-6-6h.1m2 2h.1',
 gradient:'M4 4h16v16H4zm4 0v16m4-16v16m4-16v16',
 'adjust-form':'M4 7h16M4 17h16M8 4v6m8 4v6',
 'contour-new':'M4 18 9 5l11 7-7 8zM7 3h4v4H7zm11 7h4v4h-4zM2 16h4v4H2z',
 'contour-edit':'M4 19 8 6l12 9-7 5m-7-2 3-10 9 7M6 4h4v4H6zm12 9h4v4h-4z',
 'contour-form':'M5 5h4M5 5v4m14-4h-4m4 0v4M5 19h4m-4 0v-4m14 4h-4m4 0v-4M8 12l3-4 5 3-2 5-5-1z',
 rect:'M4 5h16v14H4z',ellipse:'M20 12a8 7 0 1 1-16 0 8 7 0 1 1 16 0',
 simplify:'M3 18 9 7l6 8 6-12M7 5h4v4H7zm6 8h4v4h-4z',smooth:'M3 18c4-1 4-12 9-12s4 11 9 12',
 'delete-node':'M4 12h16',entry:'M5 17 16 6l3 3L8 20H4zm9-13 3-3 5 5-3 3M4 4h5m-5 0v5'};
function icon(id){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[id]||paths.entry)+'"/></svg>';}
function install(){let style=document.querySelector('#epc-theme');if(!style){style=document.createElement('style');style.id='epc-theme';document.head.append(style);}style.textContent=css;return style;}
window.EPCTheme={install,icon};
})();

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
 if(!m&&window.__EPC_RUNTIME)throw Error('当前版本尚未确认原版保存接口，请等待 PhotoHub 完成版本校验；未修改图片');
 if(m){if(m.canvasEditor!==ed||typeof m.changeEditorSaveState!=='function')throw Error('原版保存接口不匹配，未修改图片');cached=m;}return m;
}
async function replace({ed,host,o,src}){const m=await managerFor(ed,host),project=host.project?.();if(m?.getIsLoadingProject?.()||o._isCropping)throw Error('原版仍在加载或裁剪，请完成当前操作后重试');try{return await ed.executeCommand('replaceImageCommand',{objectId:o.id,src});}finally{if(m&&host.editor()===ed&&host.project?.()===project&&!m._isLoadFirstInProgress&&!m.localProjectLoadFailed&&!m.projectLoadFailed&&!ed.canvas.getObjects().some(item=>item._isCropping))m.changeEditorSaveState(true,false);}}
window.EPCLayerDocument.replace=replace;
})();

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

/* Preview-only tiles. Never replace design objects, source caches or printer data. */
(()=>{'use strict';
let Engine=null;
const stats={built:0,tiles:0,error:null};
function plan(w,h,maxWidth=1024,maxHeight=2048){
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1)throw Error('高清预览尺寸无效');
 const width=Math.min(w,maxWidth,Math.floor(Math.sqrt(32*1024*1024*w/h))),scale=width/w,height=Math.round(h*scale),parts=[];
 for(let y=0;y<height;y+=maxHeight){const end=Math.min(height,y+maxHeight);parts.push({width,height:end-y,from:y/height,to:end/height});}
 return parts;
}
function load(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('高清预览高度图读取失败'));image.src=src;});}
function adjustments(p){return {contrast:p.contrastNew??0,gamma:p.gamma??7,grayPercent:p.grayPercent??0,invert:p.invert??false};}
async function withEngine(task){
 const canvas=document.createElement('canvas');let engine;
 try{engine=new Engine(canvas);return await task(engine);}
 finally{engine?.dispose();canvas.width=canvas.height=0;canvas.remove();}
}
async function buffer(engine,src,p,width,height){
 if(!await engine.init(src,width,height,undefined,undefined,true))throw Error('高清预览高度缓冲初始化失败');
 engine.setGlobalAdjustments(adjustments(p));const b=engine.readGrayBuffer();if(!b?.gray)throw Error('高清预览高度缓冲不可用');return b;
}
async function expand(data){
 const host=window.__EPC_HOST,ed=host?.editor(),objects=ed?.canvas?.getObjects()||[];
 stats.last={count:data.grayData?.length,ids:data.grayData?.map(x=>({id:x.id,active:x.activeObject?.id,size:x.sizeWidth})),mode:window.__EPC_COMPOSITION?.sync?.().mode,engine:!!Engine};
 // Overlapping craft composition needs its own full-resolution compositor. Do not
 // silently substitute per-object heights for the composed result.
 if(!Engine||data.grayData?.length!==1||window.__EPC_COMPOSITION?.sync?.().mode==='top')return null;
 const entry=data.grayData[0],o=objects.find(o=>o.id===entry.id||o.id===entry.activeObject?.id);
 if(entry.grayPercent>0)return null;
 if(!o||o.cropPath||o.angle||o.flipX||o.flipY||!o._cacheGrayHash)return null;
 const color=o._element||await host.original(o),w=color.naturalWidth||color.width,h=color.naturalHeight||color.height;
 if(h/w<8||Math.max(w,h)<=4096)return null;
 const signature=[host.project(),o._cacheHash,o._cacheGrayHash,o.width,o.height,o.scaleX,o.scaleY].join('|');
 let gray=null;const canvas=document.createElement('canvas'),layers=[],buffers={},records=[];
 try{
  gray=await load(await ed.getImageResource(o._cacheGrayHash));
  if(Math.abs(gray.naturalWidth/gray.naturalHeight-w/h)>w/h*.01)throw Error('高度图比例与原图不一致');
  const totalHeight=entry.sizeWidth*h/w;
  await withEngine(async engine=>{for(const [index,t] of plan(w,h).entries()){
   if(!window.__PH_PREVIEW_SESSION_ACTIVE||host.editor()!==ed)throw Error('已退出高清预览');
   canvas.width=t.width;canvas.height=t.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('高清预览内存不足');
   ctx.drawImage(color,0,t.from*h,w,(t.to-t.from)*h,0,0,t.width,t.height);const colorUrl=canvas.toDataURL('image/png');
   ctx.clearRect(0,0,t.width,t.height);ctx.drawImage(gray,0,t.from*gray.naturalHeight,gray.naturalWidth,(t.to-t.from)*gray.naturalHeight,0,0,t.width,t.height);const grayUrl=canvas.toDataURL('image/png');
   const id=entry.id+'__phPreviewTile'+index;
   const tile={...entry,id,posY:entry.posY+((t.from+t.to)/2-.5)*totalHeight,grayImg:grayUrl,grayColorImg:colorUrl,normal:null};
   buffers[id]=await buffer(engine,grayUrl,tile,t.width,t.height);layers.push(tile);records.push({id,src:grayUrl,width:t.width,height:t.height,buffer:buffers[id]});
   await new Promise(resolve=>setTimeout(resolve,0));
  }});
  if(signature!==[host.project(),o._cacheHash,o._cacheGrayHash,o.width,o.height,o.scaleX,o.scaleY].join('|')||host.editor()!==ed||!ed.canvas.getObjects().includes(o))throw Error('设计已变化，取消高清预览');
  stats.built++;stats.tiles=layers.length;stats.error=null;
  return {data:{...data,grayData:layers,bufferData:buffers,__phPreviewTiles:true},originalId:entry.id,records};
 }finally{if(gray)gray.src='';canvas.width=canvas.height=0;canvas.remove();}
}
function install(prototype,engine){
 if(engine)Engine=engine;if(!prototype?.create||prototype.__phPreviewTiles===2)return;
 const create=prototype.create,update=prototype.updateFromBuffer;
 prototype.create=function(data,done,options){
  stats.called={session:this.sessionId,active:window.__PH_PREVIEW_SESSION_ACTIVE};
  if(this.sessionId!=='texture-preview'||!window.__PH_PREVIEW_SESSION_ACTIVE||data?.__phPreviewTiles)return create.call(this,data,done,options);
  const request=this.__phTileRequest=(this.__phTileRequest||0)+1;
  this.__phTileState=null;
  expand(data).then(result=>{if(request!==this.__phTileRequest||!window.__PH_PREVIEW_SESSION_ACTIVE)return;this.__phTileState=result;create.call(this,result?.data||data,done,options);}).catch(error=>{stats.error=error.message;if(request===this.__phTileRequest&&window.__PH_PREVIEW_SESSION_ACTIVE)create.call(this,data,done,options);});
 };
 prototype.updateFromBuffer=function(b,p,n){
  const state=this.__phTileState;if(!state||p.id!==state.originalId)return update.call(this,b,p,n);
  const revision=this.__phTileRevision=(this.__phTileRevision||0)+1;
  withEngine(async engine=>{for(const t of state.records){const next=await buffer(engine,t.src,p,t.width,t.height);if(revision!==this.__phTileRevision||state!==this.__phTileState)return;t.buffer=next;update.call(this,next,{...p,id:t.id});}}).catch(error=>{stats.error=error.message;});
 };
 if(!prototype.__phPreviewTiles)Object.defineProperty(prototype,'__phPreviewTiles',{value:2,configurable:true});
}
window.EPCReliefTiles={install,plan,stats};
})();

/* GPU-only preview sizing. Original raster and printer height fields are untouched. */
(()=>{'use strict';
let installed=false,checking=null;
const stats={resized:0,last:null,legacyResized:0,legacyLast:null};
document.addEventListener?.('click',e=>{if(e.target.closest?.('button[class*="_ButtonPreview_"]'))window.__PH_PREVIEW_SESSION_ACTIVE=true;},true);
if(typeof MutationObserver==='function')new MutationObserver(()=>{if(document.body.classList.contains('epc-native-layout'))window.__PH_PREVIEW_SESSION_ACTIVE=false;}).observe(document.body,{attributes:true,attributeFilter:['class']});
function installScene(prototype,engine){
 if(!prototype||typeof prototype.getTextureGeometry!=='function')throw Error('原版浮雕预览场景接口不匹配');
 window.EPCReliefTiles?.install(prototype,engine);
 if(prototype.__photoHubBoundedScene)return true;
 const original=prototype.getTextureGeometry;
 prototype.getTextureGeometry=function(image,options){
  const w=image?.naturalWidth||image?.width,h=image?.naturalHeight||image?.height,ratio=(options.sizeWidth||this.widthMM)/this.widthMM;
  const multiplier=ratio*(ratio<.8?1:this.quality)*Math.max(1,10/(w*ratio));
  if(!Number.isFinite(multiplier)||multiplier<=0)throw Error('浮雕预览尺寸无效；设计保持不变');
  const maxSide=2048,maxPixels=2048*2048;
  if(Math.max(w,h)*multiplier<=maxSide&&w*h*multiplier*multiplier<=maxPixels)return original.call(this,image,options);
  const boundedMultiplier=ratio*Math.max(1,10/(w*ratio));
  const scale=Math.min(1,maxSide/(Math.max(w,h)*boundedMultiplier),Math.sqrt(maxPixels/(w*h*boundedMultiplier*boundedMultiplier)));
  const proxy=document.createElement('canvas');
  try{
   proxy.width=Math.max(1,Math.floor(w*scale));proxy.height=Math.max(1,Math.floor(h*scale));
   const next=ratio*Math.max(1,10/(proxy.width*ratio));
   if(Math.max(proxy.width,proxy.height)*next>maxSide+1||proxy.width*proxy.height*next*next>maxPixels+1)throw Error('图片比例超出三维预览能力；原图与高度图未修改');
   const context=proxy.getContext('2d');if(!context)throw Error('无法分配浮雕预览画布；设计保持不变');
   context.drawImage(image,0,0,proxy.width,proxy.height);
   stats.legacyResized++;stats.legacyLast={from:[w,h],to:[proxy.width,proxy.height],maxSide};
   const quality=this.quality;
   try{this.quality=1;return original.call(this,proxy,options);}finally{this.quality=quality;}
  }finally{proxy.width=0;proxy.height=0;proxy.remove();}
 };
 Object.defineProperty(prototype,'__photoHubBoundedScene',{value:true});return true;
}
function fit(image,limit){
 if(!image||!ArrayBuffer.isView(image.data)||image.depth>1)return image;
 const {width:w,height:h,data}=image,channels=data.length/(w*h);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!Number.isInteger(limit)||limit<1||!Number.isInteger(channels)||channels<1||channels>4||Math.max(w,h)<=limit)return image;
 const ratio=limit/Math.max(w,h),width=Math.max(1,Math.floor(w*ratio)),height=Math.max(1,Math.floor(h*ratio)),output=new data.constructor(width*height*channels);
 for(let y=0;y<height;y++){const sy=Math.min(h-1,Math.floor((y+.5)*h/height));for(let x=0;x<width;x++){const sx=Math.min(w-1,Math.floor((x+.5)*w/width)),from=(sy*w+sx)*channels,to=(y*width+x)*channels;for(let c=0;c<channels;c++)output[to+c]=data[from+c];}}
 stats.resized++;stats.last={from:[w,h],to:[width,height],channels,limit};return {...image,data:output,width,height};
}
function limit(){
 let max=4096;
 for(const canvas of document.querySelectorAll('canvas:not(.upper-canvas):not(.lower-canvas)')){const gl=canvas.getContext('webgl2');if(gl&&!gl.isContextLost()){max=Math.min(8192,gl.getParameter(gl.MAX_TEXTURE_SIZE));break;}}
 return max;
}
async function install(){
 if(installed)return true;if(checking)return checking;
 checking=(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(u=>{try{return new URL(u).origin===location.origin&&new URL(u).pathname.endsWith('/3d-engine-core-CWixaQtn.js');}catch{return false;}});
  if(!url)throw Error('原版三维预览模块尚未加载');const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw Error('三维预览模块读取失败');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!=='398f5c409fde21947bc048add6850d69f5c63a7f03562a742e6b9de46a000b18')throw Error('三维预览模块版本未验证');
  const module=await import(url);module.c();const prototype=module.I?.prototype;if(!prototype)throw Error('三维高度纹理接口不匹配');
  if(prototype.__photoHubBoundedPreview){installed=true;return true;}
  let parent=Object.getPrototypeOf(prototype),descriptor;while(parent&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(parent,'image');parent=Object.getPrototypeOf(parent);}
  if(!descriptor?.get||!descriptor?.set)throw Error('三维纹理属性接口不匹配');
  Object.defineProperty(prototype,'image',{configurable:true,get(){return descriptor.get.call(this);},set(image){descriptor.set.call(this,fit(image,limit()));}});
  Object.defineProperty(prototype,'__photoHubBoundedPreview',{value:true});installed=true;return true;
 })();try{return await checking;}finally{checking=null;}
}
window.EPCReliefPreview={install,installScene,fit,stats,get installed(){return installed;}};
})();

/* Manual offline relief. The preference never starts a background calculation. */
(()=>{'use strict';
function create({api,host,finish,status,craftNotifier}){
 const source=o=>({hash:o._hash,cacheHash:o._cacheHash,width:o.pixelWidth||o.width,height:o.pixelHeight||o.height});
 let enabled=false,active=null,view=null,modeButton=null,panel=null,observer=null,timer=null,frame=0,disposed=false,opened=false,bus=null,previewing=false;
 let aiInfo=null,aiChecking=false;
 try{enabled=localStorage.getItem('photohub.localReliefEnabled')==='true';}catch{}
 const notify=message=>{if(!view?.isConnected||!active)status(message);if(view?.isConnected){view.querySelector('[data-progress]').textContent=message;const match=message.match(/(\d+)%/);if(match)view.querySelector('[data-progress-bar]').value=Number(match[1]);}};
 async function nativeBus(){
  if(craftNotifier)return {emit:craftNotifier};
  if(bus)return bus;
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(u=>{try{return new URL(u).origin===location.origin&&new URL(u).pathname.endsWith('/eventbus-BgGQtRdq.js');}catch{return false;}});
  if(!url)throw Error('原版工艺通知模块尚未就绪');
  const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw Error('原版工艺通知模块读取失败');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!=='6d1f911541007daa85f7449ae43d32c2f351f3f7d8718c6f8668e02a2ee6959d')throw Error('原版工艺通知模块版本未验证');
  const module=await import(url);module.r();if(typeof module.t?.emit!=='function')throw Error('原版工艺通知接口不匹配');return bus=module.t;
 }
 async function syncCraft(o){const events=await nativeBus();events.emit('CraftPanelRefresh',{objectIds:[o.id],craftMode:isLocal(o)?'customize':undefined});events.emit('EventTexturePreviewUpdate',{objectId:o.id,grayscaleUpdated:true});}
 function selected(){return host.editor()?.canvas.getActiveObject();}
 function isLocal(o){const meta=o?.customInkModeConfig?.photoHubLocalRelief;return !!meta&&o._isCustomizeTexture===true&&(meta.grayHash===o._cacheOriginalGrayHash||meta.grayHash===o._cacheGrayHash)&&(!meta.source||Object.entries(source(o)).every(([k,v])=>meta.source[k]===v));}
 async function preview(){
  if(active||previewing)throw Error('请等待当前浮雕计算或预览准备完成');
  previewing=true;
  try{
   await finish();const ed=host.editor(),project=host.project(),o=selected();
   if(!o?._cacheGrayHash||!o.textureType)throw Error('请先生成浮雕，再预览');
   notify('正在保存预览恢复点并检查长图预览…');
   await window.EPCReliefPreview.install();
   const prepared=await api('/relief/preview/prepare',{pageUrl:location.href});
   if(prepared?.ready!==true)throw Error('长图预览保护未就绪；已保留当前设计');
   if(host.editor()!==ed||host.project()!==project||!ed.canvas.getObjects().includes(o))throw Error('项目已切换，未打开预览');
   const checkpoint=await api('/relief/preview/checkpoint',{project,projectData:host.manager?.()?.getProjectData?.(),canvas:ed.canvas.toObject(),viewport:ed.canvas.viewportTransform});
   if(checkpoint?.saved!==true)throw Error('预览恢复点保存失败；未打开预览');
   if(host.editor()!==ed||host.project()!==project||!ed.canvas.getObjects().includes(o))throw Error('项目已切换，未打开预览');
   const button=document.querySelector('button[class*="_ButtonPreview_"]');
   if(!button||button.disabled||button.getBoundingClientRect().width===0)throw Error('当前页面的原版预览尚不可用');
   button.click();
  }finally{previewing=false;}
 }
 const remember=()=>{try{localStorage.setItem('photohub.localReliefEnabled',String(enabled));}catch{}};
 async function cancel(){const job=active;if(!job)return;job.cancelled=true;if(job.id)await api('/relief/jobs/'+job.id+'/cancel',{});notify('已取消本机计算；已应用的浮雕保持不变。');}
 async function setEnabled(value){enabled=!!value;remember();if(!enabled)await cancel();refresh();}
 function refresh(){
  if(!view?.isConnected)return;
  view.querySelector('[name=enabled]').checked=enabled;
  for(const input of view.querySelectorAll('[data-setting]'))input.disabled=!enabled||!!active;
  const mode=view.querySelector('[name=mode]').value,ai=mode==='ai-depth'||mode==='ai-strokes',stroke=mode==='ai-strokes',info=aiInfo?.[stroke?'aiStrokes':'aiDepth'];
  view.querySelector('[name=background]').closest('label').hidden=mode!=='ink'&&!stroke;
  view.querySelector('[name=detail]').closest('label').hidden=ai;
  view.querySelector('[data-ai-rotation]').hidden=!ai;
  view.querySelector('[data-strength-name]').textContent=stroke?'纹路强度':'起伏强度';
  for(const [mode,key]of [['ai-depth','aiDepth'],['ai-strokes','aiStrokes']])view.querySelector('option[value="'+mode+'"]').disabled=aiInfo?.[key]?.ready!==true;
  view.querySelector('[data-ai-info]').hidden=!ai;
  view.querySelector('[data-ai-info]').textContent=ai?(info?.message||'正在检查内置 AI 模型…'):'传统本机计算，无需 AI 模型';
  view.querySelector('[data-ai-hint]').textContent=ai?(stroke?'识别线条与细纹，不混入主体深度':'识别主体层次，不叠加笔触纹理'):({surface:'以平缓连续面生成高度，保留整体明暗层次',ink:'增强墨线与局部笔画，纸面抑制可减少背景起伏',tone:'按图片灰度映射高度，可用反向高度调整高低',detail:'增强局部细节与纹理起伏'}[mode]||'');
  view.querySelector('[data-cancel]').hidden=!active;view.querySelector('[data-progress-bar]').hidden=!active;
  const o=selected();view.querySelector('[data-generate]').disabled=!enabled||!!active||o?.type!=='image'||(ai&&info?.ready!==true);
  view.querySelector('[data-cancel]').disabled=!active;view.querySelector('[data-preview]').disabled=!!active||!o?.textureType||!o?._cacheGrayHash;
 }
 async function checkAI(){if(aiChecking)return;aiChecking=true;try{aiInfo=await api('/relief/capabilities',{});}catch{const unavailable={ready:false,message:'AI 模块尚未就绪'};aiInfo={aiDepth:unavailable,aiStrokes:unavailable};}finally{aiChecking=false;refresh();}}
 function valid(job){return enabled&&!job.cancelled&&host.editor()===job.editor&&host.project()===job.project&&job.editor.canvas.getObjects().includes(job.object)&&job.object._cacheHash===job.sourceHash&&job.object._hash===job.hash;}
 async function generate(options={},target){
  if(!enabled)throw Error('请先开启“本机浮雕计算”');if(active)throw Error('已有本机浮雕计算任务');
  await finish();const ed=host.editor(),o=target||ed?.canvas.getActiveObject();
  if(!o||o.type!=='image'||o.group)throw Error('请先选中一张独立图片');
  if(!ed.canvas.getObjects().includes(o))throw Error('图片已不在当前画布中');
  if(o._isCropping||o.cropX||o.cropY||o.cropPath||o.clipPath)throw Error('请先完成裁剪并导出为完整图片，再进行本机浮雕计算');
  if(typeof o.getOriginalSrc!=='function'||typeof ed.executeCommand!=='function'||(typeof o.setGrayscale!=='function'&&typeof ed.createTextureByKeepCrop!=='function'))throw Error('当前编辑器没有通过本机高度图接口检查');
  await nativeBus();if(window.EPCReliefPreview)await window.EPCReliefPreview.install();
  const job={editor:ed,project:host.project(),object:o,sourceHash:o._cacheHash,hash:o._hash,cancelled:false,id:null};active=job;refresh();
  try{
   notify('正在读取完整原图，本机计算不消耗积分…');
   const dataUrl=await o.getOriginalSrc();if(!valid(job))throw Error('操作已取消或原图已改变，未修改设计');
   if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/'))throw Error('无法取得原始图片数据，未使用缩略图代替');
   const initial=await api('/relief/jobs',{...options,dataUrl});job.id=initial.id;
   if(!valid(job)){await api('/relief/jobs/'+job.id+'/cancel',{});throw Error('已取消本机浮雕计算，原设计未改变');}
   for(;;){
    if(!valid(job)){await api('/relief/jobs/'+job.id+'/cancel',{});throw Error('操作已取消或项目已改变，原设计未改变');}
    const state=await api('/relief/jobs/'+job.id);notify('本机浮雕计算 '+state.progress+'%');
    if(state.status==='failed')throw Error(state.error||'本机计算失败');if(state.status==='cancelled')throw Error('本机浮雕计算已取消');if(state.status==='complete')break;
    await new Promise(resolve=>setTimeout(resolve,600));
   }
   const result=await api('/relief/jobs/'+job.id+'/result');
   if(!valid(job))throw Error('结果已保存，项目或原图已改变，未应用');
   if(result.width!==(o.pixelWidth||o.width)||result.height!==(o.pixelHeight||o.height))throw Error('高度图与原图像素不一致，未应用');
   if(typeof o.setGrayscale!=='function'){
    // Ordinary native images acquire the texture subclass through CraftCommand.
    // Keeping this inside its callback also makes native undo/redo convert classes.
    let applied=null;
    const command=await ed.executeCommand('craftCommand',{objectId:o.id,textureType:'customize',base64:result.grayDataUrl,colorBase64:dataUrl,isSingle:true,executeCb:async(current,data)=>{
     if(host.editor()!==ed||host.project()!==job.project||!ed.canvas.getObjects().includes(current))throw Error('项目或图层已改变，未应用浮雕');
     if(!data.isRedo&&!valid(job))throw Error('操作已取消，未应用本机高度图');
     const texture=await ed.createTextureByKeepCrop(current,data.colorBase64||dataUrl,true);
     if(!texture||typeof texture.setGrayscale!=='function')throw Error('原版纹理图片转换失败，原图未修改');
     if(texture.width!==result.width||texture.height!==result.height)throw Error('纹理图片方向与高度图不一致，原图未修改');
     await texture.setGrayscale(data.base64||result.grayDataUrl);
     const keep=['id','left','top','width','height','pixelWidth','pixelHeight','scaleX','scaleY','angle','originX','originY','flipX','flipY','skewX','skewY','opacity','visible','selectable','evented','globalCompositeOperation','inkMode','_cacheHash','_hash','_layerNameCus','_skipPrint','_bindContourId'];
     const values=Object.fromEntries(keep.filter(k=>current[k]!==undefined).map(k=>[k,current[k]]));
     texture.set({...values,textureType:'pattern',_isCustomizeTexture:true,isCanvasTexture:true,_cacheOriginalGrayHash:texture._cacheGrayHash,_cacheGrayHash_crop:'',grayscale_crop:'',maxGrayValue:result.maxGrayValue,thickness:Number(current.thickness)>0?current.thickness:.3,isRaised:false,subPrintModel:'',customInkModeConfig:{...(current.customInkModeConfig||{}),photoHubLocalRelief:{version:2,source:source(current),grayHash:texture._cacheGrayHash,outputSha256:result.outputSha256,aiDepth:result.aiDepth||null,aiStrokes:result.aiStrokes||null,options:{...options,mode:options.mode||'surface'}}}});
     if(host.editor()!==ed||host.project()!==job.project||!ed.canvas.getObjects().includes(current)||(!data.isRedo&&!valid(job)))throw Error('项目或原图已改变，未应用浮雕');
     const index=ed.canvas.getObjects().indexOf(current);
     ed.canvas.discardActiveObject();ed.canvas.remove(current);
     try{ed.canvas.insertAt(texture,index,false);texture.setCoords();ed.canvas.setActiveObject(texture);}catch(error){if(ed.canvas.getObjects().includes(texture))ed.canvas.remove(texture);ed.canvas.insertAt(current,index,false);ed.canvas.setActiveObject(current);throw error;}
     texture.dirty=true;ed.canvas.requestRenderAll();applied=texture;return texture;
    }});
    if(!command||!applied||!ed.canvas.getObjects().includes(applied))throw Error('原版未确认浮雕工艺应用');
    try{await syncCraft(applied);}catch(error){status('浮雕已应用，但原版预览刷新失败：'+error.message);}
    notify('浮雕已生成，点击“预览浮雕”查看；可用原版撤销。');
    return {id:result.id,width:result.width,height:result.height,outputSha256:result.outputSha256,maxGrayValue:result.maxGrayValue};
   }
   const properties=['_cacheGrayHash','grayscale','_cacheOriginalGrayHash','_cacheGrayHash_crop','grayscale_crop','textureType','_isCustomizeTexture','isCanvasTexture','maxGrayValue','thickness','isRaised','subPrintModel','customInkModeConfig'];
   const oldValues=properties.map(k=>o[k]);
   try{
    await o.setGrayscale(result.grayDataUrl);
    const config={...(o.customInkModeConfig||{}),photoHubLocalRelief:{version:2,source:source(o),grayHash:o._cacheGrayHash,outputSha256:result.outputSha256,aiDepth:result.aiDepth||null,aiStrokes:result.aiStrokes||null,options:{...options,mode:options.mode||'surface'}}};
    const newValues=[o._cacheGrayHash,o.grayscale||'',o._cacheGrayHash,'','','pattern',true,true,result.maxGrayValue,Number(o.thickness)>0?o.thickness:.3,false,'',config];
    properties.forEach((k,i)=>{o[k]=oldValues[i];});
    if(!valid(job))throw Error('操作已取消，未应用本机高度图');
    await ed.executeCommand('propertyCommand',{ids:[o.id],properties,oldValues:{[o.id]:oldValues},newValues:{[o.id]:newValues}});
    o.dirty=true;ed.canvas.requestRenderAll();
    try{await syncCraft(o);}catch(error){status('浮雕已应用，但原版预览刷新失败：'+error.message);}
    notify('浮雕已生成，点击“预览浮雕”查看；可用原版撤销。');
    return {id:result.id,width:result.width,height:result.height,outputSha256:result.outputSha256,maxGrayValue:result.maxGrayValue};
   }catch(error){properties.forEach((k,i)=>{o[k]=oldValues[i];});throw error;}
  }finally{active=null;refresh();}
 }
 function mount(content){
  view=content;content.innerHTML='<div class="epc-field"><div class="epc-panel-head"><span>浮雕生成</span><label title="仅在点击生成时计算，关闭不会移除已生成的浮雕"><small>启用</small><input name="enabled" type="checkbox" role="switch"></label></div><label>生成方式<select name="mode" data-setting><optgroup label="本机生成"><option value="surface">连续面浮雕</option><option value="ink">墨线增强</option><option value="tone">灰度映射</option><option value="detail">细节增强</option></optgroup><optgroup label="AI 生成（二选一）"><option value="ai-depth" disabled>AI 深度图</option><option value="ai-strokes" disabled>AI 笔触纹路</option></optgroup></select></label><div class="epc-divider"></div><label><span data-strength-name>起伏强度</span><input name="strength" data-setting type="number" min="0" max="100" value="55"></label><details><summary>更多参数</summary><div class="epc-field"><label data-ai-rotation>画面朝向<select name="aiRotation" data-setting><option value="auto">自动识别长卷方向</option><option value="0">保持当前方向</option><option value="270">向左旋转 90°</option><option value="90">向右旋转 90°</option><option value="180">旋转 180°</option></select></label><label>细节程度<input name="detail" data-setting type="number" min="0" max="100" value="35"></label><label>平滑程度<input name="smooth" data-setting type="number" min="0" max="8" step="0.5" value="1"></label><label>纸面抑制<input name="background" data-setting type="number" min="0" max="100" value="65"></label><label>反向高度<input name="invert" data-setting type="checkbox" role="switch"></label></div></details><div class="epc-actions"><button class="epc-primary" data-generate>生成浮雕</button></div><button data-cancel hidden>取消生成</button><progress data-progress-bar max="100" value="0" hidden></progress><div role="status" data-progress></div></div>';
  const select=content.querySelector('[name=mode]');select.value='ai-depth';select.onchange=refresh;
  const aiInfoRow=document.createElement('p');aiInfoRow.dataset.aiInfo='';aiInfoRow.className='epc-helper';aiInfoRow.style.cssText='font-size:11px;line-height:1.6';aiInfoRow.textContent='正在检查内置 AI 模型…';select.parentElement.after(aiInfoRow);
  const aiHint=document.createElement('p');aiHint.dataset.aiHint='';aiHint.style.cssText=aiInfoRow.style.cssText;aiHint.className='epc-helper';aiHint.textContent='离线识别，生成后请预览确认';aiHint.title='白色较近、黑色较远。长图自动重叠校准。古画识别可能有误；AI 深度图与 AI 笔触纹路二选一，传统本机生成方式独立保留。';aiHint.hidden=false;aiInfoRow.after(aiHint);
  content.querySelector('[name=enabled]').onchange=e=>setEnabled(e.target.checked).catch(e=>notify(e.message));
  content.querySelector('[data-cancel]').onclick=()=>cancel().catch(e=>notify(e.message));
  content.querySelector('[data-generate]').textContent='生成浮雕';
  const previewButton=document.createElement('button');previewButton.type='button';previewButton.dataset.preview='';previewButton.textContent='预览浮雕';previewButton.onclick=()=>preview().catch(e=>notify(e.message));content.querySelector('[data-generate]').after(previewButton);
  content.querySelector('[data-generate]').onclick=()=>{const options={};for(const e of content.querySelectorAll('[data-setting]'))options[e.name]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;generate(options).catch(e=>notify(e.message));};refresh();checkAI();
 }
 function attach(){
  frame=0;if(disposed)return;
  const grid=document.querySelector('div[class*="_craftMode_"]'),o=selected(),show=!!grid&&o?.type==='image'&&!o.group&&document.body.classList.contains('epc-native-layout');
  if(!show){modeButton?.remove();panel?.remove();return;}
  if(!modeButton){modeButton=document.createElement('div');modeButton.id='epc-local-relief-mode';modeButton.textContent='本机浮雕';modeButton.setAttribute('role','button');modeButton.tabIndex=0;modeButton.onclick=()=>{opened=!opened;attach();};modeButton.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();modeButton.click();}};}
  const sample=grid.querySelector('[class*="_craftModeItem_"]');if(!sample)return;
  const className=sample.className.replace(/\b_craftActive_\S+/g,'').trim();const activeClass=[...grid.querySelectorAll('[class*="_craftModeItem_"]')].flatMap(n=>[...n.classList]).find(n=>n.startsWith('_craftActive_'));
  const wanted=className+(isLocal(o)?' '+(activeClass||''):'');if(modeButton.className!==wanted)modeButton.className=wanted;
  modeButton.setAttribute('aria-pressed',String(isLocal(o)));if(modeButton.parentElement!==grid)grid.append(modeButton);
  if(!panel){panel=document.createElement('section');panel.id='epc-local-relief-panel';panel.className='epc-native';panel.style.cssText='font:inherit;color:inherit;margin:12px 0;padding:12px;border:1px solid #e8e8e8;border-radius:8px';mount(panel);}
  if(panel.parentElement!==grid.parentElement||panel.previousElementSibling!==grid)grid.after(panel);
  panel.hidden=!opened;refresh();
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(attach);}
 function installRightPanel(){observer?.disconnect();clearInterval(timer);disposed=false;observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});timer=setInterval(schedule,500);attach();}
 function open(){opened=true;attach();if(!modeButton?.isConnected)throw Error('请先选中图片，打开右侧工艺模式');panel.scrollIntoView({block:'nearest'});}
 function dispose(){disposed=true;observer?.disconnect();clearInterval(timer);cancelAnimationFrame(frame);modeButton?.remove();panel?.remove();if(active)cancel().catch(()=>{});}
 return {mount,generate,generateFor:(o,options)=>generate(options,o),isLocal,cancel,setEnabled,installRightPanel,open,preview,dispose,get enabled(){return enabled;},get running(){return !!active;}};
}
window.EPCLocalRelief={create};
})();

/* Normalize one exported roll packet; never resize pixels or edit the project. */
(()=>{'use strict';
function imageSize(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('卷材打印图片不是有效 PNG；未生成打印包');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);
 if(!width||!height)throw Error('卷材打印图片尺寸无效');
 return {width,height};
}
function normalize(config,images,{roll=false,mode='native'}={}){
 if(!roll||mode!=='optimized')return config;
 const index=config.rollSegmentIndex,segment=config.rollSegmentSizes?.[index],dpi=config.imgQuality;
 if(!Number.isInteger(index)||index<0||!segment||!Number.isFinite(dpi)||dpi<=0||dpi>6000)throw Error('卷材当前分段尺寸未确认；未生成打印包');
 const {widthPx,heightPx}=segment;
 if(!Number.isInteger(widthPx)||!Number.isInteger(heightPx)||widthPx<=0||heightPx<=0||widthPx>32767||heightPx>32767)throw Error('卷材当前分段像素尺寸无效');
 if(!Number.isFinite(config.format_size_w)||config.format_size_w<=0||Math.abs(config.format_size_w*dpi/25.4-widthPx)>1)throw Error('卷材横向尺寸与分段像素不一致；未交换横纵尺寸');
 if(!images.length||images.some(i=>!i.width||!i.height||i.width>widthPx+1||i.height>heightPx+1))throw Error('卷材图片与分段尺寸不一致；未生成拉伸数据');
 const out=structuredClone(config),heightMm=heightPx*25.4/dpi;
 out.format_size_h=heightMm;out.format_size_h_non=heightMm;
 if(out.effectImgData){
  // The native layout converter also consumes these fields. A full-canvas
  // height here would describe ~7.45 m while the PNG contains only 1200 rows.
  out.effectImgData.effectivePixelsH=heightMm;
  out.effectImgData.effectivePixelsHPx=heightPx;
  out.effectImgData.positionY=0;out.effectImgData.positionYPx=0;
 }
 out.photoHubRollPacket={version:1,index,pixels:[widthPx,heightPx],dpi,heightMm,fullFormatMm:[config.format_size_w,config.format_size_h]};
 return out;
}
// Clip the draw rectangle before handing it to Canvas2D. A 7.45 m image
// becomes an ~88k-pixel destination at print resolution; submitting that
// entire rectangle can repeat edge rows or lose them in the native renderer.
function boundedArgs(ctx,args){
 const [image]=args,iw=image?.naturalWidth||image?.width,ih=image?.naturalHeight||image?.height;
 if(Math.max(iw||0,ih||0)<=30000)return args;
 let sx=0,sy=0,sw=iw,sh=ih,dx,dy,dw,dh;
 if(args.length===9)[,sx,sy,sw,sh,dx,dy,dw,dh]=args;
 else if(args.length===5)[,dx,dy,dw,dh]=args;
 else if(args.length===3){[,dx,dy]=args;dw=iw;dh=ih;}else return args;
 if(![sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite)||sw<=0||sh<=0||dw<=0||dh<=0)return args;
 const t=ctx.getTransform(),det=t.a*t.d-t.b*t.c;if(!Number.isFinite(det)||Math.abs(det)<1e-16)return args;
 const inv=(x,y)=>({x:(t.d*(x-t.e)-t.c*(y-t.f))/det,y:(-t.b*(x-t.e)+t.a*(y-t.f))/det});
 const corners=[inv(-2,-2),inv(ctx.canvas.width+2,-2),inv(-2,ctx.canvas.height+2),inv(ctx.canvas.width+2,ctx.canvas.height+2)];
 const left=Math.max(dx,Math.min(...corners.map(p=>p.x))),right=Math.min(dx+dw,Math.max(...corners.map(p=>p.x))),top=Math.max(dy,Math.min(...corners.map(p=>p.y))),bottom=Math.min(dy+dh,Math.max(...corners.map(p=>p.y)));
 if(right<=left||bottom<=top)return null;
 const x0=Math.max(sx,Math.floor(sx+(left-dx)*sw/dw)-1),y0=Math.max(sy,Math.floor(sy+(top-dy)*sh/dh)-1),x1=Math.min(sx+sw,Math.ceil(sx+(right-dx)*sw/dw)+1),y1=Math.min(sy+sh,Math.ceil(sy+(bottom-dy)*sh/dh)+1);
 return [image,x0,y0,x1-x0,y1-y0,dx+(x0-sx)*dw/sw,dy+(y0-sy)*dh/sh,(x1-x0)*dw/sw,(y1-y0)*dh/sh];
}
async function render(obj,ctx,canvas,draw){
 if(window.__EPC_PRINT_PIPELINE?.mode!=='optimized'||!ctx?.getTransform)return draw();
 const own=Object.getOwnPropertyDescriptor(ctx,'drawImage'),original=ctx.drawImage;
 ctx.drawImage=function(...args){const bounded=boundedArgs(this,args);if(bounded)return original.apply(this,bounded);};
 try{return await draw();}finally{if(own)Object.defineProperty(ctx,'drawImage',own);else delete ctx.drawImage;}
}
const preparedImages=new WeakSet();
function prepareCanvas(canvas){
 const visit=obj=>{
  if(obj?.type==='image'&&Math.max(obj.pixelWidth||obj.width||0,obj.pixelHeight||obj.height||0)>30000&&!preparedImages.has(obj)&&typeof obj._renderFill==='function'){
   preparedImages.add(obj);const fill=obj._renderFill;
   obj._renderFill=function(ctx){
    if(window.__EPC_PRINT_PIPELINE?.mode!=='optimized')return fill.call(this,ctx);
    const own=Object.getOwnPropertyDescriptor(ctx,'drawImage'),original=ctx.drawImage;
    ctx.drawImage=function(...args){const bounded=boundedArgs(this,args);if(bounded)return original.apply(this,bounded);};
    try{return fill.call(this,ctx);}finally{if(own)Object.defineProperty(ctx,'drawImage',own);else delete ctx.drawImage;}
   };
  }
  for(const child of obj?._objects||[])visit(child);
 };
 canvas.getObjects().forEach(visit);return canvas;
}
window.EPCRollPacket={imageSize,normalize,boundedArgs,render,prepareCanvas};
})();

/* Native split-print menu: choose data generation only, never replace relief. */
(()=>{'use strict';
function create({host,relief,status}){
 let disposed=false,observer=null,root=null,frame=0,pillOwner=null,pillStyle=null,generating=0,activeMode=null;
 const stats={started:0,finished:0,lastMode:null};
 const key=()=> 'photohub-print-pipeline:'+host.project();
 function mode(){try{return localStorage.getItem(key())==='optimized'?'optimized':'native';}catch{return 'native';}}
 function choose(value){
  if(!['native','optimized'].includes(value))throw Error('打印算法选项无效');
  if(generating||relief.running)throw Error('正在生成数据，请完成后再切换打印算法');
  localStorage.setItem(key(),value);update();
  status(value==='optimized'?'已选择超限图片优化算法：按打印段生成数据，保留现有工艺与高度图。':'已选择原版打印算法：用于普通尺寸，保留现有工艺与高度图。');
  return {mode:value};
 }
 function begin(){if(!generating)activeMode=mode();generating++;stats.started++;stats.lastMode=activeMode;update();return activeMode;}
 function end(){generating=Math.max(0,generating-1);stats.finished++;if(!generating)activeMode=null;update();}
 function update(){
  if(!root?.isConnected)return;const selected=activeMode||mode();
  for(const button of root.querySelectorAll('[data-ph-algorithm]')){
   const checked=button.dataset.phAlgorithm===selected;button.disabled=!!generating||relief.running;button.setAttribute('aria-checked',String(checked));const mark=button.querySelector('[data-check]'),text=checked?'✓':'';if(mark.textContent!==text)mark.textContent=text;
  }
  const label=root.querySelector('[data-algorithm-state]'),text=generating?'正在生成打印数据':'打印数据生成（不改变工艺）';if(label.textContent!==text)label.textContent=text;
 }
 function attach(){
  frame=0;if(disposed)return;
  const pill=document.querySelector('div[class*="_printContourPill_"]');
  if(!pill){root?.remove();return;}
  if(pillOwner!==pill){
   if(pillOwner?.isConnected)pillOwner.style.cssText=pillStyle;
   pillOwner=pill;pillStyle=pill.style.cssText;
   Object.assign(pill.style,{height:'auto',width:'max-content',minWidth:'232px',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100vh - 120px)',overflowY:'auto',right:'0',top:'auto',bottom:'calc(100% + 8px)',boxSizing:'border-box',color:'#333',background:'#fff'});
  }
  if(!root){
   root=document.createElement('div');root.id='epc-print-algorithm';root.setAttribute('role','group');root.setAttribute('aria-label','打印算法');root.style.cssText='border-top:1px solid #eee;padding-top:6px;margin-top:6px;min-width:220px;font:inherit;color:inherit';
   const label=document.createElement('div');label.dataset.algorithmState='';label.style.cssText='font-size:12px;color:#777;padding:4px 12px';root.append(label);
   for(const[value,text]of [['native','原版打印算法（普通图片）'],['optimized','超限图片优化算法']]){
    const button=document.createElement('button');button.type='button';button.dataset.phAlgorithm=value;button.setAttribute('role','menuitemradio');
    button.style.cssText='display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:10px 12px;cursor:pointer;border-radius:6px';
    const mark=document.createElement('span');mark.dataset.check='';mark.style.cssText='display:inline-block;width:16px';button.append(mark,document.createTextNode(text));
    button.onmouseenter=()=>button.style.background='#f5f5f5';button.onmouseleave=()=>button.style.background='transparent';
    button.onclick=e=>{e.preventDefault();e.stopPropagation();try{choose(value);}catch(error){status(error.message);}};root.append(button);
   }
  }
  const sample=pill.querySelector('button:not([data-ph-algorithm])');for(const button of root.querySelectorAll('button'))if(sample)button.className=sample.className;
  if(root.parentElement!==pill)pill.append(root);update();
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(attach);}
 const guard=e=>{if((generating||relief.running)&&e.target.closest?.('button[class*="_printButtonMain_"],button[class*="_ButtonPreview_"],button[class*="_printContourMenuItem_"]:not([data-ph-algorithm])')){e.preventDefault();e.stopImmediatePropagation();status('正在生成数据，请完成后再预览或打印。');}};
 const controller={choose,mode,begin,end,stats,get busy(){return !!generating;},get modeValue(){return activeMode||mode();},install,dispose};
 function install(){window.__EPC_PRINT_PIPELINE={get mode(){return controller.modeValue;},begin,end,stats};document.addEventListener('click',guard,true);observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});attach();}
 function dispose(){disposed=true;observer?.disconnect();cancelAnimationFrame(frame);document.removeEventListener('click',guard,true);root?.remove();if(pillOwner?.isConnected)pillOwner.style.cssText=pillStyle;if(window.__EPC_PRINT_PIPELINE?.begin===begin)delete window.__EPC_PRINT_PIPELINE;}
 return controller;
}
window.EPCPrintAlgorithm={create};
})();

/* Preserve the supplied raster bytes; import must not require an export canvas. */
(()=>{'use strict';
async function prepare(file,api){
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const mime=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47?'image/png':bytes[0]===0xff&&bytes[1]===0xd8?'image/jpeg':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime)throw Error('请选择 PNG、JPEG 或 WebP 图片；文件未修改');
 const blob=new Blob([file],{type:mime}),url=URL.createObjectURL(blob);
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('原始图片读取失败'));reader.readAsDataURL(blob);});
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:'+mime+';base64,'))throw Error('原始图片读取失败；未缩小图片');
  const fileName=file.name||'PhotoHub.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime]);
  if(api)return api('/raster/prepare',{dataUrl,fileName});
  const image=new Image();image.src=url;await image.decode();
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height)throw Error('原图尺寸无效');
  return {dataUrl,width,height,fileName,singleObject:true};
 }finally{URL.revokeObjectURL(url);}
}
window.EPCImageImport={prepare};
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
