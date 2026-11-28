/* Preview-only color tiles. Design objects and printer exports stay unchanged. */
(()=>{'use strict';
const bindings=new WeakMap(),states=new WeakMap();
const stats={built:0,last:null,error:null};
let status=()=>{};
function plan(width,height,limit=2048,padding=2){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>34*1024*1024)throw Error('平面预览像素预算无效');
 const step=limit-padding*2,parts=[];
 if(step<1)throw Error('平面预览分块尺寸无效');
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
  const w=Math.min(step,width-x),h=Math.min(step,height-y),sx=Math.max(0,x-padding),sy=Math.max(0,y-padding),ex=Math.min(width,x+w+padding),ey=Math.min(height,y+h+padding);
  parts.push({x,y,width:w,height:h,sx,sy,sw:ex-sx,sh:ey-sy,fullWidth:width,fullHeight:height});
 }
 return parts;
}
function placement(tile,baseHeight,angle=0,scaleY=1){
 const x=10*((tile.x+tile.width/2)/tile.fullWidth-.5),y=baseHeight*(.5-(tile.y+tile.height/2)/tile.fullHeight)*scaleY;
 return {x:Math.cos(angle)*x-Math.sin(angle)*y,y:Math.sin(angle)*x+Math.cos(angle)*y,width:10*tile.width/tile.fullWidth,height:baseHeight*tile.height/tile.fullHeight};
}
function signature(host){return host.project()+'|'+JSON.stringify(host.editor().getJson());}
function eligible(host){
 const objects=host?.editor()?.canvas?.getObjects?.()||[];let long=false,craft=false;
 const visit=o=>{if(String(o.id||'').startsWith('workspace')||o.visible===false||o._skipPrint)return;
  if(o.textureType||o.isRaised||Number(o.thickness)>0)craft=true;
  if(o.type==='image'&&Math.max(o.pixelWidth||o.width||0,o.pixelHeight||o.height||0)>30000)long=true;
  for(const c of o._objects||[])visit(c);
 };objects.forEach(visit);return long&&!craft&&window.EPCFullResolution?.enabled!==false;
}
function bind(host){
 const ed=host?.editor();if(!ed||bindings.has(ed))return bindings.get(ed);
 const state={host,native:ed.preview1,args:null,project:null};
 ed.preview1=function(...args){
  if(window.__PH_PREVIEW_SESSION_ACTIVE&&args[4]!==true&&!state.building){state.args=args;state.project=host.project();}
  return state.native.apply(this,args);
 };bindings.set(ed,state);return state;
}
function load(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('平面预览图片读取失败'));image.src=src;});}
function release(tiles){for(const t of tiles||[]){t.image.width=0;t.image.height=0;}}
function textureFor(base,tile){
 if(!base.source?.constructor)throw Error('原版预览纹理来源接口不匹配');
 const texture=base.clone();
 // Three Texture.clone shares Source. Each tile needs its own Source so the
 // loader finishing the thumbnail cannot replace all high-resolution tiles.
 texture.source=new base.source.constructor(tile.image);
 texture.repeat.set(tile.width/tile.sw,tile.height/tile.sh);
 texture.offset.set((tile.x-tile.sx)/tile.sw,1-(tile.y-tile.sy+tile.height)/tile.sh);
 texture.needsUpdate=true;return texture;
}
async function expand(data,valid){
 const host=window.__EPC_HOST;if(data?.grayData?.length!==0||!data.hasBaseMap||!data.colorBase64||!eligible(host))return null;
 const ed=host.editor(),bound=bind(host);if(!bound?.args||bound.project!==host.project())return null;
 const key=signature(host),project=structuredClone(bound.args[0]),model=JSON.parse(project.canvases[project.canvasesIndex].print_param),w=model.format_size_w,h=model.format_size_h;
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return null;
 // Keep the original flat-ink compositor's 16384-side / 16 MP budget.
 // It must still apply native per-layer ink densities at the higher DPI.
 const bounds=ed.canvas.getObjects().filter(o=>!String(o.id||'').startsWith('workspace')&&o.visible!==false&&!o._skipPrint).map(o=>o.getBoundingRect?.(true,true)).filter(Boolean);
 const worldDpi=host.dpi(),mm=25.4/worldDpi;
 const bw=bounds.length?(Math.max(...bounds.map(b=>b.left+b.width))-Math.min(...bounds.map(b=>b.left)))*mm:w;
 const bh=bounds.length?(Math.max(...bounds.map(b=>b.top+b.height))-Math.min(...bounds.map(b=>b.top)))*mm:h;
 const dpi=Math.min(1024*25.4/Math.min(w,h),16000*25.4/Math.max(w,h,bw,bh),Math.sqrt(15*1024*1024/Math.max(w*h,bw*bh))*25.4);
 if(dpi<=Number(bound.args[2])*1.1)return null;
 let full,low;const tiles=[];bound.building=true;
 try{
  const args=bound.args.slice();args[0]=project;args[2]=dpi;
  const result=await bound.native.apply(ed,args);
  if(!valid()||host.editor()!==ed||signature(host)!==key)throw Error('已退出预览或设计已变化');
  if(!result?.dataUrl)throw Error('原版未生成高清平面预览');
  [full,low]=await Promise.all([load(result.dataUrl),load(data.colorBase64)]);
  const width=full.naturalWidth,height=full.naturalHeight;
  if(Math.abs(width/height/(low.naturalWidth/low.naturalHeight)-1)>.01)throw Error('高清预览与原版预览比例不一致');
  for(const p of plan(width,height)){
   if(!valid()||host.editor()!==ed||signature(host)!==key)throw Error('已退出预览或设计已变化');
   const image=document.createElement('canvas');image.width=p.sw;image.height=p.sh;
   const ctx=image.getContext('2d');if(!ctx)throw Error('平面预览分块内存不足');
   ctx.drawImage(full,p.sx,p.sy,p.sw,p.sh,0,0,p.sw,p.sh);tiles.push({...p,image});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  stats.built++;stats.last={from:[low.naturalWidth,low.naturalHeight],to:[width,height],tiles:tiles.length,pixels:width*height,dpi};stats.error=null;
  return {...data,__phFlatColorTiles:tiles};
 }catch(e){release(tiles);throw e;}finally{bound.building=false;if(full)full.src='';if(low)low.src='';}
}
function attach(scene,data,width,height){
 const tiles=data.__phFlatColorTiles;if(!tiles?.length)return;
 const original=scene._gameObjectMap.get('colorPlane'),base=original?.getComponent('MeshComponent')?.mesh,engine=scene._runtime?.engine;
 if(!base?.material?.map||!engine)throw Error('原版平面预览材质不可用');
 let w=width,h=height;if(data.canvasAngle===90||data.canvasAngle===270)[w,h]=[h,w];
 const totalHeight=Math.max(10*h/w,1),angle=data.angle?-data.angle*Math.PI/180:0,scale=data.scale||1,created=[],textures=[];
 try{for(const [index,t] of tiles.entries()){
  const p=placement(t,totalHeight,angle,scale),id='__phFlatColorTile'+index;
  const go=engine.createGameObject({name:'PhotoHub_FlatPreview_'+index});
  go.addComponent('MeshComponent',{geometryInline:{type:'plane',params:{width:p.width,height:p.height}},materialInline:{type:'physical',params:{transparent:true,roughness:1,metalness:0}}});
  go.group.position.set(p.x,p.y,.12000000000000001);go.group.rotation.set(0,0,angle);go.group.scale.set(1,scale,1);
  scene.scene.add(go);scene._gameObjectMap.set(id,go);created.push([id,go]);
  const mesh=go.getComponent('MeshComponent')?.mesh;if(!mesh)throw Error('平面预览分块网格创建失败');
  mesh.material.copy(base.material);const texture=textureFor(base.material.map,t);
  mesh.material.map=texture;mesh.material.needsUpdate=true;textures.push(texture);
 }
 original.group.visible=false;scene.textureCache.push(...textures);states.set(scene,{tiles,textures});
 }catch(e){for(const [id,go]of created){scene.scene.delete(go);scene._gameObjectMap.delete(id);}for(const texture of textures)texture.dispose();release(tiles);throw e;}
}
function clear(scene){const state=states.get(scene);if(!state)return;states.delete(scene);for(const texture of state.textures){texture.dispose();const i=scene.textureCache.indexOf(texture);if(i>=0)scene.textureCache.splice(i,1);}release(state.tiles);}
function install(prototype,force=false){
 bind(window.__EPC_HOST);if(!prototype||prototype.__phFlatColorPreviewRevision===1&&!force)return;
 const create=prototype.create,base=prototype._createBasePlane,remove=prototype.removeObject;
 if(typeof create!=='function'||typeof base!=='function'||typeof remove!=='function')throw Error('平面预览场景接口不匹配');
 prototype._createBasePlane=function(data,w,h){base.call(this,data,w,h);try{attach(this,data,w,h);}catch(e){stats.error=e.message;status('高清平面预览未完成：'+e.message);}};
 prototype.create=function(data,done,options){
  const request=this.__phFlatColorRequest=(this.__phFlatColorRequest||0)+1;
  if(this.sessionId!=='texture-preview'||!window.__PH_PREVIEW_SESSION_ACTIVE||data?.grayData?.length!==0){clear(this);return create.call(this,data,done,options);}
  const valid=()=>this.__phFlatColorRequest===request&&window.__PH_PREVIEW_SESSION_ACTIVE;
  expand(data,valid).then(next=>{if(!valid()){release(next?.__phFlatColorTiles);return;}clear(this);create.call(this,next||data,done,options);}).catch(e=>{stats.error=e.message;if(valid()){status('高清平面预览未生成，已保留原版预览：'+e.message);clear(this);create.call(this,data,done,options);}});
 };
 prototype.removeObject=function(...args){this.__phFlatColorRequest=(this.__phFlatColorRequest||0)+1;clear(this);return remove.apply(this,args);};
 Object.defineProperty(prototype,'__phFlatColorPreviewRevision',{value:1});
}
function start({api,host,status:say}){
 window.__PH_FLAT_PREVIEW_BOOT?.dispose();status=say||(()=>{});bind(host);let preparing=false;const bypass=new WeakSet();
 const guard=async event=>{const button=event.target.closest?.('button[class*="_ButtonPreview_"]');if(!button||button.disabled)return;if(bypass.has(button)){bypass.delete(button);return;}
  if(!eligible(host)||window.__EPC_APP?.printAlgorithm?.busy)return;
  event.preventDefault();event.stopImmediatePropagation();if(preparing)return;preparing=true;const project=host.project();
  try{status('正在准备高清平面预览…');const ready=await api('/relief/preview/prepare',{pageUrl:location.href});if(!ready?.ready)throw Error('预览接口尚未就绪');
   if(host.project()!==project)throw Error('项目已切换');
   const checkpoint=await api('/relief/preview/checkpoint',{reason:'flat-color-preview',project,projectData:host.manager().getProjectData(),canvas:host.editor().getJson(),viewport:host.editor().canvas.viewportTransform});
   if(!checkpoint?.saved||host.project()!==project)throw Error('预览恢复点未确认');
   bypass.add(button);button.click();
  }catch(e){status('未打开预览：'+e.message);}finally{preparing=false;}
 };
 document.addEventListener('click',guard,true);const result={dispose(){document.removeEventListener('click',guard,true);}};window.__PH_FLAT_PREVIEW_BOOT=result;return result;
}
window.EPCFlatPreview={plan,placement,textureFor,eligible,bind,install,start,stats};
})();
