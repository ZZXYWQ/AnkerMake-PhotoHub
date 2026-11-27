const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{let disposed=0,created=0;const source={width:1924,height:51160,naturalWidth:1924,naturalHeight:51160},o={id:'source',_element:source,_cacheHash:'color',_cacheGrayHash:'height',width:1924,height:51160,scaleX:1,scaleY:1};const objects=[o],ed={canvas:{getObjects:()=>objects},getImageResource:async()=> 'height-source'};
class Engine{constructor(){created++}async init(src,w,h){this.w=w;this.h=h;return true}setGlobalAdjustments(p){this.p=p}readGrayBuffer(){return {gray:new Uint8Array(this.w*this.h),width:this.w,height:this.h}}dispose(){disposed++}}
class Image{naturalWidth=1924;naturalHeight=51160;set src(s){if(s)queueMicrotask(()=>this.onload?.())}}
const window={__PH_PREVIEW_SESSION_ACTIVE:true,__EPC_HOST:{editor:()=>ed,project:()=> 'project'}};
const document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},clearRect(){}}),toDataURL:()=> 'tile',remove(){}})};
vm.runInNewContext(fs.readFileSync('raster-src/relief-preview-tiles.js','utf8'),{window,Image,document,setTimeout:fn=>queueMicrotask(fn),Uint8Array});
let result;const updates=[],scene={sessionId:'texture-preview',create(d,done){result=d;done?.()},updateFromBuffer(b,p){updates.push(p)}};window.EPCReliefTiles.install(scene,Engine);
const original={widthMM:290,grayData:[{id:'source',posX:0,posY:0,sizeWidth:280,thickness:.3}],bufferData:{source:'native-buffer'}};const before=JSON.stringify(original);
await new Promise(resolve=>scene.create(original,resolve,{retainSources:true}));assert(result.__phPreviewTiles);assert.equal(JSON.stringify(original),before);assert.equal(result.grayData.length,14);assert.equal(new Set(result.grayData.map(x=>x.id)).size,14);assert.equal(created,1);assert.equal(disposed,1);assert.equal(objects.length,1);assert.equal(o._cacheGrayHash,'height');
const t=result.grayData,full=280*51160/1924;for(let i=1;i<t.length;i++){const previousHeight=result.bufferData[t[i-1].id].height/1024*280,nextHeight=result.bufferData[t[i].id].height/1024*280;assert(Math.abs(t[i].posY-t[i-1].posY-(previousHeight+nextHeight)/2)<.02)}
scene.updateFromBuffer({}, {id:'source',thickness:.5});for(let i=0;i<120&&!updates.length;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(updates.length,14);assert(updates.every(x=>x.thickness===.5));assert.equal(disposed,2);console.log('PASS tiled native scene: 14 contiguous meshes, original object/cache/print data unchanged, one GPU engine, per-layer thickness update');
})().catch(e=>{console.error(e);process.exitCode=1});
