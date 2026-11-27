const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../raster-src/native-relief-preview.js'),'utf8');
const proxies=[];
const window={},context={window,ArrayBuffer,Uint8Array,Float32Array,performance:{getEntriesByType:()=>[]},document:{createElement:()=>{const c={width:0,height:0,getContext:()=>({drawImage(){}}),remove(){this.removed=true}};proxies.push(c);return c}}};
vm.runInNewContext(source,context);const p=window.EPCReliefPreview;
const data=new Uint8Array(12*120*4);for(let y=0;y<120;y++)for(let x=0;x<12;x++){let i=(y*12+x)*4;data[i]=x;data[i+1]=y;data[i+2]=99;data[i+3]=255;}
const before=Buffer.from(data),image={data,width:12,height:120},result=p.fit(image,60);
assert.equal(result.width,6);assert.equal(result.height,60);assert.equal(result.data.length,6*60*4);assert.equal(result.data[0],1);assert.equal(result.data[1],1);assert.equal(result.data.at(-3),119);assert.equal(result.data.at(-1),255);
assert.deepEqual(Buffer.from(data),before,'printer/source pixels must remain intact');assert.equal(image.width,12);assert.notEqual(result.data,data);
assert.equal(p.fit(result,60),result,'small native textures retain identity');
const floating={data:new Float32Array(2*200).fill(.45),width:2,height:200};assert(p.fit(floating,100).data instanceof Float32Array);assert(Math.abs(p.fit(floating,100).data[0]-.45)<1e-6);
assert.equal(p.fit(image,0),image);assert.equal(p.fit({...image,depth:2},60).depth,2);
const scene={widthMM:300,quality:3,getTextureGeometry(input,options){const r=(options.sizeWidth||this.widthMM)/this.widthMM,m=r*(r<.8?1:this.quality)*Math.max(1,10/(input.width*r));return {width:input.width*m,height:input.height*m,aspect:input.width/input.height}}};
p.installScene(scene);
for(const width of [100,300,678]){const full={width:1924,height:51160},r=scene.getTextureGeometry(full,{sizeWidth:width});assert(Math.max(r.width,r.height)<=2049);assert(r.width*r.height<=2048*2048+1);assert(Math.abs(r.aspect/(1924/51160)-1)<.02);assert.equal(full.height,51160);assert(proxies.at(-1).removed);}
const method=scene.getTextureGeometry;p.installScene(scene);assert.equal(scene.getTextureGeometry,method,'no stacked preview wrappers');
const small={width:12,height:24};assert.equal(scene.getTextureGeometry(small,{sizeWidth:300}).height,72,'ordinary preview quality is preserved');
(async()=>{await assert.rejects(()=>p.install(),/尚未加载/);assert.equal(p.installed,false);console.log('PASS bounded GPU preview preserves full printer raster and rejects unavailable module');})().catch(e=>{console.error(e);process.exitCode=1;});
