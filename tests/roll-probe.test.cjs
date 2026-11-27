/* Exercise the verified vendor pixel probe with a long roll image. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const folder=process.argv[2];if(!folder)throw Error('Supply the verified editor fixture directory');
const scope={URL,window:{EPCComposition:{}}};
const adapter=fs.readFileSync(path.join(__dirname,'../psd-src/composition-native.js'),'utf8').replace('window.EPCComposition.prepare=prepare;','window.EPCComposition.prepare=prepare;window.compile=compile;');
vm.runInNewContext(adapter,scope);
const name='PrintFileLayerManager-emMpUQft.js',raw=fs.readFileSync(path.join(folder,name),'utf8');
const fixed=scope.window.compile(name,raw,'https://fixture.invalid/editor/assets/'+name);
function extract(source){const start=source.indexOf('async checkColorRender(e)'),end=source.indexOf('canvasHasAlpha(',start);assert.ok(start>=0&&end>start);return source.slice(start,end).replace('async checkColorRender(e)','async function(e)');}
function pixelContext(width,height,hasPixels=true){return {canvas:{width,height},filled:hasPixels,save(){},restore(){},translate(x,y){this.translation=[x,y]},getImageData(){const data=new Uint8ClampedArray(4);if(this.filled)data[3]=255;return {data}}};}
async function run(source,bounds,hasPixels=true,mode='optimized'){
 const allocations=[],releases=[],main=pixelContext(3542,1200,hasPixels);
 const clone={strokeWidth:0,set(){},setCoords(){},getBoundingRect(){return bounds},render(ctx){ctx.filled=hasPixels&&!ctx.lost}};
 const original={type:'image',scaleX:1,scaleY:1,left:bounds.left,top:bounds.top,clone(cb){cb(clone)},toJSON(){return {}}};
 const pool={getCanvas(width,height){const ctx=pixelContext(width,height,false);ctx.lost=width>32767||height>32767||width*height>268435456;allocations.push({width,height,ctx});return {id:'probe',canvas:ctx.canvas,context:ctx}},releaseCanvas(id){releases.push(id)}};
 const fn=vm.runInNewContext('('+extract(source)+')',{window:{__EPC_PRINT_PIPELINE:{mode}},p:{infoPC(){},log(){},errorPc(){}},h:{Text:'text'},C:{},g:[]});
 const result=await fn({obj:original,tempCtxColorRet:main,canvasPoolManager:pool});
 return {result,allocations,releases};
}
(async()=>{
 const bounds={left:0,top:-93000,width:3542,height:94223};
 const before=await run(raw,bounds),after=await run(fixed,bounds);
 assert.equal(before.allocations[0].height,94223);assert.equal(before.result.hasPixels,false);
 assert.equal(after.allocations[0].width,3542);assert.equal(after.allocations[0].height,1200);
 assert.equal(after.result.hasPixels,true);assert.equal(after.result.originalHasContentColorRight,true);
 assert.ok(after.allocations[0].ctx.translation.every(value=>value===0));assert.deepEqual(after.releases,['probe']);
 await assert.rejects(()=>run(fixed,bounds,true,'native'),/超限图片优化算法/);
 const short={left:10,top:20,width:64,height:70};
 for(const opaque of [true,false]){
  const a=await run(raw,short,opaque),b=await run(fixed,short,opaque);
  const native=await run(fixed,short,opaque,'native');assert.equal(JSON.stringify(native.result),JSON.stringify(a.result));assert.equal(native.allocations[0].width,a.allocations[0].width);assert.equal(native.allocations[0].height,a.allocations[0].height);
  assert.equal(b.result.hasPixels,a.result.hasPixels);assert.equal(b.result.originalHasContentColorRight,a.result.originalHasContentColorRight);
  assert.deepEqual(b.allocations[0].ctx.translation,[-10,-20]);
 }
 assert.equal((await run(fixed,{left:4000,top:0,width:100,height:100})).allocations.length,0);
 console.log('PASS vendor long-roll probe: bounded allocation, visible pixels retained, short/transparent/off-canvas behavior preserved');
})().catch(error=>{console.error(error);process.exitCode=1});
