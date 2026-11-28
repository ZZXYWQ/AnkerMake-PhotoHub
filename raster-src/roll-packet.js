/* Validate packet pixels and bound drawing; preserve the device job contract. */
(()=>{'use strict';
function imageSize(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('卷材打印图片不是有效 PNG；未生成打印包');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);
 if(!width||!height)throw Error('卷材打印图片尺寸无效');
 return {width,height};
}
function normalize(config,images,{roll=false,mode='native'}={}){
 if(!roll||mode!=='optimized')return config;
 const index=config.rollSegmentIndex,segment=config.rollSegmentSizes?.[index],dpi=config.imgQuality;
 if(!Number.isInteger(index)||index<0||!segment||!Number.isFinite(dpi)||dpi<=0||dpi>6000)throw Error('卷材当前分段尺寸未确认；未生成打印包');
 const {widthPx,heightPx}=segment;
 if(!Number.isInteger(widthPx)||!Number.isInteger(heightPx)||widthPx<=0||heightPx<=0||widthPx>32767||heightPx>32767)throw Error('卷材当前分段像素尺寸无效');
 if(!Number.isFinite(config.format_size_w)||config.format_size_w<=0||Math.abs(config.format_size_w*dpi/25.4-widthPx)>1)throw Error('卷材横向尺寸与分段像素不一致；未交换横纵尺寸');
 if(!images.length||images.some(i=>!i.width||!i.height||i.width>widthPx+1||i.height>heightPx+1))throw Error('卷材图片与分段尺寸不一致；未生成拉伸数据');
 // These are whole-job fields in the device protocol. Keep them byte-for-byte
 // semantically unchanged; a standalone desktop RIP fixture is not evidence
 // that the device expects segment-local heights here.
 return config;
}
// Clip the draw rectangle before handing it to Canvas2D. A 7.45 m image
// becomes an ~88k-pixel destination at print resolution; submitting that
// entire rectangle can repeat edge rows or lose them in the native renderer.
function boundedArgs(ctx,args){
 const [image]=args,iw=image?.naturalWidth||image?.width,ih=image?.naturalHeight||image?.height;
 if(Math.max(iw||0,ih||0)<=30000)return args;
 let sx=0,sy=0,sw=iw,sh=ih,dx,dy,dw,dh;
 if(args.length===9)[,sx,sy,sw,sh,dx,dy,dw,dh]=args;
 else if(args.length===5)[,dx,dy,dw,dh]=args;
 else if(args.length===3){[,dx,dy]=args;dw=iw;dh=ih;}else return args;
 if(![sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite)||sw<=0||sh<=0||dw<=0||dh<=0)return args;
 const t=ctx.getTransform(),det=t.a*t.d-t.b*t.c;if(!Number.isFinite(det)||Math.abs(det)<1e-16)return args;
 const inv=(x,y)=>({x:(t.d*(x-t.e)-t.c*(y-t.f))/det,y:(-t.b*(x-t.e)+t.a*(y-t.f))/det});
 const corners=[inv(-2,-2),inv(ctx.canvas.width+2,-2),inv(-2,ctx.canvas.height+2),inv(ctx.canvas.width+2,ctx.canvas.height+2)];
 const left=Math.max(dx,Math.min(...corners.map(p=>p.x))),right=Math.min(dx+dw,Math.max(...corners.map(p=>p.x))),top=Math.max(dy,Math.min(...corners.map(p=>p.y))),bottom=Math.min(dy+dh,Math.max(...corners.map(p=>p.y)));
 if(right<=left||bottom<=top)return null;
 const x0=Math.max(sx,Math.floor(sx+(left-dx)*sw/dw)-1),y0=Math.max(sy,Math.floor(sy+(top-dy)*sh/dh)-1),x1=Math.min(sx+sw,Math.ceil(sx+(right-dx)*sw/dw)+1),y1=Math.min(sy+sh,Math.ceil(sy+(bottom-dy)*sh/dh)+1);
 return [image,x0,y0,x1-x0,y1-y0,dx+(x0-sx)*dw/sw,dy+(y0-sy)*dh/sh,(x1-x0)*dw/sw,(y1-y0)*dh/sh];
}
async function render(obj,ctx,canvas,draw){
 if(window.__EPC_PRINT_PIPELINE?.mode!=='optimized'||!ctx?.getTransform)return draw();
 const own=Object.getOwnPropertyDescriptor(ctx,'drawImage'),original=ctx.drawImage;
 ctx.drawImage=function(...args){const bounded=boundedArgs(this,args);if(bounded)return original.apply(this,bounded);};
 try{return await draw();}finally{if(own)Object.defineProperty(ctx,'drawImage',own);else delete ctx.drawImage;}
}
const preparedImages=new WeakSet();
function order(cuts,sizes){
 if(!Array.isArray(cuts)||!cuts.length||cuts.some(c=>!Number.isFinite(c.bgHeightCutTop)||!Number.isFinite(c.bgCutHeight)||c.bgCutHeight<=0))throw Error('卷材分段列表无效');
 if(sizes&&(!Array.isArray(sizes)||sizes.length!==cuts.length))throw Error('卷材分段与像素尺寸数量不一致');
 const pairs=cuts.map((cut,i)=>({cut:{...cut},size:sizes?{...sizes[i]}:null})).sort((a,b)=>b.cut.bgHeightCutTop-a.cut.bgHeightCutTop);
 return {cuts:pairs.map(p=>p.cut),sizes:sizes?pairs.map(p=>p.size):undefined};
}
function prepareCanvas(canvas){
 const visit=obj=>{
  if(obj?.type==='image'&&Math.max(obj.pixelWidth||obj.width||0,obj.pixelHeight||obj.height||0)>30000&&!preparedImages.has(obj)&&typeof obj._renderFill==='function'){
   preparedImages.add(obj);const fill=obj._renderFill;
   obj._renderFill=function(ctx){
    if(window.__EPC_PRINT_PIPELINE?.mode!=='optimized')return fill.call(this,ctx);
    const own=Object.getOwnPropertyDescriptor(ctx,'drawImage'),original=ctx.drawImage;
    ctx.drawImage=function(...args){const bounded=boundedArgs(this,args);if(bounded)return original.apply(this,bounded);};
    try{return fill.call(this,ctx);}finally{if(own)Object.defineProperty(ctx,'drawImage',own);else delete ctx.drawImage;}
   };
  }
  for(const child of obj?._objects||[])visit(child);
 };
 canvas.getObjects().forEach(visit);return canvas;
}
window.EPCRollPacket={imageSize,normalize,boundedArgs,render,prepareCanvas,order};
})();
