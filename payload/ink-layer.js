/* AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only. Older PhotoHub releases must not be used for layer-local CMYK jobs. */
/* Layer-local channel settings, native project serialization, and print-space policy. */
(() => {
 'use strict';
 const key='photoHubInkMask',kind='phCm',enc=new TextEncoder(),orders=new WeakMap();
 function record(canvas,obj){let list=orders.get(canvas);if(!list)orders.set(canvas,list=[]);list.push({obj,op:obj.globalCompositeOperation||'source-over',opacity:obj.opacity});}
 function inherit(canvas){function walk(o,parent=15){o[key]=value(o)&parent;for(const c of o.getObjects?.()||[])walk(c,o[key]);}for(const o of canvas.getObjects())walk(o);return canvas;}
 const table=Uint32Array.from({length:256},(_,v)=>{for(let k=0;k<8;k++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
 function crc(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
 const u32=v=>new Uint8Array([v>>>24,v>>>16&255,v>>>8&255,v&255]);
 function concat(parts){const a=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){a.set(p,i);i+=p.length;}return a;}
 const valid=v=>Number.isInteger(v)&&v>=0&&v<=15;
 const value=o=>valid(o?.[key])?o[key]:valid(o?.customInkModeConfig?.[key])?o.customInkModeConfig[key]:15;
 const config=(o,mask)=>({...((o?.customInkModeConfig&&typeof o.customInkModeConfig==='object'&&!Array.isArray(o.customInkModeConfig))?o.customInkModeConfig:{}),[key]:mask});
 function serialize(o){for(const method of ['toObject','toJSON']){let p=Object.getPrototypeOf(o),base;while(p){if(Object.prototype.hasOwnProperty.call(p,method))base=p;p=Object.getPrototypeOf(p);}const marker='__photoHubInkSerialization_v2_'+method;if(!base||base[marker])continue;
  const original=base[method];base[method]=function(...args){const result=original.apply(this,args);if(result&&typeof result==='object'&&(Object.prototype.hasOwnProperty.call(this,key)||valid(this.customInkModeConfig?.[key]))){result[key]=value(this);result.customInkModeConfig=config(this,value(this));}return result;};Object.defineProperty(base,marker,{value:true});
 }}
 function combine(bits,alpha,index,mask,sa,op='source-over'){
  if(!sa)return;const da=alpha[index],old=bits[index];
  if(op==='destination-out'){alpha[index]=Math.round(da*(255-sa)/255);if(!alpha[index])bits[index]=0;return;}
  if(op==='destination-over'){if(da===255)return;bits[index]=da?old|mask:mask;alpha[index]=Math.round(da+sa*(255-da)/255);return;}
  if(op==='source-atop'){if(!da)return;bits[index]=sa===255?mask:old|mask;return;}
  bits[index]=sa===255||!da?mask:old|mask;alpha[index]=Math.round(sa+da*(255-sa)/255);
 }
 function pack(bits,width,height){
  if(width*height!==bits.length||!width||!height)throw Error('墨路区域尺寸无效');
  let runs=0;for(let i=0;i<bits.length;){const b=bits[i];let j=i+1;while(j<bits.length&&bits[j]===b&&j-i<0xffffffff)j++;runs++;i=j;}
  let payload,mode;if(runs*5<Math.ceil(bits.length/2)){mode=2;payload=new Uint8Array(runs*5);let at=0;for(let i=0;i<bits.length;){const b=bits[i];let j=i+1;while(j<bits.length&&bits[j]===b&&j-i<0xffffffff)j++;payload.set(u32(j-i),at);payload[at+4]=b;at+=5;i=j;}}
  else{mode=1;payload=new Uint8Array(Math.ceil(bits.length/2));for(let i=0;i<bits.length;i++)payload[i>>1]|=bits[i]<<((1-(i&1))*4);}
  return concat([enc.encode('PHL1'),u32(width),u32(height),u32(mode),payload]);
 }
 async function attach(src,policy){if(!policy)return src;const bytes=new Uint8Array(await(await fetch(src)).arrayBuffer());if(bytes.length<20||bytes[0]!==137||bytes[1]!==80)throw Error('原版打印图片不是 PNG，已停止添加墨路策略');
  const parts=[bytes.subarray(0,8)];let end=false;for(let at=8;at<bytes.length;){if(at+12>bytes.length)throw Error('打印 PNG 损坏');const n=new DataView(bytes.buffer,bytes.byteOffset+at,4).getUint32(0),name=String.fromCharCode(...bytes.subarray(at+4,at+8));if(at+n+12>bytes.length)throw Error('打印 PNG 长度错误');if(name==='IEND'){const body=concat([enc.encode(kind),policy]);parts.push(u32(policy.length),body,u32(crc(body)));end=true;}if(name!==kind)parts.push(bytes.subarray(at,at+n+12));at+=n+12;if(name==='IEND')break;}if(!end)throw Error('打印 PNG 缺少结尾');const blob=new Blob(parts,{type:'image/png'});return await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(blob);});
 }
 function unpackPolicy(p){
  const v=new DataView(p.buffer,p.byteOffset,p.byteLength);if(p.length<16||String.fromCharCode(...p.subarray(0,4))!=='PHL1')throw Error('墨路策略格式错误');
  const width=v.getUint32(4),height=v.getUint32(8),mode=v.getUint32(12),count=width*height;if(!width||!height||count>268435456)throw Error('墨路策略尺寸错误');const bits=new Uint8Array(count);
  if(mode===1){if(p.length!==16+Math.ceil(count/2))throw Error('墨路策略长度错误');for(let i=0;i<count;i++)bits[i]=p[16+(i>>1)]>>((1-(i&1))*4)&15;}
  else if(mode===2){let at=0;if((p.length-16)%5)throw Error('墨路策略行程错误');for(let i=16;i<p.length;i+=5){const n=v.getUint32(i),mask=p[i+4];if(!n||mask>15||at+n>count)throw Error('墨路策略行程越界');bits.fill(mask,at,at+n);at+=n;}if(at!==count)throw Error('墨路策略像素缺失');}
  else throw Error('墨路策略编码不支持');return {width,height,bits};
 }
 async function rotatePolicy(source,rotated){
  const bytes=new Uint8Array(await(await fetch(source)).arrayBuffer());if(bytes.length<24||bytes[0]!==137||bytes[1]!==80)return rotated;const view=new DataView(bytes.buffer);let found;
  for(let at=8;at<bytes.length;){if(at+12>bytes.length)throw Error('旋转源 PNG 损坏');const n=view.getUint32(at);if(at+n+12>bytes.length)throw Error('旋转源 PNG 长度错误');const name=String.fromCharCode(...bytes.subarray(at+4,at+8));if(name===kind){if(found)throw Error('重复墨路策略');if(crc(bytes.subarray(at+4,at+8+n))!==view.getUint32(at+8+n))throw Error('墨路策略校验错误');found=unpackPolicy(bytes.subarray(at+8,at+8+n));}at+=n+12;if(name==='IEND')break;}
  if(!found)return rotated;if(view.getUint32(16)!==found.width||view.getUint32(20)!==found.height)throw Error('旋转源墨路策略与图片尺寸不同');found.bits.reverse();return attach(rotated,pack(found.bits,found.width,found.height));
 }
 async function policy(canvas,width=canvas.width,height=canvas.height){
  const controller=window.__EPC_LAYER_INK;if(!controller?.hasCustom())return null;
  width=Math.floor(width);height=Math.round(height);if(!width||!height||width*height>268435456)throw Error('逐图层墨路区域超过当前 2.68 亿像素内存预算，未降低打印分辨率');
  const bits=new Uint8Array(width*height),alpha=new Uint8Array(bits.length),scratch=document.createElement('canvas');scratch.width=width;scratch.height=height;const ctx=scratch.getContext('2d',{willReadFrequently:true});
  try{for(const entry of orders.get(canvas)||canvas.getObjects().map(obj=>({obj,op:obj.globalCompositeOperation||'source-over',opacity:obj.opacity}))){const {obj,op,opacity}=entry;
   if(obj.visible===false||String(obj.id||'').toLowerCase().includes('workspace')||obj._isOutlineTag||obj._isOutlineTitle)continue;
   ctx.clearRect(0,0,width,height);const saved=obj.globalCompositeOperation,savedOpacity=obj.opacity;obj.globalCompositeOperation='source-over';obj.opacity=opacity;
   try{await EPCComposition.renderNative(obj,ctx);}finally{obj.globalCompositeOperation=saved;obj.opacity=savedOpacity;}
   const r=obj.getBoundingRect(true),left=Math.max(0,Math.floor(r.left)-2),top=Math.max(0,Math.floor(r.top)-2),right=Math.min(width,Math.ceil(r.left+r.width)+2),bottom=Math.min(height,Math.ceil(r.top+r.height)+2);
   if(right<=left||bottom<=top)continue;const data=ctx.getImageData(left,top,right-left,bottom-top).data,mask=value(obj);
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)combine(bits,alpha,y*width+x,mask,data[((y-top)*(right-left)+x-left)*4+3],op);
   await new Promise(resolve=>setTimeout(resolve,0));
  }return pack(bits,width,height);}finally{orders.delete(canvas);scratch.width=scratch.height=0;}
 }
 function install({host,api,status}){
  window.__EPC_LAYER_INK?.dispose();let disposed=false,working=false,armed=null;
  function canvas(){const ed=host.editor();if(!ed?.canvas)throw Error('请打开可编辑项目');return ed;}
  function layers(){try{return canvas().canvas.getObjects().filter(o=>!String(o.id||'').toLowerCase().includes('workspace'));}catch{return[];}}
  function hasCustom(){const has=o=>o.visible!==false&&!o._skipPrint&&(value(o)!==15||(o.getObjects?.()||[]).some(has));return layers().some(has);}
  function selected(){const ed=canvas(),o=ed.canvas.getActiveObject();if(!o||String(o.id||'').toLowerCase().includes('workspace')||o.type==='activeSelection')return null;serialize(o);return o;}
  async function set(mask){if(!Number.isInteger(mask)||mask<0||mask>15)throw Error('无效墨路选择');if(working)throw Error('正在保存图层墨路');working=true;
   try{if(await window.__EPC_APP.actions.finish.run()===false)throw Error('当前图片编辑未能完成，未更改墨路');const ed=canvas(),o=selected(),project=host.project();if(!o)throw Error('请先选择一个图层');serialize(o);const before=value(o);if(before===mask)return;
    const state=await api('/ink/status');if(state.busy)throw Error('RIP 任务正在运行，暂不能更改图层墨路');if(canvas()!==ed||host.project()!==project||selected()!==o)throw Error('所选图层已经改变，未修改墨路');
    const result=await ed.executeCommand('propertyCommand',{ids:[o.id],properties:[key,'customInkModeConfig'],oldValues:{[o.id]:[before,o.customInkModeConfig]},newValues:{[o.id]:[mask,config(o,mask)]}});if(!result||value(o)!==mask||o.toObject().customInkModeConfig?.[key]!==mask)throw Error('原版未确认图层墨路保存');ed.canvas.requestRenderAll();status('当前图层的墨路已保存，可使用原版保存、撤销和重做。');
   }finally{working=false;}
  }
  async function beforeExport(){if(disposed)return;const needed=hasCustom();for(const o of layers())serialize(o);await api('/ink/policy/arm',{enabled:needed});armed=needed;}
  const apiObject={selected,value,set,hasCustom,beforeExport,policy,attach,record,inherit,async attachCanvas(c,src,color=true){if(!color)return src;return attach(src,await policy(c));},get working(){return working},get armed(){return armed},dispose(){disposed=true;}};
  window.__EPC_LAYER_INK=apiObject;for(const o of layers())serialize(o);return apiObject;
 }
 window.EPCLayerInk={install,value,serialize,combine,pack,unpackPolicy,rotatePolicy,policy,attach,inherit};
})();
