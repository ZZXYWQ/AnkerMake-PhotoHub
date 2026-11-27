const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../raster-src/native-full-resolution.js'),'utf8');
function fixture(valid=true){
 const window={__EUFY_PHOTOCRAFT_LARGE_IMAGES:true},listeners={},canvas={disposed:false,renders:0,on:(name,fn)=>(listeners[name]??=[]).push(fn),requestRenderAll(){this.renders++;},getObjects:()=>objects};
 let loads=0,resolveOriginal;const original=new Promise(resolve=>resolveOriginal=resolve);
 const object={id:'long',type:'image',width:1924,height:51160,pixelWidth:1924,pixelHeight:51160,left:12,top:23,angle:0,scaleX:.2,scaleY:.2,_element:{naturalWidth:154,naturalHeight:4095},_dsTier:4096,_dsToken:7,_dsBaseElement:{},canvas,_lodCheck(){throw Error('Old LOD must not replace full source');}};
 const objects=[object],host={editor:()=>({canvas}),original:()=>{loads++;return original;}};
 const digest=Buffer.from(valid?'869b7fbdd7aec644ca98543048cfb2e7b44704b1c83f2ac5341c8bf68a6a8bee':'00'.repeat(32),'hex');
 vm.runInNewContext(source,{window,document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})},URL,location:{origin:'https://fixture.invalid'},performance:{getEntriesByType:()=>[{name:'https://fixture.invalid/editor/assets/Image-DPZAKoo6.js'}]},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),crypto:{subtle:{digest:async()=>digest}},Uint8Array,WeakMap,WeakSet,Promise});
 return {window,host,object,canvas,listeners,resolveOriginal,loads:()=>loads};
}
(async()=>{
 const f=fixture();const geometry=JSON.stringify([f.object.width,f.object.height,f.object.left,f.object.top,f.object.scaleX,f.object.scaleY,f.object.angle]);
 assert(await f.window.EPCFullResolution.install(f.host));
 const pending=f.window.EPCFullResolution.ensure(f.object,f.host);
 assert.equal(f.loads(),1,'one original decode while multiple events arrive');assert.equal(f.object._skipDownsample,true);assert.equal(f.object._dsTier,undefined);assert(f.object._dsToken>7);
 f.resolveOriginal({naturalWidth:1924,naturalHeight:51160});assert.equal(await pending,true);
 assert.equal(f.object._element.naturalHeight,51160);assert.equal(f.canvas.renders,1);
 f.object._lodCheck();f.object._lodCheck();await Promise.resolve();assert.equal(f.object._element.naturalHeight,51160);assert.equal(f.loads(),1);
 assert.equal(JSON.stringify([f.object.width,f.object.height,f.object.left,f.object.top,f.object.scaleX,f.object.scaleY,f.object.angle]),geometry);
 await f.window.EPCFullResolution.install(f.host);assert.equal(f.listeners['object:added'].length,1,'no duplicate event hooks');
 const bad=fixture(false);assert.equal(await bad.window.EPCFullResolution.install(bad.host),false);assert.equal(bad.loads(),0);assert.equal(bad.object._dsTier,4096,'unknown vendor version unchanged');
 const filtered=fixture();filtered.object.filters=[{type:'Brightness'}];await filtered.window.EPCFullResolution.install(filtered.host);assert.equal(filtered.loads(),0);assert.equal(filtered.object._element.naturalHeight,4095,'do not discard a filter result');
 const missing=fixture();await missing.window.EPCFullResolution.install(missing.host);const job=missing.window.EPCFullResolution.ensure(missing.object,missing.host);missing.resolveOriginal({naturalWidth:154,naturalHeight:4095});assert.equal(await job,false);assert(missing.window.EPCFullResolution.lastError);assert.equal(missing.object._element.naturalHeight,4095);
 const replaced=fixture();await replaced.window.EPCFullResolution.install(replaced.host);const stale=replaced.window.EPCFullResolution.ensure(replaced.object,replaced.host);replaced.object._cacheHash='new-source';const newElement={naturalWidth:2000,naturalHeight:40000};replaced.object._element=newElement;replaced.resolveOriginal({naturalWidth:1924,naturalHeight:51160});assert.equal(await stale,false);assert.equal(replaced.object._element,newElement,'late decode must not overwrite a newer edit');
 const relief=fixture();relief.object.textureType='relief';relief.object.heightMap='unchanged-native-height-map';relief.object.thickness=.3;await relief.window.EPCFullResolution.install(relief.host);const reliefJob=relief.window.EPCFullResolution.ensure(relief.object,relief.host);relief.resolveOriginal({naturalWidth:1924,naturalHeight:51160});assert.equal(await reliefJob,true);assert.equal(relief.object.heightMap,'unchanged-native-height-map');assert.equal(relief.object.thickness,.3);assert.equal(relief.object.textureType,'relief');
 const low=f.object._cacheHash;f.window.EPCFullResolution.setEnabled(false,f.host);assert.equal(f.object._element.naturalHeight,4095,'off restores lightweight display');assert.equal(f.object._dsTier,4096);assert.equal(f.object._cacheHash,low,'off retains original source');
 const off=fixture();await off.window.EPCFullResolution.install(off.host);const offJob=off.window.EPCFullResolution.ensure(off.object,off.host);off.window.EPCFullResolution.setEnabled(false,off.host);off.resolveOriginal({naturalWidth:1924,naturalHeight:51160});assert.equal(await offJob,false);assert.equal(off.object._element.naturalHeight,4095,'off rejects pending decode');
 const full=fixture();full.object._element={naturalWidth:1924,naturalHeight:51160};await full.window.EPCFullResolution.install(full.host);full.window.EPCFullResolution.setEnabled(false,full.host);assert.equal(full.object._element.height,4096,'off makes a lightweight view even if native loaded full source first');assert.equal(full.object.pixelHeight,51160,'print source dimensions remain full');
 console.log('PASS full-resolution long-image display and independent off switch');
})().catch(e=>{console.error(e);process.exitCode=1});
