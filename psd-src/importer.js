(function(){
 const workerSource=__WORKER_SOURCE__;
 function parse(buffer){return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  let worker,timer;const done=(error,data)=>{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);error?reject(Error(error)):resolve(data);};
  try{worker=new Worker(url);timer=setTimeout(()=>done('PSD 解析超时，已停止；画布未修改。'),120000);worker.onerror=e=>done(e.message||'PSD 解析失败');worker.onmessage=({data})=>done(data.error,data);worker.postMessage(buffer,[buffer]);}catch(e){done(e.message);}
 });}
 async function importFile(file,{editor,host,status,finish,save,widthMm=100}){
  if(file.size>512*1024*1024)throw Error('PSD 文件超过 512 MB，请先精简图层。');
  if(!Number.isFinite(widthMm)||widthMm<=0)throw Error('打印宽度必须大于 0。');
  const ed=editor(),project=host.project();
  status('正在后台解析 PSD 图层…');
  const doc=await parse(await file.arrayBuffer());
  if(editor()!==ed||host.project()!==project)throw Error('项目已切换，取消导入。');
  if(!window.__EUFY_PHOTOCRAFT_LARGE_IMAGES&&doc.layers.some(l=>l.width>30000||l.height>30000||l.width*l.height>163840000))throw Error('图层超过原版图片限制。');
  const dpi=host.dpi(),scale=widthMm*dpi/25.4/doc.width;
  if(!Number.isFinite(scale)||scale<=0)throw Error('画布 DPI 无效。');
  // Encode and persist every layer before any native canvas mutation.
  const prepared=[];
  for(const l of doc.layers){
   const c=document.createElement('canvas');c.width=l.width;c.height=l.height;
   c.getContext('2d').putImageData(new ImageData(l.pixels,l.width,l.height),0,0);
   const dataUrl=c.toDataURL('image/png');c.width=c.height=0;
   if(!dataUrl.startsWith('data:image/png;base64,'))throw Error('图层像素无法导出：'+l.name);
   await save(dataUrl);prepared.push({...l,pixels:undefined,dataUrl});
  }
  await finish();
  const created=[],previous=ed.canvas.getActiveObject();
  const check=()=>{if(editor()!==ed||host.project()!==project)throw Error('项目已切换，导入停止。');};
  const work=ed.canvas.getObjects().find(o=>o.id==='workspace'),r=work?.getBoundingRect(true,true);
  const origin=r?{left:r.left+(r.width-doc.width*scale)/2,top:r.top+(r.height-doc.height*scale)/2}:{left:0,top:0};
  try{
   for(const [i,l]of prepared.entries()){
    check();status('正在导入 PSD 图层 '+(i+1)+' / '+prepared.length+'：'+l.name);
    let object;
    await ed.addImageByDpi(l.dataUrl,{width:l.width*scale,height:l.height*scale,fileName:l.name+'.png',opacity:l.opacity,visible:l.visible},o=>{object=o;},false);
    if(!object)throw Error('原版未确认添加图层：'+l.name);
    created.push(object);check();
    object.set({left:origin.left+l.left*scale,top:origin.top+l.top*scale,opacity:l.opacity,visible:l.visible});object.setCoords();
    const command=await ed.executeCommand('addImageCommand',{object});
    if(command?.id!==object.id)throw Error('未确认图层撤销记录：'+l.name);
    // Native AddImageCommand omits visibility and layer name when snapshotting undo.
    // Extend only this import's command, retaining all native undo/redo behavior.
    if(typeof command.undo==='function'){
     const undo=command.undo;
     command.undo=async function(...args){
      const current=ed.canvas.getObjects().find(o=>o.id===this.id);
      const meta=current?{visible:current.visible,_layerNameCus:current._layerNameCus}:null;
      const ok=await undo.apply(this,args);
      if(ok&&meta&&this.arguments)Object.assign(this.arguments,meta);
      return ok;
     };
    }
   }
   ed.canvas.setActiveObject(created.filter(o=>o.visible).at(-1)||created.at(-1));ed.canvas.requestRenderAll();
   status('已导入 PSD：'+created.length+' 个独立图层，整体宽 '+widthMm+' mm。位置、透明度、顺序已保留；选中单层后使用右侧原版工艺模式。'+(doc.skipped.length?' 跳过 '+doc.skipped.length+' 个空图层。':''));
   return {ids:created.map(o=>o.id),width:doc.width,height:doc.height,widthMm,skipped:doc.skipped};
  }catch(e){
   // Only remove objects created by this import; never touch existing artwork.
   for(const o of created)if(ed.canvas.getObjects().includes(o))ed.canvas.remove(o);
   if(previous&&ed.canvas.getObjects().includes(previous))ed.canvas.setActiveObject(previous);
   ed.canvas.requestRenderAll();throw Error('PSD 导入未完成，已移除本次新增图层：'+e.message);
  }
 }
 window.EPCPSD={parse,importFile};
})();
