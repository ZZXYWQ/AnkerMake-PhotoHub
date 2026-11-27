const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../raster-src/local-relief.js'),'utf8');
function fixture(failure){let clicks=0,project='p';const object={id:'image',_cacheGrayHash:'height',textureType:'pattern'},objects=[object],calls=[];
const ed={canvas:{getActiveObject:()=>object,getObjects:()=>objects,toObject:()=>({objects:[{id:'image'}]}),viewportTransform:[1,0,0,1,0,0]}};
const window={EPCReliefPreview:{install:async()=>true}};
vm.runInNewContext(source,{window,localStorage:{getItem(){}},location:{href:'https://fixture.invalid/editor/2d/'},document:{querySelector:()=>({disabled:false,getBoundingClientRect:()=>({width:30}),click(){clicks++}})}});
const controller=window.EPCLocalRelief.create({host:{editor:()=>ed,project:()=>project},finish:async()=>{},status(){},api:async path=>{calls.push(path);if(path.endsWith('prepare')){if(failure==='prepare')throw Error('unverified scene');if(failure==='switch')project='other';return {ready:true}}return {saved:failure!=='checkpoint'}}});return{controller,calls,objects,clicks:()=>clicks};}
(async()=>{const ok=fixture();await ok.controller.preview();assert.deepEqual(ok.calls,['/relief/preview/prepare','/relief/preview/checkpoint']);assert.equal(ok.clicks(),1);assert.equal(ok.objects.length,1);
for(const failure of ['prepare','switch','checkpoint']){const f=fixture(failure);await assert.rejects(()=>f.controller.preview());assert.equal(f.clicks(),0,'failed protection must never enter native preview');assert.equal(f.objects.length,1)}console.log('PASS preview requires verified bounded scene and saved recovery checkpoint; failures keep canvas intact');})().catch(e=>{console.error(e);process.exitCode=1});
