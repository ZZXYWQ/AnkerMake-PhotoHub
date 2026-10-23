/* PhotoHub composition: modifies temporary native height rasters, never source layers. */
(()=>{
'use strict';
const defaults={mode:'overlap',ignoreSemi:false};
function create({editor,project}){
 let settings={...defaults},key='',source=new Map(),refresh=null,busy=false,revision=0;
 function sync(){const id=project();if(id!==key){key=id;try{settings={...defaults,...JSON.parse(localStorage.getItem('photohub-composition:'+id)||'{}')}}catch{settings={...defaults}}}return settings;}
 function snapshot(){source=new Map(editor().canvas.getObjects().map(o=>[o.id,o]));}
 function validate(){const objects=editor().canvas.getObjects().filter(o=>!String(o.id).toLowerCase().includes('workspace')&&o.visible!==false);if(objects.some(o=>o.type!=='image'||o.group||o.cropX||o.cropY||o.cropPath&&o.cropKey!=='free'))throw Error('顶面模式目前支持独立图片 / PSD 图层。请先把分组、矢量或裁剪对象转换为独立图片。');}
 function set(next){sync();if(next.mode==='top'||settings.mode==='top'&&next.mode!=='overlap')validate();settings={...settings,...next};localStorage.setItem('photohub-composition:'+key,JSON.stringify(settings));revision++;return settings;}
 function canvasFor(ctx){const c=document.createElement('canvas');c.width=ctx.canvas.width;c.height=ctx.canvas.height;const x=c.getContext('2d',{willReadFrequently:true});x.setTransform(ctx.getTransform());return {c,x};}
 async function coverage(ctx,obj,render){
  const {c,x}=canvasFor(ctx),original=source.get(obj.id);
  if(!original)throw Error('工艺图层已改变，请重新打开预览。');
  const saved={gco:obj.globalCompositeOperation,opacity:obj.opacity,element:obj._element,original:obj._originalElement,cache:obj.objectCaching,ds:obj._dsBaseElement};
  let pixels;
  try{
   obj._dsBaseElement=undefined;obj.globalCompositeOperation='source-over';obj.opacity=original.opacity??1;obj.objectCaching=false;
   if(original.type==='image'&&original._element){
    pixels=document.createElement('canvas');pixels.width=Math.ceil(obj.width);pixels.height=Math.ceil(obj.height);
    pixels.getContext('2d').drawImage(original._element,0,0,pixels.width,pixels.height);
    obj._element=pixels;obj._originalElement=pixels;
   }
   await render(x);
   const data=x.getImageData(0,0,c.width,c.height),threshold=sync().ignoreSemi?255:1,layerEligible=threshold===1||(original.opacity??1)>=1;
   for(let i=0;i<data.data.length;i+=4){const alpha=data.data[i+3];data.data[i]=data.data[i+1]=data.data[i+2]=255;data.data[i+3]=alpha>=threshold&&layerEligible?255:0;}
   x.putImageData(data,0,0);return c;
  }catch(e){c.width=c.height=0;throw e}
  finally{obj.globalCompositeOperation=saved.gco;obj.opacity=saved.opacity;obj._element=saved.element;obj._originalElement=saved.original;obj.objectCaching=saved.cache;obj._dsBaseElement=saved.ds;if(pixels)pixels.width=pixels.height=0;}
 }
 async function erase(ctx,obj,render){
  if(sync().mode!=='top')return;
  const mask=await coverage(ctx,obj,render);
  ctx.save();try{ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);}finally{ctx.restore();mask.width=mask.height=0;}
 }
 async function own(ctx,obj,render){
  if(sync().mode!=='top')return;
  const mask=await coverage(ctx,obj,render),m=mask.getContext('2d').getImageData(0,0,mask.width,mask.height).data,d=ctx.getImageData(0,0,mask.width,mask.height);
  for(let i=3;i<d.data.length;i+=4)d.data[i]=m[i]&&d.data[i]?255:0;
  ctx.putImageData(d,0,0);mask.width=mask.height=0;
 }
 function merge(ctx,img,x,y,w,h){
  if(sync().mode!=='overlap'){ctx.drawImage(img,x,y,w,h);return;}
  const scratch=document.createElement('canvas');scratch.width=ctx.canvas.width;scratch.height=ctx.canvas.height;const c=scratch.getContext('2d',{willReadFrequently:true});c.drawImage(img,x,y,w,h);
  const from=c.getImageData(0,0,scratch.width,scratch.height),to=ctx.getImageData(0,0,scratch.width,scratch.height);
  for(let i=0;i<to.data.length;i+=4)if(from.data[i+3]&&(from.data[i]>to.data[i]||!to.data[i+3])){to.data[i]=from.data[i];to.data[i+1]=from.data[i+1];to.data[i+2]=from.data[i+2];to.data[i+3]=255;}
  ctx.putImageData(to,0,0);scratch.width=scratch.height=0;
 }
 return {sync,set,snapshot,validate,erase,own,merge,get revision(){return revision}};
}
window.EPCComposition={create};
})();
