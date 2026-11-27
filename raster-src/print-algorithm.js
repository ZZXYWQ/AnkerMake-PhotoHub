/* Native split-print menu: choose data generation only, never replace relief. */
(()=>{'use strict';
function create({host,relief,status}){
 let disposed=false,observer=null,root=null,frame=0,pillOwner=null,pillStyle=null,generating=0,activeMode=null;
 const stats={started:0,finished:0,lastMode:null};
 const key=()=> 'photohub-print-pipeline:'+host.project();
 function mode(){try{return localStorage.getItem(key())==='optimized'?'optimized':'native';}catch{return 'native';}}
 function choose(value){
  if(!['native','optimized'].includes(value))throw Error('打印算法选项无效');
  if(generating||relief.running)throw Error('正在生成数据，请完成后再切换打印算法');
  localStorage.setItem(key(),value);update();
  status(value==='optimized'?'已选择超限图片优化算法：按打印段生成数据，保留现有工艺与高度图。':'已选择原版打印算法：用于普通尺寸，保留现有工艺与高度图。');
  return {mode:value};
 }
 function begin(){if(!generating)activeMode=mode();generating++;stats.started++;stats.lastMode=activeMode;update();return activeMode;}
 function end(){generating=Math.max(0,generating-1);stats.finished++;if(!generating)activeMode=null;update();}
 function update(){
  if(!root?.isConnected)return;const selected=activeMode||mode();
  for(const button of root.querySelectorAll('[data-ph-algorithm]')){
   const checked=button.dataset.phAlgorithm===selected;button.disabled=!!generating||relief.running;button.setAttribute('aria-checked',String(checked));const mark=button.querySelector('[data-check]'),text=checked?'✓':'';if(mark.textContent!==text)mark.textContent=text;
  }
  const label=root.querySelector('[data-algorithm-state]'),text=generating?'正在生成打印数据':'打印数据生成（不改变工艺）';if(label.textContent!==text)label.textContent=text;
 }
 function attach(){
  frame=0;if(disposed)return;
  const pill=document.querySelector('div[class*="_printContourPill_"]');
  if(!pill){root?.remove();return;}
  if(pillOwner!==pill){
   if(pillOwner?.isConnected)pillOwner.style.cssText=pillStyle;
   pillOwner=pill;pillStyle=pill.style.cssText;
   Object.assign(pill.style,{height:'auto',width:'max-content',minWidth:'232px',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100vh - 120px)',overflowY:'auto',right:'0',top:'auto',bottom:'calc(100% + 8px)',boxSizing:'border-box',color:'#333',background:'#fff'});
  }
  if(!root){
   root=document.createElement('div');root.id='epc-print-algorithm';root.setAttribute('role','group');root.setAttribute('aria-label','打印算法');root.style.cssText='border-top:1px solid #eee;padding-top:6px;margin-top:6px;min-width:220px;font:inherit;color:inherit';
   const label=document.createElement('div');label.dataset.algorithmState='';label.style.cssText='font-size:12px;color:#777;padding:4px 12px';root.append(label);
   for(const[value,text]of [['native','原版打印算法（普通图片）'],['optimized','超限图片优化算法']]){
    const button=document.createElement('button');button.type='button';button.dataset.phAlgorithm=value;button.setAttribute('role','menuitemradio');
    button.style.cssText='display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:10px 12px;cursor:pointer;border-radius:6px';
    const mark=document.createElement('span');mark.dataset.check='';mark.style.cssText='display:inline-block;width:16px';button.append(mark,document.createTextNode(text));
    button.onmouseenter=()=>button.style.background='#f5f5f5';button.onmouseleave=()=>button.style.background='transparent';
    button.onclick=e=>{e.preventDefault();e.stopPropagation();try{choose(value);}catch(error){status(error.message);}};root.append(button);
   }
  }
  const sample=pill.querySelector('button:not([data-ph-algorithm])');for(const button of root.querySelectorAll('button'))if(sample)button.className=sample.className;
  if(root.parentElement!==pill)pill.append(root);update();
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(attach);}
 const guard=e=>{if((generating||relief.running)&&e.target.closest?.('button[class*="_printButtonMain_"],button[class*="_ButtonPreview_"],button[class*="_printContourMenuItem_"]:not([data-ph-algorithm])')){e.preventDefault();e.stopImmediatePropagation();status('正在生成数据，请完成后再预览或打印。');}};
 const controller={choose,mode,begin,end,stats,get busy(){return !!generating;},get modeValue(){return activeMode||mode();},install,dispose};
 function install(){window.__EPC_PRINT_PIPELINE={get mode(){return controller.modeValue;},begin,end,stats};document.addEventListener('click',guard,true);observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});attach();}
 function dispose(){disposed=true;observer?.disconnect();cancelAnimationFrame(frame);document.removeEventListener('click',guard,true);root?.remove();if(pillOwner?.isConnected)pillOwner.style.cssText=pillStyle;if(window.__EPC_PRINT_PIPELINE?.begin===begin)delete window.__EPC_PRINT_PIPELINE;}
 return controller;
}
window.EPCPrintAlgorithm={create};
})();
