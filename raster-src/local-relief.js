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
