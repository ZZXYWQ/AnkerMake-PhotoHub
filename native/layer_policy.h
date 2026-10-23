#ifndef PHOTOHUB_LAYER_POLICY_H
#define PHOTOHUB_LAYER_POLICY_H
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef struct {uint32_t width,height;uint8_t *bits;} PHPolicy;
static uint32_t ph_be32(const uint8_t*p){return ((uint32_t)p[0]<<24)|((uint32_t)p[1]<<16)|((uint32_t)p[2]<<8)|p[3];}
static uint32_t ph_crc(const uint8_t*p,size_t n){uint32_t c=0xffffffff;while(n--){c^=*p++;for(int i=0;i<8;i++)c=(c>>1)^((c&1)?0xedb88320:0);}return c^0xffffffff;}
static void ph_policy_free(PHPolicy*p){free(p->bits);memset(p,0,sizeof *p);}
static int ph_policy_decode(PHPolicy*out,const uint8_t*p,size_t n){
 if(n<16||memcmp(p,"PHL1",4))return 0;uint32_t w=ph_be32(p+4),h=ph_be32(p+8),mode=ph_be32(p+12);uint64_t count=(uint64_t)w*h;
 if(!w||!h||count>268435456)return 0;PHPolicy t={w,h,malloc((size_t)count)};if(!t.bits)return 0;size_t at=0;
 if(mode==1){if(n!=16+(count+1)/2)goto bad;for(;at<count;at++)t.bits[at]=(p[16+at/2]>>((1-(at&1))*4))&15;}
 else if(mode==2){for(size_t i=16;i<n;i+=5){if(n-i<5)goto bad;uint32_t run=ph_be32(p+i);uint8_t mask=p[i+4];if(!run||mask>15||run>count-at)goto bad;memset(t.bits+at,mask,run);at+=run;}if(at!=count)goto bad;}
 else goto bad;ph_policy_free(out);*out=t;return 1;
 bad:ph_policy_free(&t);return 0;
}
/* All six PRN planes retain their original spacing. Each two-bit dot is cleared
   only when the print-space policy excludes that channel. No RGB recoloring. */
static int ph_filter_policy(uint8_t*data,size_t length,uint32_t rows,uint32_t startY,const uint32_t*h,const PHPolicy*p,PHInkAudit*a){
 if(!p||!p->bits||!ph_prn_header(h,48+(uint64_t)h[3]*h[4]*6)||!rows||startY>=h[4]||rows>h[4]-startY||length!=(uint64_t)rows*h[3]*6)return 0;
 if(!h[1]||!h[2]||h[1]>12000||h[2]>12000)return 0;
 /* The printer can use different X/Y DPI; compare physical aspect, not dots. */
 double aspect=(double)p->width*h[4]*h[1]-(double)p->height*h[5]*h[2];if(aspect<0)aspect=-aspect;
 if(aspect>(double)p->width*h[1]+(double)p->height*h[2]+(double)h[5]*h[2]+(double)h[4]*h[1])return 0;
 for(uint32_t r=0;r<rows;r++)for(uint32_t c=0;c<6;c++){uint8_t*d=data+((size_t)r*6+c)*h[3];for(uint32_t b=0;b<h[3];b++){
  if(a)a->before[c]+=d[b]!=0;if(c<4){uint8_t keep=0;for(uint32_t k=0;k<4;k++){uint32_t x=b*4+k;if(x>=h[5])continue;uint32_t sx=(uint64_t)x*p->width/h[5],sy=(uint64_t)(startY+r)*p->height/h[4];if(p->bits[(size_t)sy*p->width+sx]&ph_plane_mask[c])keep|=3u<<((3-k)*2);}d[b]&=keep;}if(a)a->after[c]+=d[b]!=0;
 }}if(a)a->bytes+=length;return 1;
}
#endif
