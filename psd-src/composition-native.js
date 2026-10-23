/* AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only. Older PhotoHub releases must not be used for layer-local CMYK jobs. */
/* Version-checked adapters for the installed online editor. Original source stays on its server. */
(()=>{
const expected={
 'PrintFileLayerManager-D3CLxkMO.js':'c77507d47e223d5e6393cc4701ad3355a334acc66e8703cb20dbe7beed8ca757',
 'cavasUtil-ROGidih4.js':'32addb8a6fe5a1a15ebfc00f9547c61635e2e765533b1548340621d1363701a0',
 'src-C3r_LOs6.js':'5036ef2ee1beeb0a9ec01741deeb008a4e69005362b68fd93f2093b6f105d81d'
};
const patches={
 'src-C3r_LOs6.js':[
 ['let a=r.toDataURL();return r.width=0,r.height=0,r.remove(),a','let a=r.toDataURL();r.width=0,r.height=0,r.remove();return window.EPCLayerInk?await window.EPCLayerInk.rotatePolicy(e,a):a']
 ],
 'PrintFileLayerManager-D3CLxkMO.js':[
 ['if(t!==_.GLOSS&&t!==_.GILD&&!e.textureType)continue;',"if(window.__EPC_COMPOSITION.sync().mode!=='top')continue;"],
 ['await ve(r,()=>{Z.renderInCropCoords(r,x,f,p)}),e+1<i.length','await window.EPCComposition.renderNative(r,x,c=>Z.renderInCropCoords(r,c,f,p)),await window.__EPC_COMPOSITION.own(x,r,c=>window.EPCComposition.renderNative(r,c,d=>Z.renderInCropCoords(r,d,f,p))),e+1<i.length'],
 ['e.globalCompositeOperation=`destination-out`,await ve(e,()=>{Z.contourClipPathRender(e,x)}),e.globalCompositeOperation=`source-over`','await window.__EPC_COMPOSITION.erase(x,e,c=>window.EPCComposition.renderNative(e,c))'],
 ['n.imgComplete=!0,g.drawImage(O,C,w,T,D),O.close()','n.imgComplete=!0,window.__EPC_COMPOSITION.merge(g,O,C,w,T,D),O.close()'],
 ['if(v||(y=``),y&&!e){',"if((window.__EPC_COMPOSITION.sync().mode==='top'||v)||(y=``),y&&!e&&window.__EPC_COMPOSITION.sync().mode!=='top'){"]
 ],
 'cavasUtil-ROGidih4.js':[
 ['cn.contourClipPathRender(r,h),e+1<i.length','await window.EPCComposition.renderNative(r,h),await window.__EPC_COMPOSITION.own(h,r,c=>window.EPCComposition.renderNative(r,c)),e+1<i.length'],
 ['t!==I.GLOSS&&t!==I.GILD&&!e.textureType||(e.globalCompositeOperation=`destination-out`,cn.contourClipPathRender(e,h),e.globalCompositeOperation=`source-over`)','window.__EPC_COMPOSITION.sync().mode===\'top\'&&await window.__EPC_COMPOSITION.erase(h,e,c=>window.EPCComposition.renderNative(e,c))']
 ]
};
const moduleCache=new Map();
async function patched(name){
 if(moduleCache.has(name))return moduleCache.get(name);
 const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.endsWith('/'+name));
 if(!url||new URL(url).origin!==location.origin)throw Error('当前编辑器版本尚不支持工艺合成。');
 const source=await(await fetch(url,{cache:'force-cache'})).text(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==expected[name])throw Error('原版工艺模块版本已变化，已停止接入以免计算错误。');
 let code=source;
 for(const[old,next]of patches[name]){if(code.split(old).length!==2)throw Error('原版工艺接口校验失败');code=code.replace(old,next);}
 if(name.startsWith('Print')){
  code=code.replace(/await Z\.contourClipPathRenderCp\((\w+),(\w+),H\)/g,(s,o)=>'('+s+',window.__EPC_LAYER_INK?.record(H,'+o+'))');
  const clone='t({canvas:p,workspace:n})';if(code.split(clone).length!==2)throw Error('原版墨路图层继承接口校验失败');code=code.replace(clone,'t({canvas:window.__EPC_LAYER_INK?.inherit(p)||p,workspace:n})');
  const a='ae=U.toDataURL({format:`png`})';if(code.split(a).length!==3)throw Error('原版普通打印墨路接口校验失败');
  const safe='ae=U.toDataURL({format:`png`}),oe.url_file_size=$(ae),U.dispose();let r=';if(code.split(safe).length!==2)throw Error('原版普通打印错误处理接口校验失败');
  code=code.replace(safe,'try{ae=await(window.__EPC_LAYER_INK?.attachCanvas(U,U.toDataURL({format:`png`}),!a)??Promise.resolve(U.toDataURL({format:`png`})))}catch(error){U.dispose();t(error);return}oe.url_file_size=$(ae),U.dispose();let r=');
  code=code.replace(a,'ae=await(window.__EPC_LAYER_INK?.attachCanvas(U,U.toDataURL({format:`png`}),!a)??Promise.resolve(U.toDataURL({format:`png`})))');
  const b='y.originalHasContentColorRightList=x,E.infoPC(`getPrintImgRet =end====11111 =color`,l,f);let D=';if(code.split(b).length!==2)throw Error('原版复合打印墨路接口校验失败');code=code.replace(b,'y.originalHasContentColorRightList=x,E.infoPC(`getPrintImgRet =end====11111 =color`,l,f);let epcInkPolicy;try{epcInkPolicy=await window.__EPC_LAYER_INK?.policy(H,K,q)}catch(error){H.dispose();t(error);return}let D=');
  const c='e({dataMaskURL:I,dataColorURL:O})';if(code.split(c).length!==2)throw Error('原版墨路输出接口校验失败');code=code.replace(c,'Promise.resolve(window.__EPC_LAYER_INK?.attach(O,epcInkPolicy)||O).then(dataColorURL=>e({dataMaskURL:I,dataColorURL}),t)');
 }
 code=code.replace(/((?:from\s*|import\s*(?:\(\s*)?)\s*)(['"`])(\.\/?[^'"`]+)\2/g,(_,prefix,q,relative)=>prefix+q+new URL(relative,url).href+q).replaceAll('import.meta.url',JSON.stringify(url));
 if(name.startsWith('Print'))code+='\nexport {Ee as EPCPrint}; export async function EPCRender(obj,ctx,render){const cache=obj.objectCaching;obj.objectCaching=false;try{return await ve(obj,()=>render?render(ctx):Z.contourClipPathRenderCp(obj,ctx));}finally{obj.objectCaching=cache;}}';
 const blob=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 try{const result={original:await import(url),modified:await import(blob)};moduleCache.set(name,result);return result;}finally{URL.revokeObjectURL(blob);}
}
async function prepare(){
 const print=await patched('PrintFileLayerManager-D3CLxkMO.js'),preview=await patched('cavasUtil-ROGidih4.js'),printPackage=await patched('src-C3r_LOs6.js');
 window.EPCComposition.renderNative=print.modified.EPCRender;
 return {print,preview,printPackage,install(controller){
  const packageProto=printPackage.original.n.prototype,packageMethods={};
  // These methods share the package module's cancellation state. Replace them
  // together so an existing manager keeps its state, callbacks and file sink.
  for(const name of Object.getOwnPropertyNames(printPackage.modified.n.prototype)){if(name==='constructor')continue;packageMethods[name]=Object.getOwnPropertyDescriptor(packageProto,name);Object.defineProperty(packageProto,name,Object.getOwnPropertyDescriptor(printPackage.modified.n.prototype,name));}
  const oldPrint=print.original.t.prototype.fillGrayImgDataUrl,oldGray=preview.original.A.prototype.get3dReliefGrayImg,oldPreview=preview.original.A.prototype.getCanvasGrayImgOf3dRelief,oldColor=print.original.t.prototype.getPrintImgRet,oldCustom=print.original.t.prototype.getPrintImgRetCus;
  for(const method of ['getPrintImgRet','getPrintImgRetCus'])print.original.t.prototype[method]=async function(...args){await window.__EPC_LAYER_INK?.beforeExport();return print.modified.t.prototype[method].apply(this,args);};
  print.original.t.prototype.fillGrayImgDataUrl=async function(...args){controller.snapshot();if(controller.sync().mode==='top')controller.validate();return print.modified.t.prototype.fillGrayImgDataUrl.apply(this,args);};
  preview.original.A.prototype.get3dReliefGrayImg=preview.modified.A.prototype.get3dReliefGrayImg;
  preview.original.A.prototype.getCanvasGrayImgOf3dRelief=async function(...args){controller.snapshot();if(controller.sync().mode==='top')controller.validate();try{const result=await oldPreview.apply(this,args);window.dispatchEvent(new CustomEvent('epc-composition-calculated',{detail:{success:true,revision:controller.revision}}));return result;}catch(e){window.dispatchEvent(new CustomEvent('epc-composition-calculated',{detail:{success:false,error:e.message}}));throw e;}};
  return ()=>{for(const [name,descriptor]of Object.entries(packageMethods)){if(descriptor)Object.defineProperty(packageProto,name,descriptor);else delete packageProto[name];}print.original.t.prototype.fillGrayImgDataUrl=oldPrint;print.original.t.prototype.getPrintImgRet=oldColor;print.original.t.prototype.getPrintImgRetCus=oldCustom;preview.original.A.prototype.get3dReliefGrayImg=oldGray;preview.original.A.prototype.getCanvasGrayImgOf3dRelief=oldPreview;};
 }};
}
window.EPCComposition.prepare=prepare;
})();
