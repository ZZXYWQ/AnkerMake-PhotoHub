const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {File}=require('node:buffer');
const listeners={},routed=[],replays=[];
const window={addEventListener:(type,fn)=>listeners[type]=fn,__EPC_IMPORT_LARGE_FILE:async f=>{routed.push(f);return true;}};
class Transfer{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}}
class DropEvent extends Event{constructor(type,options){super(type,options);this.dataTransfer=options.dataTransfer;this.clientX=options.clientX;}}
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../payload/large-image-import.js'),'utf8'),{window,WeakSet,WeakMap,Uint8Array,DataView,DataTransfer:Transfer,DragEvent:DropEvent,Event});
const filter=window.__EPC_IMPORT_FILTER;
function png(w,h){const b=Buffer.alloc(32);b.writeUInt32BE(0x89504e47,0);b.writeUInt32BE(0x0d0a1a0a,4);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return new File([b],'fixture.png',{type:'image/png'});}
function jpeg(w,h){const b=Buffer.alloc(16);b[0]=255;b[1]=216;b[2]=255;b[3]=192;b.writeUInt16BE(12,4);b[6]=8;b.writeUInt16BE(h,7);b.writeUInt16BE(w,9);return new File([b],'fixture.jpg',{type:'image/jpeg'});}
function webp(w,h){const b=Buffer.alloc(32);b.write('RIFF',0);b.write('WEBP',8);b.write('VP8X',12);b.writeUIntLE(w-1,24,3);b.writeUIntLE(h-1,27,3);return new File([b],'fixture.webp',{type:'image/webp'});}
function event(file,type='change'){const target={type:'file',files:[file],value:'selected',closest:()=>null,dispatchEvent:e=>{replays.push(e);listeners[e.type](e)}};const e={type,target,dataTransfer:{files:[file]},clientX:127,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};return e;}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 for(const make of [png,jpeg,webp]){const size=await filter.dimensions(make(30001,2));assert.equal(size.width,30001);assert.equal(size.height,2);assert(filter.oversized(size));}
 assert(!filter.oversized({width:30000,height:1}));assert(!filter.oversized({width:12800,height:12800}));assert(filter.oversized({width:12801,height:12800}));
 let e=event(png(800,600));listeners.change(e);await tick();assert(e.stopped);assert.equal(replays.length,1);assert.equal(routed.length,0);
 e=event(png(30001,1));listeners.change(e);await tick();assert.equal(routed.length,1);assert.equal(e.target.value,'');assert.equal(replays.length,1);
 e=event(png(800,600),'drop');listeners.drop(e);await tick();assert.equal(replays.length,2);assert.equal(replays[1].dataTransfer.files[0],e.dataTransfer.files[0]);assert.equal(replays[1].clientX,127);
 e=event(new File(['bad'],'bad.png',{type:'image/png'}));listeners.change(e);await tick();assert.equal(replays.length,3);
 e=event(png(30001,1));e.target.files.push(png(800,600));listeners.change(e);assert(!e.stopped);
 window.__EUFY_PHOTOCRAFT_LARGE_IMAGES=false;e=event(png(30001,1));listeners.change(e);assert(!e.stopped);
 console.log('PASS PNG/JPEG/WebP header parsing, exact limits, oversized callback, native normal/drop replay, corruption fallback, multi-file untouched, toggle');
})().catch(e=>{console.error(e);process.exitCode=1});
