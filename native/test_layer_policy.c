#include <stdio.h>
#include "ink_filter.h"
#include "layer_policy.h"
#define CHECK(x) do{if(!(x)){fprintf(stderr,"FAIL line %d\n",__LINE__);return 1;}}while(0)
int main(void){
 const uint8_t packed[]={ 'P','H','L','1',0,0,0,5,0,0,0,2,0,0,0,1,0x12,0x48,0xf1,0x24,0x80};
 PHPolicy p={0};CHECK(ph_policy_decode(&p,packed,sizeof packed));const uint8_t expected[]={1,2,4,8,15,1,2,4,8,0};CHECK(!memcmp(p.bits,expected,10));
 uint32_t h[12]={0x5555,300,300,2,2,5,0,6,2};uint8_t data[24];memset(data,255,sizeof data);PHInkAudit a={0};CHECK(ph_filter_policy(data,24,2,0,h,&p,&a));
 for(int y=0;y<2;y++)for(int c=0;c<6;c++)for(int x=0;x<5;x++){unsigned actual=(data[(y*6+c)*2+x/4]>>((3-x%4)*2))&3;CHECK(actual==(c>=4||expected[y*5+x]&((const unsigned[]){8,1,2,4})[c]?3:0));}
 /* W/G byte exact, selected dots unchanged; non-printing color padding is zero. */
 for(int y=0;y<2;y++)for(int c=4;c<6;c++)CHECK(data[(y*6+c)*2]==255&&data[(y*6+c)*2+1]==255);
 for(int y=0;y<2;y++)for(int c=0;c<4;c++)CHECK((data[(y*6+c)*2+1]&0x3f)==0);
 uint32_t anisotropic[12]={0x5555,600,300,3,2,10,0,6,2};uint8_t stretched[36];memset(stretched,255,36);CHECK(ph_filter_policy(stretched,36,2,0,anisotropic,&p,0));for(int y=0;y<2;y++)for(int c=0;c<6;c++)for(int x=0;x<10;x++){int got=(stretched[(y*6+c)*3+x/4]>>((3-x%4)*2))&3;CHECK(got==(c>=4||expected[y*5+x/2]&((const unsigned[]){8,1,2,4})[c]?3:0));}
 uint8_t bad[sizeof packed];memcpy(bad,packed,sizeof bad);bad[15]=2;CHECK(!ph_policy_decode(&p,bad,sizeof bad));CHECK(p.width==5);CHECK(!ph_filter_policy(data,24,2,1,h,&p,0));
 const uint8_t run[]={'P','H','L','1',0,0,0,5,0,0,0,2,0,0,0,2,0,0,0,5,1,0,0,0,5,2};CHECK(ph_policy_decode(&p,run,sizeof run));CHECK(p.bits[0]==1&&p.bits[9]==2);ph_policy_free(&p);
 puts("PASS per-pixel C/M/Y/K, anisotropic DPI, selected dots and W/G exact, color padding zero; packed/RLE; malformed/bounds rejected");return 0;
}
