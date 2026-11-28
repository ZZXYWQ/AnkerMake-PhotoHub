/* AnkerMake PhotoHub 0.8.5 Public Beta. Host 5.1.3 / editor 1.25.04; older releases are unsupported. */
/* Version-checked adapters for the installed online editor. Original source stays on its server. */
(()=>{
const expected={
 'PrintFileLayerManager-emMpUQft.js':'602185844d03d385f6009735631245983fd39ced6949e0cf57679cc88eeb77e4',
 'printCanvasUtil-BGHFT_Zz.js':'c9eff7b02a982f4d6775a25258b18823184b701d72d31db65f6c16c2e2aac63c',
 'src-CeiAY1Ls.js':'fe3d1aa08e10473756c2b7171f346dd4cb39f9b6216ae4f9d7b619ad90eab7eb'
};
const patches={
 'printCanvasUtil-BGHFT_Zz.js':[
 ['if(t!==g.GLOSS&&t!==g.GILD&&!e.textureType)continue;',"if(window.__EPC_COMPOSITION.sync().mode!=='top')continue;"],
 ['await Ce(r,()=>{Q.renderInCropCoords(r,w,p,m)}),e+1<i.length','await window.EPCComposition.renderNative(r,w,c=>Q.renderInCropCoords(r,c,p,m)),await window.__EPC_COMPOSITION.own(w,r,c=>window.EPCComposition.renderNative(r,c,d=>Q.renderInCropCoords(r,d,p,m))),e+1<i.length'],
 ['e.globalCompositeOperation=`destination-out`,await Ce(e,()=>{Q.contourClipPathRender(e,w)}),e.globalCompositeOperation=`source-over`','await window.__EPC_COMPOSITION.erase(w,e,c=>window.EPCComposition.renderNative(e,c))'],
 ['n.imgComplete=!0,_.drawImage(O,w,T,E,D),O.close()','n.imgComplete=!0,window.__EPC_COMPOSITION.merge(_,O,w,T,E,D),O.close()'],
 ['if(v||(y=``),y&&!e){',"if((window.__EPC_COMPOSITION.sync().mode==='top'||v)||(y=``),y&&!e&&window.__EPC_COMPOSITION.sync().mode!=='top'){"]
 ],
 'src-CeiAY1Ls.js':[
 ['o.reverse(),t.rollSegmentSizes&&t.rollSegmentSizes.reverse();','const epcRollOrder=window.EPCRollPacket.order(o,t.rollSegmentSizes);o=epcRollOrder.cuts;if(epcRollOrder.sizes)t.rollSegmentSizes=epcRollOrder.sizes;'],
 ['let a=r.toDataURL();return r.width=0,r.height=0,r.remove(),a','let a=r.toDataURL();r.width=0,r.height=0,r.remove();return window.EPCLayerInk?await window.EPCLayerInk.rotatePolicy(e,a):a'],
 // Read the dimensions of the exact PNG bytes already written into the TAR.
 // Validate segment rasters without rewriting whole-job device geometry.
 // A desktop RIP fixture does not establish the device protocol contract.
 ['C.print_file=d;let E=``;','C.print_file=d;let epcPacketImages=[],E=``;'],
 ['if(w.append(r,o),C.dataUrl_fileSize=o.length/1024','if(w.append(r,o),T&&window.__EPC_PRINT_PIPELINE?.mode===`optimized`&&epcPacketImages.push(window.EPCRollPacket.imageSize(o)),C.dataUrl_fileSize=o.length/1024'],
 ['let D=JSON.parse(JSON.stringify(i));D.printLayerData.forEach','let D=JSON.parse(JSON.stringify(i));if(T&&window.__EPC_PRINT_PIPELINE?.mode===`optimized`){if(!window.EPCRollPacket)throw Error(`卷材分段几何保护尚未加载，未生成打印包`);D=window.EPCRollPacket.normalize(D,epcPacketImages,{roll:true,mode:`optimized`});}D.printLayerData.forEach']
 ],
 'PrintFileLayerManager-emMpUQft.js':[
 // The original probe allocates the entire object's bounds at print DPI,
 // even for one roll segment. Long images exceed the browser canvas limit;
 // that lost context is then reused for the ink mask. Probe only the visible
 // intersection, with the same pixel scale and object position. Print pixels,
 // segment dimensions and craft settings are not changed by this check.
 ['let t=Math.ceil(v),n=Math.ceil(y),r=a.getCanvas(t,n)','let epcRollOptimized=window.__EPC_PRINT_PIPELINE?.mode===`optimized`;if(!epcRollOptimized&&(v>32767||y>32767||v*y>268435456))throw Object.assign(Error(`图片超出原版打印生成范围，请在打印箭头中选择“超限图片优化算法”；未下发打印任务`),{photoHubPrintPipeline:true});let t=Math.ceil(epcRollOptimized?D:v),n=Math.ceil(epcRollOptimized?ee:y);if(t>32767||n>32767||t*n>268435456)throw Object.assign(Error(`当前打印段超过画布能力，未生成空数据；请检查打印段尺寸`),{photoHubPrintPipeline:true});let r=a.getCanvas(t,n)'],
 ['c.translate(-h,-_),e.render(c)','c.translate(epcRollOptimized?-S:-h,epcRollOptimized?-w:-_),e.render(c)'],
 ['let l=Math.max(0,-h),u=Math.max(0,-_),d=Math.min(s.width-l,D),f=Math.min(s.height-u,ee)','let l=epcRollOptimized?0:Math.max(0,-h),u=epcRollOptimized?0:Math.max(0,-_),d=Math.min(s.width-l,D),f=Math.min(s.height-u,ee)']
 ]
};
const moduleCache=new Map();
function compile(name,source,url){
 let code=source;
 for(const[old,next]of patches[name]){if(code.split(old).length!==2)throw Error('原版工艺接口校验失败');code=code.replace(old,next);}
 if(name.startsWith('Print')){
  const probeCatch='catch(e){return p.errorPc(`====checkColorRender: error detecting pixel====`,e),';
  if(code.split(probeCatch).length!==2)throw Error('原版打印尺寸错误接口校验失败');
  code=code.replace(probeCatch,'catch(e){if(e?.photoHubPrintPipeline)throw e;return p.errorPc(`====checkColorRender: error detecting pixel====`,e),');

  const records=/await F\.contourClipPathRenderCp\((\w+),(\w+),K\)/g;if([...code.matchAll(records)].length!==10)throw Error('原版墨路绘制顺序接口校验失败');code=code.replace(records,(s,o,ctx)=>'(await window.EPCRollPacket.render('+o+','+ctx+',K,()=>F.contourClipPathRenderCp('+o+','+ctx+',K)),window.__EPC_LAYER_INK?.record(K,'+o+'))');
  const clone='t({canvas:_,workspace:n})';if(code.split(clone).length!==2)throw Error('原版墨路图层继承接口校验失败');code=code.replace(clone,'t({canvas:window.EPCRollPacket.prepareCanvas(window.__EPC_LAYER_INK?.inherit(_)||_),workspace:n})');
  // Keep policy attached after the original pixel-check/encoding step. Only
  // the color output is tagged; native white and varnish remain unchanged.
  const ordinary='se=G.toDataURL({format:`png`}),ce.url_file_size=j(se),G.dispose()';
  if(code.split(ordinary).length!==3)throw Error('原版普通打印墨路接口校验失败');
  code=code.replace(ordinary,'se=G.toDataURL({format:`png`}),epcInkPolicy=!s?await window.__EPC_LAYER_INK?.policy(G):null,ce.url_file_size=j(se),G.dispose()');
  code=code.replace(ordinary,'se=G.toDataURL({format:`png`});try{epcInkPolicy=!s?await window.__EPC_LAYER_INK?.policy(G):null}catch(error){G.dispose();t(error);return}ce.url_file_size=j(se),G.dispose()');
  const declaration='var se=``,$=``,';if(code.split(declaration).length!==2)throw Error('原版普通打印状态接口校验失败');code=code.replace(declaration,'var epcInkPolicy,se=``,$=``,' );
  const roll='T.addStatisticalEvent(c.dev_print_generate,E),$}return p.infoPC';if(code.split(roll).length!==2)throw Error('原版卷轴墨路输出接口校验失败');code=code.replace(roll,'T.addStatisticalEvent(c.dev_print_generate,E),!s&&epcInkPolicy?await window.__EPC_LAYER_INK.attach($,epcInkPolicy):$}return p.infoPC');
  const flat='T.addStatisticalEvent(c.dev_print_generate,E),e($)})}async sharpenImage';if(code.split(flat).length!==2)throw Error('原版平面墨路输出接口校验失败');code=code.replace(flat,'T.addStatisticalEvent(c.dev_print_generate,E),Promise.resolve(!s&&epcInkPolicy?window.__EPC_LAYER_INK.attach($,epcInkPolicy):$).then(e,t)})}async sharpenImage');
  const b='E.originalHasContentColorRightList=w,p.infoPC(`getPrintImgRet =end====11111 =color`,g,v);let N=';if(code.split(b).length!==2)throw Error('原版复合打印墨路接口校验失败');code=code.replace(b,'E.originalHasContentColorRightList=w,p.infoPC(`getPrintImgRet =end====11111 =color`,g,v);let epcInkPolicy;try{epcInkPolicy=await window.__EPC_LAYER_INK?.policy(K,Z,Q)}catch(error){t(error);return}let N=');
  const out='e({dataMaskURL:V,dataColorURL:L})';if(code.split(out).length!==2)throw Error('原版墨路输出接口校验失败');code=code.replace(out,'Promise.resolve(window.__EPC_LAYER_INK?.attach(L,epcInkPolicy)||L).then(dataColorURL=>e({dataMaskURL:V,dataColorURL}),t)');
 }
 code=code.replace(/((?:from\s*|import\s*(?:\(\s*)?)\s*)(['"`])(\.\/?[^'"`]+)\2/g,(_,prefix,q,relative)=>prefix+q+new URL(relative,url).href+q).replaceAll('import.meta.url',JSON.stringify(url));
 if(name.startsWith('printCanvasUtil'))code+='\nexport async function EPCRender(obj,ctx,render){const cache=obj.objectCaching;obj.objectCaching=false;try{return await Ce(obj,()=>render?render(ctx):Q.contourClipPathRenderCp(obj,ctx));}finally{obj.objectCaching=cache;}}';
 return code;
}
async function patched(name){
 if(moduleCache.has(name))return moduleCache.get(name);
 const resources=performance.getEntriesByType('resource').map(r=>r.name);const sameAsset=u=>{try{const p=new URL(u);return p.origin===location.origin&&p.pathname.endsWith('/printCanvasUtil-BGHFT_Zz.js');}catch{return false;}};
 const url=resources.find(u=>{try{const p=new URL(u);return p.origin===location.origin&&p.pathname.endsWith('/'+name);}catch{return false;}})||(()=>{const base=resources.find(sameAsset);return base?new URL(name,base).href:null;})();
 if(!url||new URL(url).origin!==location.origin)throw Error('当前编辑器版本尚不支持工艺合成。');
 const response=await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('原版工艺模块读取失败');const source=await response.text(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==expected[name])throw Error('原版工艺模块版本已变化，已停止接入以免计算错误。');
 const code=compile(name,source,url);
 const blob=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 try{const original=await import(url),modified=await import(blob);const result={original,modified};moduleCache.set(name,result);return result;}finally{URL.revokeObjectURL(blob);}

}
async function prepare(){
 const print=await patched('PrintFileLayerManager-emMpUQft.js'),preview=await patched('printCanvasUtil-BGHFT_Zz.js'),printPackage=await patched('src-CeiAY1Ls.js');
 window.EPCComposition.renderNative=preview.modified.EPCRender;
 return {print,preview,printPackage,install(controller){
  const restores=[];
  function copy(original,modified){if(!original?.prototype||!modified?.prototype)throw Error('原版工艺类接口不匹配');const proto=original.prototype;for(const name of Object.getOwnPropertyNames(modified.prototype)){if(name==='constructor')continue;const old=Object.getOwnPropertyDescriptor(proto,name);Object.defineProperty(proto,name,Object.getOwnPropertyDescriptor(modified.prototype,name));restores.push(()=>{if(old)Object.defineProperty(proto,name,old);else delete proto[name];});}}
  // All methods in each class share one lexical cancellation/cache state.
  // Project/account managers are imported from the original shared modules.
  copy(printPackage.original.n,printPackage.modified.n);
  copy(preview.original.p,preview.modified.p);
  copy(print.original.t,print.modified.t);
  const proto=print.original.t.prototype,grayProto=preview.original.p.prototype;
  for(const method of ['getPrintImgRet','getPrintImgRetCus']){const next=proto[method];proto[method]=async function(...args){const pipeline=window.__EPC_PRINT_PIPELINE;pipeline?.begin();try{await window.__EPC_LAYER_INK?.beforeExport();return await next.apply(this,args);}finally{pipeline?.end();}};}
  const fill=proto.fillGrayImgDataUrl;proto.fillGrayImgDataUrl=async function(...args){controller.snapshot();if(controller.sync().mode==='top')controller.validate();return fill.apply(this,args);};
  const calc=grayProto.getCanvasGrayImgOf3dRelief;grayProto.getCanvasGrayImgOf3dRelief=async function(...args){controller.snapshot();if(controller.sync().mode==='top')controller.validate();try{const result=await calc.apply(this,args);window.dispatchEvent(new CustomEvent('epc-composition-calculated',{detail:{success:true,revision:controller.revision}}));return result;}catch(e){window.dispatchEvent(new CustomEvent('epc-composition-calculated',{detail:{success:false,error:e.message}}));throw e;}};
  return ()=>{for(const restore of restores.reverse())restore();};
 }};
}

window.EPCComposition.prepare=prepare;
})();
