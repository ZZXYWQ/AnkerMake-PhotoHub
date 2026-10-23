(()=>{
const visiblePreview=()=>[...document.querySelectorAll('.texturePreviewWrap')].find(e=>getComputedStyle(e).opacity==='1'&&e.querySelector('[class*="_texturePreviewContent_"]'));
function previewProps(){
 const el=document.querySelector('[class*="_texturePreviewContent_"]');if(!el)return null;
 const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let f=key&&el[key];
 for(let i=0;f&&i<35;i++,f=f.return)for(const item of [f,f.alternate]){const p=item?.memoizedProps;if(typeof p?.setShowTextureView==='function'&&p.showTextureView)return p;}
 return null;
}
function installUI({host,status}){
 window.__EPC_COMPOSITION_UI?.dispose();
 const controller=EPCComposition.create({editor:()=>host.editor(),project:()=>host.project()});window.__EPC_COMPOSITION=controller;
 const box=document.createElement('section');box.id='epc-composition-panel';box.className='epc-native';box.hidden=true;
 box.style.cssText='position:relative;width:100%;flex:0 0 auto;background:#fff;border-top:1px solid #e8e8e8;padding:12px;box-sizing:border-box;font:400 13px "Mont For Anker",sans-serif;color:#333';
 box.innerHTML='<div style="margin-bottom:9px">工艺合成</div><div role="group" aria-label="工艺合成模式" style="display:flex;gap:5px"><button data-mode="overlap" style="flex:1">重叠模式</button><button data-mode="top" style="flex:1">顶面模式</button></div><label data-semi style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" aria-label="忽略半透明" style="accent-color:#2ac660">忽略半透明</label><div data-message style="font-size:11px;color:#777;line-height:1.5;margin-top:8px"></div>';
 document.body.append(box);let ready=false,working=false,disposed=false,undo=null,error='',generation=0;
 const layoutStyle=document.createElement('style');layoutStyle.textContent='[data-epc-composition-host="edit"]{max-height:calc(100vh - var(--epc-layer-top) - 8px)!important;min-height:0!important}';document.head.append(layoutStyle);
 let mounted=null;
 const message=box.querySelector('[data-message]'),semi=box.querySelector('[data-semi]');
 function update(){
  const preview=visiblePreview(),layers=[...document.querySelectorAll('.menu-list .menu-item.active')].some(e=>e.querySelector('.menu-item-text')?.textContent.trim()==='图层');
  const target=preview?.querySelector('[class*="_layersBox_"]')||(!preview&&layers&&document.body.classList.contains('epc-native-layout')?document.querySelector('[class*="_layer_container_"]'):null);
  if(target&&box.parentElement!==target){mounted?.removeAttribute('data-epc-composition-host');mounted?.style.removeProperty('--epc-layer-top');target.append(box);mounted=target;}
  if(target&&!preview){target.setAttribute('data-epc-composition-host','edit');target.style.setProperty('--epc-layer-top',Math.max(0,target.getBoundingClientRect().top)+'px');}
  box.hidden=!target||document.body.classList.contains('epc-side-open');
  if(box.hidden)return;
  const options=controller.sync();semi.style.display=options.mode==='top'?'flex':'none';
  box.querySelector('input').checked=options.ignoreSemi;
  for(const b of box.querySelectorAll('button')){b.disabled=!ready||working;b.style.background=b.dataset.mode===options.mode?'#eaf9ef':'white';b.style.borderColor=b.dataset.mode===options.mode?'#2ac660':'#ddd';b.setAttribute('aria-pressed',String(b.dataset.mode===options.mode));}
  box.querySelector('input').disabled=!ready||working;
  if(!working)message.textContent=error||(!ready?'正在连接原版工艺模块…':options.mode==='overlap'?'重叠处保留较高的工艺高度。':options.ignoreSemi?'半透明穿透，采用下层工艺。':'非透明像素采用最上层工艺。');
 }
 async function rebuild(){
  const props=previewProps();if(!props)throw Error('未找到原版预览刷新接口，请退出后重新打开预览。');
  const revision=controller.revision,keepLayersOpen=!!visiblePreview()?.querySelector('[class*="_layersBox_"]');
  let timer,listener;
  const calculated=new Promise((resolve,reject)=>{
   listener=e=>{if(e.detail.success&&e.detail.revision===revision)resolve();else if(!e.detail.success)reject(Error(e.detail.error||'预览计算失败'));};
   window.addEventListener('epc-composition-calculated',listener);timer=setTimeout(()=>reject(Error('预览重算超时，请退出预览后重试。')),120000);
  });
  try{props.setShowTextureView(false);await new Promise(r=>setTimeout(r,60));props.setShowTextureView(true);await calculated;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(!visiblePreview())throw Error('预览已关闭，结果未显示。');}
  finally{if(keepLayersOpen){const preview=visiblePreview();if(preview&&!preview.querySelector('[class*="_layersBox_"]'))preview.querySelector('[class*="_layers_"]')?.click();}clearTimeout(timer);window.removeEventListener('epc-composition-calculated',listener);}
 }
 async function change(next){
  if(!ready||working)return;working=true;message.textContent='正在重新计算工艺…';const startedProject=host.project(),wasPreview=!!visiblePreview(),before={...controller.sync()};update();
  try{controller.set(next);update();if(wasPreview)await rebuild();error='';status(wasPreview?'工艺已重新计算，原版预览已刷新。':'工艺合成模式已更新，下次预览和打印时应用。');}
  catch(e){if(host.project()===startedProject){controller.set(before);if(wasPreview&&visiblePreview())try{await rebuild();}catch{}}error=e.message;status('工艺模式未应用：'+error);}
  finally{working=false;update();}
 }
 for(const b of box.querySelectorAll('[data-mode]'))b.onclick=()=>change({mode:b.dataset.mode});
 box.querySelector('input').onchange=e=>change({ignoreSemi:e.target.checked});
 const printGuard=e=>{const button=e.target.closest?.('button');if(!button||!/(^打印$|开始打印)/.test(button.textContent.trim()))return;if(working||!ready&&controller.sync().mode==='top'){e.preventDefault();e.stopImmediatePropagation();status(working?'请等待工艺重算完成后再打印。':'顶面工艺模块未就绪，暂不能按此模式打印。');}};
 document.addEventListener('click',printGuard,true);
 const timer=setInterval(update,300);update();
 let retries=0,retryTimer;function prepare(){if(disposed)return;EPCComposition.prepare().then(prepared=>{if(disposed)return;undo=prepared.install(controller);ready=true;error='';update();}).catch(e=>{error=e.message;update();if(++retries<20&&!/版本已变化|校验失败/.test(error))retryTimer=setTimeout(prepare,3000);});}prepare();
 const api={controller,box,rebuild,change,get ready(){return ready},get working(){return working},dispose(){disposed=true;document.removeEventListener('click',printGuard,true);clearInterval(timer);clearTimeout(retryTimer);undo?.();mounted?.removeAttribute('data-epc-composition-host');mounted?.style.removeProperty('--epc-layer-top');layoutStyle.remove();box.remove();if(window.__EPC_COMPOSITION_UI===api)delete window.__EPC_COMPOSITION_UI;}};
 window.__EPC_COMPOSITION_UI=api;return api;
}
window.EPCComposition.installUI=installUI;
})();
