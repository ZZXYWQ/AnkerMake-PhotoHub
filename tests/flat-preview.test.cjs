const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const window={},context={window,document:{},WeakMap,WeakSet,Promise,Math,Number,JSON,Error,structuredClone};
vm.runInNewContext(fs.readFileSync('raster-src/flat-preview.js','utf8'),context);const api=window.EPCFlatPreview;
for(const [w,h]of[[1024,26306],[26306,1024],[810,32700]]){
 const tiles=api.plan(w,h);let area=0;
 for(const t of tiles){assert(t.sw<=2048&&t.sh<=2048);assert(t.x>=t.sx&&t.y>=t.sy);assert(t.x+t.width<=t.sx+t.sw);assert(t.y+t.height<=t.sy+t.sh);area+=t.width*t.height;}
 assert.equal(area,w*h);assert.equal(tiles[0].x,0);assert.equal(tiles[0].y,0);
 const centers=tiles.map(t=>api.placement(t,10*h/w));for(let i=0;i<tiles.length;i++){assert(Math.abs(centers[i].width/centers[i].height-tiles[i].width/tiles[i].height)<1e-9);}
 if(w===1024){for(let i=1;i<tiles.length;i++){const a=tiles[i-1],b=tiles[i];assert.equal(a.y+a.height,b.y);assert(a.sy+a.sh>b.sy,'sampling overlap prevents a transparent seam');}}
}
const tile=api.plan(1024,26306)[2],normal=api.placement(tile,256),rotated=api.placement(tile,256,Math.PI/2,2);
assert(Math.abs(rotated.x+normal.y*2)<1e-9);assert(Math.abs(rotated.y-normal.x)<1e-9);
assert.throws(()=>api.plan(10000,10000));
class Source{constructor(data){this.data=data;}}
const vector=()=>({set(x,y){this.x=x;this.y=y;}}),base={source:new Source({thumbnail:true}),clone(){return {source:this.source,repeat:vector(),offset:vector()}}};
const a={...tile,image:{tile:1}},z={...tile,image:{tile:2}},ta=api.textureFor(base,a),tz=api.textureFor(base,z);
assert.notEqual(ta.source,base.source);assert.notEqual(ta.source,tz.source);assert.equal(ta.source.data,a.image);assert.equal(tz.source.data,z.image);
base.source.data={thumbnailFinishedLater:true};assert.equal(ta.source.data,a.image,'late thumbnail decode must not replace tile pixels');
const canvas={getObjects:()=>[{id:'long',type:'image',width:51160,height:1924,textureType:'',thickness:0}]},ed={canvas,getJson:()=>({objects:[]}),preview1(...args){return args}},host={editor:()=>ed,project:()=>'project:0'};
assert(api.eligible(host));const b=api.bind(host),method=ed.preview1;api.bind(host);assert.equal(ed.preview1,method);
window.__PH_PREVIEW_SESSION_ACTIVE=false;ed.preview1({},null,300);assert.equal(b.args,null,'ordinary exports are not captured');
window.__PH_PREVIEW_SESSION_ACTIVE=true;ed.preview1({},null,300,null,true);assert.equal(b.args,null,'printer thumbnail calls are not captured');
const project={project_info:{project_id:'project'}};ed.preview1(project,null,14);assert.equal(b.args[0],project);
canvas.getObjects=()=>[{type:'image',width:51160,height:1924,textureType:'pattern',thickness:.3}];assert(!api.eligible(host),'relief craft keeps its own preview');
window.EPCFullResolution={enabled:false};canvas.getObjects=()=>[{type:'image',width:51160,height:1924}];assert(!api.eligible(host));
const calls=[],proto={create(d){calls.push(d)},_createBasePlane(){},removeObject(){}};api.install(proto);const create=proto.create;api.install(proto);assert.equal(proto.create,create);
proto.sessionId='preview-panel';const data={grayData:[]};proto.create(data);assert.equal(calls[0],data,'other sessions retain their original data');
console.log('PASS flat preview: bounded padded tiles, both axes, rotated geometry, print/relief isolation and idempotent binding');
