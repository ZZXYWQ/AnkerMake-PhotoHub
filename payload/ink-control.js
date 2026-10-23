/* Physical CMYK selection in the host's existing ink-mode panel. */
(() => {
 'use strict';
 window.EPCInkControl={install({api,host,status}){
  window.__EPC_INK_UI?.dispose();
  const layer=window.EPCLayerInk.install({api,host,status});
  let disposed=false,pending=false,current=null,draft=null,target=null,tick=0,lastRead=0;
  const box=document.createElement('section');box.id='epc-ink-control';
  box.style.cssText='font:inherit;color:inherit;border-top:1px solid #e8e8e8;margin-top:12px;padding-top:12px';
  box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span>当前图层 CMYK</span><button type="button" data-all style="font:inherit;border:0;background:transparent;color:#777;cursor:pointer">全选</button></div><div data-channels style="display:flex;gap:14px;align-items:center"></div><div data-note role="status" style="font-size:11px;color:#888;line-height:1.6;margin-top:9px">正在连接墨路组件…</div><div style="font-size:11px;color:#888;line-height:1.6;margin-top:4px">仅修改当前图层，随项目保存；白墨、光油沿用该层原版工艺。</div>';
  const note=box.querySelector('[data-note]'),inputs=[];
  box.querySelector('span').style.cssText='font:inherit;color:#333';
  for(const [index,name]of ['C','M','Y','K'].entries()){
   const label=document.createElement('label');label.style.cssText='display:flex;gap:4px;align-items:center;cursor:pointer';
   const input=document.createElement('input');input.type='checkbox';input.dataset.channel=name;input.setAttribute('aria-label','当前图层 '+name+' 墨路');input.style.accentColor='#2ac660';input.disabled=true;
   input.onchange=()=>change(inputs.reduce((mask,x,i)=>mask|(x.checked?1<<i:0),0));label.append(input,name);inputs.push(input);box.querySelector('[data-channels]').append(label);
  }
  box.querySelector('[data-all]').onclick=()=>change(15);
  function selected(){try{return layer.selected();}catch{return null;}}
  function render(){box.hidden=!document.body.classList.contains('epc-native-layout');const o=selected(),disabled=pending||!o||!current?.ready||!current.layerPolicySupported||current.busy;for(let i=0;i<4;i++){inputs[i].checked=!!((draft??layer.value(o))&1<<i);inputs[i].disabled=disabled;}box.querySelector('[data-all]').disabled=disabled;if(!pending)note.textContent=!o?'请选择单个图层。':!current?.layerPolicySupported?'逐图层墨路组件尚未就绪，请安装对应更新。':message({...current,mask:layer.value(o)});}
  function message(s){return s.fault?'墨路处理失败（'+s.fault+'），请查看原版任务错误。':s.busy?'正在处理打印数据，墨路已锁定。':s.mask===15?'C、M、Y、K 全部启用。':s.mask===0?'全部彩色墨路关闭；仅保留原版启用的白墨／光油。':'仅启用 '+['C','M','Y','K'].filter((_,i)=>s.mask&1<<i).join('、')+'；其余彩色墨路输出为零。';}
  async function read(){if(pending||disposed)return;pending=true;render();try{current=await api('/ink/status');if(current.mask!==15&&!current.busy)current=await api('/ink/mask',{mask:15});}catch(e){current=null;note.textContent=e.message+'，点击此处重试。';}finally{pending=false;lastRead=Date.now();render();}}
  async function change(mask){if(pending||!current?.ready||!current.layerPolicySupported)return;pending=true;draft=mask;note.textContent='正在保存当前图层墨路…';render();let error;try{await layer.set(mask);}catch(e){error=e.message;}finally{pending=false;draft=null;render();if(error)note.textContent=error;}}
  note.onclick=read;
  function attach(){tick=0;if(disposed)return;
   const title=[...document.querySelectorAll('span')].find(e=>e.textContent.trim()==='墨水模式'&&e.getBoundingClientRect().width>0&&!e.closest('#epc-ink-control'));
   const next=title?.parentElement?.parentElement;
   if(next&&next!==target){target=next;next.append(box);if(Date.now()-lastRead>1000)read();}
   else if(!next&&box.isConnected){box.remove();target=null;}
  }
  const observer=new MutationObserver(()=>{if(!tick)tick=requestAnimationFrame(attach);});observer.observe(document.body,{childList:true,subtree:true});
  const timer=setInterval(()=>{if(box.isConnected&&!pending){render();if(Date.now()-lastRead>3000)read();}},300);attach();
  const result={read,change,getState:()=>({...current,mask:layer.value(selected()),objectId:selected()?.id}),dispose(){disposed=true;observer.disconnect();clearInterval(timer);cancelAnimationFrame(tick);box.remove();layer.dispose();}};
  window.__EPC_INK_UI=result;return result;
 }};
})();
