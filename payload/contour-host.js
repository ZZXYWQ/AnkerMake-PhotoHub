/* Native eufyMake AddSvgCommand bridge. Source images are retained; vector replacement is undoable. */
(function(root){
  'use strict';
  const metadata=new WeakMap();
  function utf8Base64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
  async function apply(svg,{editor,host,sourceObject,printWidthMm=100,replaceSource=false,placementBounds}={}){
    if(!editor?.canvas||typeof editor.executeCommand!=='function'||typeof editor.addSvgFileByDpiAsync!=='function')throw Error('当前编辑器不支持原生 SVG 添加命令');
    if(!root.EPCContours)throw Error('轮廓模块尚未加载');
    if(replaceSource){
      if(!sourceObject||sourceObject.type==='image'||!(sourceObject.isSVG||['path','polygon','polyline','rect','circle','ellipse'].includes(sourceObject.type)))throw Error('替换仅适用于独立矢量轮廓；图片转轮廓将保留源图片');
      if(sourceObject.isClipOutline||sourceObject._bindContourId||sourceObject._parentId||sourceObject.group)throw Error('带打印绑定或分组的轮廓不能直接替换；请先复制为独立 SVG');
    }
    const parsed=root.EPCContours.parseSVG(svg);
    const dpi=Number(typeof host?.dpi==='function'?host.dpi():host?.dpi);
    if(!Number.isFinite(dpi)||dpi<=0)throw Error('无法获取当前画布 DPI');
    let width,height,placement;
    if(sourceObject){
      if(!editor.canvas.getObjects().includes(sourceObject))throw Error('原对象已不在当前画布中');
      const bounds=typeof sourceObject.getBoundingRect==='function'?sourceObject.getBoundingRect(true,true):null;
      if(!bounds||![bounds.left,bounds.top,bounds.width,bounds.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)throw Error('无法获取原对象显示边界');
      width=bounds.width;height=bounds.height;placement={left:bounds.left,top:bounds.top};
    }else{
      if(!Number.isFinite(Number(printWidthMm))||Number(printWidthMm)<=0)throw Error('打印宽度须大于 0');
      width=Number(printWidthMm)*dpi/25.4;height=width*parsed.height/parsed.width;
    }
    if(placementBounds){if(!['left','top','width','height'].every(k=>Number.isFinite(placementBounds[k]))||placementBounds.width<=0||placementBounds.height<=0)throw Error('轮廓画布边界无效');width=placementBounds.width;height=placementBounds.height;placement={left:placementBounds.left,top:placementBounds.top};}
    // Rebuild from parsed geometry, preserving a viewBox in editor coordinates.
    // Explicit physical-equivalent pixel dimensions prevent arbitrary SVG 96-DPI scaling.
    const safe=root.EPCContours.toSVG(parsed.paths,parsed.width,parsed.height);
    // eufyMake rescales the imported object's geometry bounds to SVG width/height.
    // A fully transparent frame keeps those bounds equal to the entire viewBox,
    // so partial-image contours retain their correct offset instead of stretching.
    const frame=`<rect id="epc-layout-frame" x="0" y="0" width="${parsed.width}" height="${parsed.height}" fill="#000" stroke="none" stroke-width="0" opacity="0"/>`;
    const sized=safe.replace(/width="[^"]+" height="[^"]+"/,`width="${width}" height="${height}"`).replace(/(<svg[^>]*>)/,'$1'+frame);
    const dataUrl='data:image/svg+xml;base64,'+utf8Base64(sized);
    const command=await editor.executeCommand('addSvgCommand',{
      cb:(data,resize,sourceDpi)=>editor.addSvgFileByDpiAsync(data,resize,sourceDpi,placement,'PhotoHub-contours.svg'),
      svgFile:dataUrl,isResize:false,dpi:{xDPI:dpi,yDPI:dpi}
    });
    const object=command?.id&&editor.canvas.getObjects().find(item=>item.id===command.id);
    if(!object||!command.hash)throw Error('原生 SVG 命令未完成；请检查画布是否已添加轮廓');
    metadata.set(object,{svg:safe,width:parsed.width,height:parsed.height});
    let deleteCommand=null;
    if(replaceSource){
      // Add first, so failures never remove the source. Both actions enter native history.
      if(!editor.canvas.getObjects().includes(sourceObject))throw Error('新轮廓已添加，但原对象已改变；请检查画布');
      deleteCommand=await editor.executeCommand('deleteCommand',{objectIds:[sourceObject.id]});
      if(editor.canvas.getObjects().some(item=>item.id===sourceObject.id))throw Error('新轮廓已添加，但原轮廓删除未完成；可撤销新增轮廓后重试');
    }
    return{command,deleteCommand,object,createdObject:object,svg:safe,width,height,sourcePreserved:!!sourceObject&&!replaceSource,undoSteps:replaceSource?2:1};
  }
  function getSVG(object){return metadata.get(object)?.svg||null;}
  root.EPCContourHost={apply,getSVG};
})(typeof window!=='undefined'?window:globalThis);
