const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=require('../manifest.json');
const fixture=process.argv[2]||process.env.PH_NATIVE_EDITOR_FIXTURE;
if(!fixture){
 const listeners=[];vm.runInNewContext(fs.readFileSync(path.join(root,'payload/large-image-import.js'),'utf8'),{window:{addEventListener:(...args)=>listeners.push(args)}});
 assert.equal(listeners.length,0);console.log('PASS native file/drop events retained; set PH_NATIVE_EDITOR_FIXTURE for original editor profile checks');process.exit(0);
}
let source=fs.readFileSync(fixture,'utf8');
for(const p of manifest.files[0].patches){assert.equal(source.split(p.old).length-1,p.count,p.old);source=source.replace(p.old,p.new);}
const end=(start,next)=>source.slice(source.indexOf(start),source.indexOf(next,source.indexOf(start)));
(async()=>{
 const window={__EUFY_PHOTOCRAFT_LARGE_IMAGES:false};
 let cacheReads=0;
 const scope={window,usePcLocalCache:()=>({get:async()=>{cacheReads++;return [null,'resize']}}),isPc:()=>true,IMAGE_RESIZE_CHOICE:'choice',normalizeImageResizeChoice:x=>x,getLocalStorageCustom:()=> 'resize',setLocalStorage$1:()=>{},isPdfFile:()=>false,getImageSizeFromHeaders:async()=>({width:51160,height:1924}),getFileExtension:()=> 'jpg'};
 vm.createContext(scope);
 vm.runInContext(end('function shouldPreprocessImage(', 'function computeTargetSize(')+'\nresize='+end('getImageResizeChoice=async()=>{','},setImageResizeChoice=')+'};\n'+end('async function validateImageDimensions(', 'function isValidHttpUrl('),scope);
 assert.equal(scope.shouldPreprocessImage(89314640,51160,1924),true);
 assert.equal(await scope.resize(),'resize');
 assert.equal(await scope.validateImageDimensions({name:'long.jpg'}),'string_image_side_limit_exceeded');
 window.__EUFY_PHOTOCRAFT_LARGE_IMAGES=true;
 assert.equal(scope.shouldPreprocessImage(89314640,51160,1924),false);
 assert.equal(await scope.resize(),'keep');assert.equal(cacheReads,1,'keep-size must not modify remembered user preference');
 assert.equal(await scope.validateImageDimensions({name:'long.jpg'}),null);
 const listeners=[];vm.runInNewContext(fs.readFileSync(path.join(root,'payload/large-image-import.js'),'utf8'),{window:{addEventListener:(...args)=>listeners.push(args)}});assert.equal(listeners.length,0,'native input/drop must not be intercepted');
 let added,mode;
 scope.context={get:async kind=>kind==='project'?{getInstance:()=>({getCanvasDpi:()=>5})}:{canvasEditor:{canvas:{width:200,height:400,getObjects:()=>[]},addImageByDpi:(url,size,callback,resize)=>{added=size;mode=resize;}}}};
 scope.getImageOriginalSize=async()=>({width:1924,height:51160});scope.base64ToUint8Array$2=()=>new Uint8Array();scope.getImageDpi=async()=>({xDPI:72,yDPI:72});scope.StringUtil={pixelToMm:(v,dpi)=>v*25.4/dpi,mmToPixel:(v,dpi)=>v*dpi/25.4};scope.WorkspaceID={WorkspaceCavas:'workspace'};scope.eventBus={emit:()=>{throw Error('Must not ask to shrink image')}};
 vm.runInContext('importNative='+end('checkImageSizeAndAdd=async(', '},checkSvgSizeAndAdd$1=')+'};',scope);
 await scope.importNative('original-jpeg',false,'jpg','long.jpg');
 assert.equal(mode,false);assert(Math.abs(added.width*25.4/5-1924*25.4/72)<1e-8);assert(Math.abs(added.height*25.4/5-51160*25.4/72)<1e-8);
 console.log('PASS native full-size import: original file/drop events, size gate switch, preprocessing disabled, keep-size without preference mutation, original 72 DPI dimensions retained outside canvas');
})().catch(e=>{console.error(e);process.exitCode=1});
