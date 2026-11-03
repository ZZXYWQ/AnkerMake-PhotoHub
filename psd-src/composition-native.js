/* AnkerMake PhotoHub 0.7.0 Public Beta. Host 5.1.3 / editor 1.23.02 only; older releases are unsupported. */
/* Version-checked adapters for the installed online editor. Original source stays on its server. */
(()=>{
const expected={
 'PrintFileLayerManager-EDl4kp3F.js':'fcbb629fd5a0cd7dc3d8d10894cab3e1445499503a099579cce5c240d6ed5e24',
 'Generating_img-Sr0X61KY.js':'d94001702f1164a060c4453d399249feea7b36acf4f7241cd4e7e0a8cc67a6a5'
};
const patches={
 'PrintFileLayerManager-EDl4kp3F.js':[
 ['if(t!==_.GLOSS&&t!==_.GILD&&!e.textureType)continue;',"if(window.__EPC_COMPOSITION.sync().mode!=='top')continue;"],
 ['await ve(r,()=>{Z.renderInCropCoords(r,x,f,p)}),e+1<i.length','await window.EPCComposition.renderNative(r,x,c=>Z.renderInCropCoords(r,c,f,p)),await window.__EPC_COMPOSITION.own(x,r,c=>window.EPCComposition.renderNative(r,c,d=>Z.renderInCropCoords(r,d,f,p))),e+1<i.length'],
 ['e.globalCompositeOperation=`destination-out`,await ve(e,()=>{Z.contourClipPathRender(e,x)}),e.globalCompositeOperation=`source-over`','await window.__EPC_COMPOSITION.erase(x,e,c=>window.EPCComposition.renderNative(e,c))'],
 ['n.imgComplete=!0,g.drawImage(D,C,w,T,E),D.close()','n.imgComplete=!0,window.__EPC_COMPOSITION.merge(g,D,C,w,T,E),D.close()'],
 ['if(v||(y=``),y&&!e){',"if((window.__EPC_COMPOSITION.sync().mode==='top'||v)||(y=``),y&&!e&&window.__EPC_COMPOSITION.sync().mode!=='top'){"]
 ],
 'Generating_img-Sr0X61KY.js':[
 ['let a=r.toDataURL();return r.width=0,r.height=0,r.remove(),a','let a=r.toDataURL();r.width=0,r.height=0,r.remove();return window.EPCLayerInk?await window.EPCLayerInk.rotatePolicy(e,a):a'],
 ['gr.contourClipPathRender(r,h),e+1<i.length','await window.EPCComposition.renderNative(r,h),await window.__EPC_COMPOSITION.own(h,r,c=>window.EPCComposition.renderNative(r,c)),e+1<i.length'],
 ['(t===I.GLOSS||t===I.GILD||e.textureType)&&(e.globalCompositeOperation=`destination-out`,gr.contourClipPathRender(e,h),e.globalCompositeOperation=`source-over`)','window.__EPC_COMPOSITION.sync().mode===\'top\'&&await window.__EPC_COMPOSITION.erase(h,e,c=>window.EPCComposition.renderNative(e,c))']
 ]
};
const moduleCache=new Map();
async function patched(name){
 if(moduleCache.has(name))return moduleCache.get(name);
 const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>{try{const parsed=new URL(u);return parsed.origin===location.origin&&parsed.pathname.endsWith('/'+name);}catch{return false;}});
 if(!url||new URL(url).origin!==location.origin)throw Error('当前编辑器版本尚不支持工艺合成。');
 const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw Error('原版工艺模块读取失败');const source=await response.text(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==expected[name])throw Error('原版工艺模块版本已变化，已停止接入以免计算错误。');
 let code=source;
 for(const[old,next]of patches[name]){if(code.split(old).length!==2)throw Error('原版工艺接口校验失败');code=code.replace(old,next);}
 if(name.startsWith('Print')){
  const records=/await Z\.contourClipPathRenderCp\((\w+),(\w+),H\)/g;if([...code.matchAll(records)].length!==10)throw Error('原版墨路绘制顺序接口校验失败');code=code.replace(records,(s,o)=>'('+s+',window.__EPC_LAYER_INK?.record(H,'+o+'))');
  const clone='t({canvas:p,workspace:n})';if(code.split(clone).length!==2)throw Error('原版墨路图层继承接口校验失败');code=code.replace(clone,'t({canvas:window.__EPC_LAYER_INK?.inherit(p)||p,workspace:n})');
  const a='ae=W.toDataURL({format:`png`})';if(code.split(a).length!==3)throw Error('原版普通打印墨路接口校验失败');
  const safe='ae=W.toDataURL({format:`png`}),oe.url_file_size=$(ae),W.dispose();let r=';if(code.split(safe).length!==2)throw Error('原版普通打印错误处理接口校验失败');
  code=code.replace(safe,'try{ae=await(window.__EPC_LAYER_INK?.attachCanvas(W,W.toDataURL({format:`png`}),!o)??Promise.resolve(W.toDataURL({format:`png`})))}catch(error){W.dispose();t(error);return}oe.url_file_size=$(ae),W.dispose();let r=');
  code=code.replace(a,'ae=await(window.__EPC_LAYER_INK?.attachCanvas(W,W.toDataURL({format:`png`}),!o)??Promise.resolve(W.toDataURL({format:`png`})))');
  const b='v.originalHasContentColorRightList=x,j.infoPC(`getPrintImgRet =end====11111 =color`,l,f);let E=';if(code.split(b).length!==2)throw Error('原版复合打印墨路接口校验失败');code=code.replace(b,'v.originalHasContentColorRightList=x,j.infoPC(`getPrintImgRet =end====11111 =color`,l,f);let epcInkPolicy;try{epcInkPolicy=await window.__EPC_LAYER_INK?.policy(H,K,q)}catch(error){H.dispose();t(error);return}let E=');
  const c='e({dataMaskURL:R,dataColorURL:D})';if(code.split(c).length!==2)throw Error('原版墨路输出接口校验失败');code=code.replace(c,'Promise.resolve(window.__EPC_LAYER_INK?.attach(D,epcInkPolicy)||D).then(dataColorURL=>e({dataMaskURL:R,dataColorURL}),t)');
 }
 code=code.replace(/((?:from\s*|import\s*(?:\(\s*)?)\s*)(['"`])(\.\/?[^'"`]+)\2/g,(_,prefix,q,relative)=>prefix+q+new URL(relative,url).href+q).replaceAll('import.meta.url',JSON.stringify(url));
 if(name.startsWith('Print'))code+='\nexport {Ee as EPCPrint}; export async function EPCRender(obj,ctx,render){const cache=obj.objectCaching;obj.objectCaching=false;try{return await ve(obj,()=>render?render(ctx):Z.contourClipPathRenderCp(obj,ctx));}finally{obj.objectCaching=cache;}}';
 if(name.startsWith('Generating_img-'))code+='\nimport {ut as EPCOriginalProjectManager} from '+JSON.stringify(url)+'; $=EPCOriginalProjectManager;';
 const blob=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 try{const original=await import(url),modified=await import(blob);const result={original,modified};if(name.startsWith('Generating_img-')){result.original={...original,A:original.$,R:original.ut,n:original.$};result.modified={...modified,A:modified.$,R:modified.ut,n:modified.$};if(modified.ut!==original.ut)throw Error('原版项目单例继承失败');}moduleCache.set(name,result);return result;}finally{URL.revokeObjectURL(blob);}
}
async function prepare(){
 const print=await patched('PrintFileLayerManager-EDl4kp3F.js'),preview=await patched('Generating_img-Sr0X61KY.js'),printPackage=preview;
 window.EPCComposition.renderNative=print.modified.EPCRender;
 return {print,preview,printPackage,install(controller){
  const packageProto=printPackage.original.n.prototype,packageMethods={};
  const oldPrint=print.original.t.prototype.fillGrayImgDataUrl,oldGray=preview.original.A.prototype.get3dReliefGrayImg,oldPreview=preview.original.A.prototype.getCanvasGrayImgOf3dRelief,oldColor=print.original.t.prototype.getPrintImgRet,oldCustom=print.original.t.prototype.getPrintImgRetCus;
  // These methods share the package module's cancellation state. Replace them
  // together so an existing manager keeps its state, callbacks and file sink.
  for(const name of Object.getOwnPropertyNames(printPackage.modified.n.prototype)){if(name==='constructor')continue;packageMethods[name]=Object.getOwnPropertyDescriptor(packageProto,name);Object.defineProperty(packageProto,name,Object.getOwnPropertyDescriptor(printPackage.modified.n.prototype,name));}
  for(const method of ['getPrintImgRet','getPrintImgRetCus'])print.original.t.prototype[method]=async function(...args){await window.__EPC_LAYER_INK?.beforeExport();return print.modified.t.prototype[method].apply(this,args);};
  print.original.t.prototype.fillGrayImgDataUrl=async function(...args){controller.snapshot();if(controller.sync().mode==='top')controller.validate();return print.modified.t.prototype.fillGrayImgDataUrl.apply(this,args);};
  preview.original.A.prototype.get3dReliefGrayImg=preview.modified.A.prototype.get3dReliefGrayImg;
  preview.original.A.prototype.getCanvasGrayImgOf3dRelief=async function(...args){controller.snapshot();if(controller.sync().mode==='top')controller.validate();try{const result=await preview.modified.A.prototype.getCanvasGrayImgOf3dRelief.apply(this,args);window.dispatchEvent(new CustomEvent('epc-composition-calculated',{detail:{success:true,revision:controller.revision}}));return result;}catch(e){window.dispatchEvent(new CustomEvent('epc-composition-calculated',{detail:{success:false,error:e.message}}));throw e;}};
  return ()=>{for(const [name,descriptor]of Object.entries(packageMethods)){if(descriptor)Object.defineProperty(packageProto,name,descriptor);else delete packageProto[name];}print.original.t.prototype.fillGrayImgDataUrl=oldPrint;print.original.t.prototype.getPrintImgRet=oldColor;print.original.t.prototype.getPrintImgRetCus=oldCustom;preview.original.A.prototype.get3dReliefGrayImg=oldGray;preview.original.A.prototype.getCanvasGrayImgOf3dRelief=oldPreview;};
 }};
}
window.EPCComposition.prepare=prepare;
})();
