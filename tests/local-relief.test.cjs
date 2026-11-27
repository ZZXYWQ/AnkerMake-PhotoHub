const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../raster-src/local-relief.js'),'utf8');
function fixture(plain=false){
 let objects,selected,craft;
 const window={},storage=new Map(),calls=[],canvas={getObjects:()=>objects,getActiveObject:()=>selected,requestRenderAll(){},discardActiveObject(){selected=null},setActiveObject(o){selected=o},remove(o){objects.splice(objects.indexOf(o),1)},insertAt(o,i){objects.splice(i,0,o)}};
 const object={id:'image',type:'image',pixelWidth:20,pixelHeight:40,_hash:'source',_cacheHash:'source',_cacheGrayHash:'old-height',textureType:'relief',inkMode:'cmyk',thickness:.4,getOriginalSrc:async()=>'data:image/png;base64,original',setGrayscale:async function(){this._cacheGrayHash='local-height';this.grayscale='';}};
 objects=[object];selected=object;
 if(plain){delete object.setGrayscale;delete object.textureType;Object.assign(object,{left:12,top:34,width:20,height:40,scaleX:2,scaleY:3,angle:90,opacity:.6,customInkModeConfig:{channels:{C:true,M:false,Y:true,K:false}}});}
 let commands=0,resolveCreate;const ed={canvas,createTextureByKeepCrop:async()=>({width:20,height:40,set(values){Object.assign(this,values)},setCoords(){},setGrayscale:async function(){this._cacheGrayHash='local-height';this.grayscale=''}}),executeCommand:async(name,args)=>{commands++;if(name==='craftCommand'){craft=args;await args.executeCb(object,{base64:args.base64});return {oldId:object.id}}args.properties.forEach((k,i)=>object[k]=args.newValues.image[i]);}};
 const host={editor:()=>ed,project:()=> 'project'};
 const api=async(path,body)=>{calls.push(path);if(path==='/relief/jobs')return new Promise(resolve=>resolveCreate=resolve);if(path.endsWith('/cancel'))return {};if(path.endsWith('/result'))return {width:20,height:40,grayDataUrl:'data:image/png;base64,height',id:'job',maxGrayValue:255};return {status:'complete',progress:100};};
 vm.runInNewContext(source,{window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout});
 const notifications=[];const controller=window.EPCLocalRelief.create({api,host,finish:async()=>{},status:()=>{},craftNotifier:(...args)=>notifications.push(args)});
 return {controller,object,canvas,ed,calls,notifications,craft:()=>craft,commands:()=>commands,resolve:()=>resolveCreate({id:'job'})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const off=fixture();assert.equal(off.controller.enabled,false);assert.equal(off.calls.length,0);await assert.rejects(()=>off.controller.generate(),/先开启/);assert.equal(off.calls.length,0);
 await off.controller.setEnabled(true);assert.equal(off.calls.length,0,'switch alone never computes');
 const job=off.controller.generate();await tick();await off.controller.setEnabled(false);off.resolve();await assert.rejects(()=>job,/取消/);assert(off.calls.some(p=>p.endsWith('/cancel')));assert.equal(off.commands(),0);assert.equal(off.object._cacheGrayHash,'old-height');
 const success=fixture();await success.controller.setEnabled(true);const result=success.controller.generate();await tick();success.resolve();await result;assert.equal(success.commands(),1);assert.equal(success.object._cacheGrayHash,'local-height');assert.equal(success.object.inkMode,'cmyk');assert.equal(success.object.thickness,.4);await success.controller.setEnabled(false);assert.equal(success.object._cacheGrayHash,'local-height','off retains applied result');
 const stale=fixture();await stale.controller.setEnabled(true);const pending=stale.controller.generate();await tick();stale.object._cacheHash='edited';stale.resolve();await assert.rejects(()=>pending,/取消/);assert.equal(stale.commands(),0);
 assert.equal(success.notifications[0][0],'CraftPanelRefresh');assert.equal(success.notifications[1][0],'EventTexturePreviewUpdate');assert.equal(success.notifications[1][1].grayscaleUpdated,true);assert(success.object.customInkModeConfig.photoHubLocalRelief);
 assert.equal(success.object.customInkModeConfig.photoHubLocalRelief.options.mode,'surface');assert.equal(success.controller.isLocal(success.object),true);
 success.object._cacheHash='new-raster';assert.equal(success.controller.isLocal(success.object),false,'an edited source cannot silently reuse an old algorithm result');
 const plain=fixture(true);await plain.controller.setEnabled(true);const plainJob=plain.controller.generate();await tick();plain.resolve();await plainJob;
 const texture=plain.canvas.getActiveObject();assert.notEqual(texture,plain.object,'ordinary image must become the native texture subclass');assert.equal(typeof texture.setGrayscale,'function');
 for(const k of ['id','left','top','width','height','scaleX','scaleY','angle','opacity','_cacheHash','_hash'])assert.equal(texture[k],plain.object[k],k+' preserved');
 assert.equal(texture.customInkModeConfig.channels,plain.object.customInkModeConfig.channels,'per-layer ink settings retained');assert(plain.controller.isLocal(texture));assert.equal(plain.commands(),1,'one native craft undo command');
 plain.canvas.remove(texture);plain.canvas.insertAt(plain.object,0);await plain.craft().executeCb(plain.object,{isRedo:true,base64:'data:image/png;base64,cached-height'});assert(plain.controller.isLocal(plain.canvas.getActiveObject()),'redo re-creates native texture and local metadata');
 const invalid=fixture(true);invalid.ed.createTextureByKeepCrop=async()=>({width:40,height:20,setGrayscale(){}});await invalid.controller.setEnabled(true);const invalidJob=invalid.controller.generate();await tick();invalid.resolve();await assert.rejects(()=>invalidJob,/方向/);assert.equal(invalid.canvas.getObjects()[0],invalid.object,'failed conversion leaves original image intact');
 console.log('PASS manual local relief: independent switch, cancellation, atomic application, retained craft and native panel/preview refresh');
})().catch(e=>{console.error(e);process.exitCode=1});
