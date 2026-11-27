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
