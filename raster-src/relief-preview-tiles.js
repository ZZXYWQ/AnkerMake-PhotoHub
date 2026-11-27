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
