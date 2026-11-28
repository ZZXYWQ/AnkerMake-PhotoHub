const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const context={window:{},structuredClone,Uint8Array,DataView,Number,Error};vm.runInNewContext(fs.readFileSync('raster-src/roll-packet.js','utf8'),context);const api=context.window.EPCRollPacket;
const original={imgQuality:300,format_size_w:290,format_size_h:7450,format_size_w_non:290,format_size_h_non:7450,rollSegmentIndex:1,rollSegmentSizes:[{widthPx:3425,heightPx:336},{widthPx:3425,heightPx:1200}],effectImgData:{positionX:5.001,positionY:2.335,positionXPx:59.067,positionYPx:27.579,effectivePixelsW:279.999,effectivePixelsH:7445.328,effectivePixelsWPx:3307.075,effectivePixelsHPx:87936},printLayerData:[{position:[0,0,3306.867,1200],maskList:[{maskId:1,subPrintModel:1}]}]};
const before=JSON.stringify(original),images=[{width:3306,height:1200},{width:3306,height:1200}];
assert.equal(api.normalize(original,images,{roll:true,mode:'native'}),original);assert.equal(api.normalize(original,images,{roll:false,mode:'optimized'}),original);
const fixed=api.normalize(original,images,{roll:true,mode:'optimized'});assert.equal(fixed,original);assert.equal(fixed.format_size_h,7450);assert.equal(fixed.effectImgData.effectivePixelsH,7445.328);assert.equal(fixed.effectImgData.effectivePixelsHPx,87936);assert.equal(fixed.effectImgData.positionY,2.335);assert.equal(JSON.stringify(original),before,'device job geometry and layer metadata must stay unchanged');
const first=api.normalize({...original,rollSegmentIndex:0},[{width:3306,height:336}],{roll:true,mode:'optimized'});assert.equal(first.format_size_h,7450);assert.equal(first.effectImgData.effectivePixelsHPx,87936);
assert.throws(()=>api.normalize(original,[{width:3306,height:87936}],{roll:true,mode:'optimized'}));assert.throws(()=>api.normalize({...original,rollSegmentIndex:3},images,{roll:true,mode:'optimized'}));assert.throws(()=>api.imageSize(new Uint8Array(24)));
assert.throws(()=>api.normalize({...original,format_size_w:7450},images,{roll:true,mode:'optimized'}),/横向尺寸/);
const sizes=[{widthPx:3425,heightPx:336},...Array.from({length:73},()=>({widthPx:3425,heightPx:1200}))];for(let index=0;index<sizes.length;index++){const input={...original,rollSegmentIndex:index,rollSegmentSizes:sizes};const packet=api.normalize(input,[{width:3306,height:sizes[index].heightPx}],{roll:true,mode:'optimized'});assert.equal(packet,input);assert.equal(packet.format_size_h,7450);assert.equal(packet.effectImgData.effectivePixelsHPx,87936);}
console.log('PASS 74 non-square long-roll packets: whole-job geometry retained unchanged, pixel mismatches rejected');
const tall={width:1924,height:51160};
for(const offset of [0,25000,50000]){
 const scale=3306/1924,ctx={canvas:{width:3306,height:1200},getTransform:()=>({a:scale,b:0,c:0,d:scale,e:0,f:-offset*scale})};
 const args=api.boundedArgs(ctx,[tall,0,0,1924,51160,0,0,1924,51160]);
 assert.ok(args[4]<710,'only the visible source rows should be submitted');
 assert.ok(Math.abs(args[2]-offset)<4,'crop follows the long-image offset');
 assert.ok(Math.abs(args[6]*scale-offset*scale)<8);
}
const wide={width:51160,height:1924},wideCtx={canvas:{width:1200,height:3306},getTransform:()=>({a:1.7,b:0,c:0,d:1.7,e:-50000*1.7,f:0})};
assert.ok(api.boundedArgs(wideCtx,[wide,0,0,51160,1924,0,0,51160,1924])[3]<720,'wide images use the same bounded drawing');
console.log('PASS long-image draw clipping: first/middle/last source offsets and unequal wide axes');
const captured=[],originalDraw=function(...args){captured.push(args);};
const renderCtx={canvas:{width:3306,height:1200},getTransform:()=>({a:3306/1924,b:0,c:0,d:3306/1924,e:0,f:-50000*3306/1924}),drawImage:originalDraw};
const imageObject={type:'image',width:1924,height:51160,_renderFill(ctx){ctx.drawImage(tall,0,0,1924,51160,0,0,1924,51160);}};
context.window.__EPC_PRINT_PIPELINE={mode:'optimized'};
api.prepareCanvas({getObjects:()=>[imageObject]});imageObject._renderFill(renderCtx);
assert.ok(captured[0][4]<710);assert.equal(renderCtx.drawImage,originalDraw);assert.equal(imageObject.height,51160);
context.window.__EPC_PRINT_PIPELINE.mode='native';imageObject._renderFill(renderCtx);assert.equal(captured[1][4],51160,'ordinary printing must retain original drawing');
console.log('PASS cloned-image fill clips optimized output, restores context, preserves source dimensions and native path');
const retryCuts=[{bgHeightCutTop:0,bgCutHeight:20},{bgHeightCutTop:20,bgCutHeight:5.6}],retrySizes=[{widthPx:3425,heightPx:1200},{widthPx:3425,heightPx:336}],retryBefore=JSON.stringify([retryCuts,retrySizes]);
const attempt1=api.order(retryCuts,retrySizes),attempt2=api.order(retryCuts,retrySizes),alreadyReversed=api.order(attempt1.cuts,attempt1.sizes);
assert.deepEqual(attempt1,attempt2);assert.deepEqual(attempt1,alreadyReversed);assert.equal(attempt1.cuts[0].bgHeightCutTop,20);assert.equal(attempt1.sizes[0].heightPx,336);assert.equal(JSON.stringify([retryCuts,retrySizes]),retryBefore);
console.log('PASS actual upload retry ordering: deterministic paired segments, no source-array mutation');
