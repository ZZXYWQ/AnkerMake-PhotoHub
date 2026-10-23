/* Pixel selections operate at source resolution; all lengthy scans yield. */
(() => {
 'use strict';
 const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
 async function flood(data,w,h,x,y,tolerance=24,contiguous=true,valid=()=>true){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||data.length!==w*h*4)throw Error('像素数据无效');
  const n=w*h,start=Math.floor(y)*w+Math.floor(x),mask=new Uint8ClampedArray(n);
  if(x<0||y<0||x>=w||y>=h)return mask;
  const sample=data.slice(start*4,start*4+4),matches=i=>{
   const k=i*4;
   // Invisible RGB values must not split a transparent region.
   if(!sample[3]&&!data[k+3])return true;
   return Math.abs(sample[0]-data[k])<=tolerance&&Math.abs(sample[1]-data[k+1])<=tolerance&&Math.abs(sample[2]-data[k+2])<=tolerance&&Math.abs(sample[3]-data[k+3])<=tolerance;
  };
  const checkpoint=async()=>{await yieldUI();if(!valid())throw Error('编辑已取消或项目已变化');};
  if(!contiguous){for(let i=0;i<n;i++){if(matches(i))mask[i]=255;if(i&&i%65536===0)await checkpoint();}return mask;}
  const seen=new Uint8Array(n),queue=new Uint32Array(n);let read=0,write=1;queue[0]=start;seen[start]=1;
  const push=i=>{if(!seen[i]){seen[i]=1;queue[write++]=i;}};
  while(read<write){const i=queue[read++];if(matches(i)){mask[i]=255;const col=i%w;if(col)push(i-1);if(col<w-1)push(i+1);if(i>=w)push(i-w);if(i<n-w)push(i+w);}if(read%65536===0)await checkpoint();}
  return mask;
 }
 function combine(previous,next,mode){
  if(!previous||mode==='replace')return next;
  for(let i=0;i<next.length;i++)next[i]=mode==='add'?Math.max(previous[i],next[i]):mode==='subtract'?Math.max(0,previous[i]-next[i]):Math.min(previous[i],next[i]);
  return next;
 }
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;if(!c.getContext('2d'))throw Error('无法分配编辑内存');return c;}
 function maskCanvas(mask,w,h,tinted=false){const c=canvas(w,h),ctx=c.getContext('2d'),d=ctx.createImageData(w,h);for(let i=0;i<mask.length;i++){const j=i*4;d.data[j]=tinted?30:255;d.data[j+1]=tinted?150:255;d.data[j+2]=255;d.data[j+3]=tinted?Math.round(mask[i]*.25):mask[i];}ctx.putImageData(d,0,0);return c;}
 function maskFromCanvas(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,m=new Uint8ClampedArray(c.width*c.height);for(let i=0;i<m.length;i++)m[i]=d[i*4+3];return m;}
 async function filter(image,operation,p={},valid=()=>true){
  const d=image.data,w=image.width,h=image.height;
  const b=Number(p.brightness||0),contrast=Number(p.contrast||0),amount=Number(p.amount??1);
  const low=Number(p.black??0),high=Number(p.white??255),gamma=Number(p.gamma??1);
  if(![b,contrast,amount,low,high,gamma].every(Number.isFinite)||Math.abs(b)>1||Math.abs(contrast)>1||amount<0||amount>3||low<0||high>255||low>=high||gamma<.1||gamma>10)throw Error('图像调整参数无效');
  const points=[0,Number(p.q1??64),Number(p.q2??128),Number(p.q3??192),255];
  if(points.some(v=>!Number.isFinite(v)||v<0||v>255))throw Error('曲线输出须为 0–255');
  const lut=Array.from({length:256},(_,v)=>{const seg=Math.min(3,Math.floor(v/64)),xs=[0,64,128,192,255],t=(v-xs[seg])/(xs[seg+1]-xs[seg]);return points[seg]*(1-t)+points[seg+1]*t;});
  if(!['grayscale','invert','brightnessContrast','saturation','levels','curves','sharpen'].includes(operation))throw Error('未知图像调整');
  const src=operation==='sharpen'?new Uint8ClampedArray(d):null,factor=(1+contrast)/(1-contrast+1e-6);
  for(let i=0;i<d.length;i+=4){const lum=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];for(let k=0;k<3;k++){
   const v=d[i+k];
   if(src){const x=(i/4)%w,y=Math.floor(i/4/w);let neighbors=0;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const j=(Math.max(0,Math.min(h-1,y+dy))*w+Math.max(0,Math.min(w-1,x+dx)))*4;neighbors+=src[j+3]?src[j+k]:src[i+k];}d[i+k]=v+amount*(4*v-neighbors);}
   else d[i+k]=operation==='grayscale'?lum:operation==='invert'?255-v:operation==='saturation'?lum+(v-lum)*amount:operation==='levels'?255*Math.pow(Math.max(0,Math.min(1,(v-low)/(high-low))),1/gamma):operation==='curves'?lut[v]:((v/255-.5)*factor+.5+b)*255;
  }if(i&&i%262144===0){await yieldUI();if(!valid())throw Error('编辑已取消或项目已变化');}}
  return image;
 }
 window.EPCRasterOps={flood,combine,canvas,maskCanvas,maskFromCanvas,filter};
})();
