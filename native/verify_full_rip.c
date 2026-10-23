#include <windows.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "ink_filter.h"
#include "layer_policy.h"
#include "policy_png.h"
#define CK(x) do{if(!(x)){fprintf(stderr,"FAIL line %d\n",__LINE__);return 2;}}while(0)
int main(int argc,char**argv){CK(argc==2);WCHAR png[32768];char file[32768];snprintf(file,sizeof file,"%s/rotated-color.png",argv[1]);MultiByteToWideChar(CP_UTF8,0,file,-1,png,32768);PHPolicy p={0};CK(ph_load_policy_png(png,&p)==1);uint64_t histogram[16]={0};for(uint64_t i=0;i<(uint64_t)p.width*p.height;i++)histogram[p.bits[i]]++;
uint64_t excluded[4]={0},bad[4]={0},retained[4]={0},changed[4]={0},nonzero[6]={0},whiteChanged=0,paddingBad=0;uint64_t total=0;
/* Independent native physical plane mapping, from actual RIP log: KCMYW1W2. */
const unsigned nativeBits[6]={8,1,2,4,0,0};
for(int i=0;i<4;i++){snprintf(file,sizeof file,"%s/final-%03d.prn",argv[1],i);FILE*f=fopen(file,"rb");CK(f);snprintf(file,sizeof file,"%s/results/%04d.prn",argv[1],i);FILE*b=fopen(file,"rb");CK(b);uint32_t h[12],bh[12];CK(fread(h,1,48,f)==48&&fread(bh,1,48,b)==48&&!memcmp(h,bh,48));CK(h[0]==0x5555&&h[7]==6&&h[8]==2);size_t row=h[3]*6;uint8_t*a=malloc(row),*o=malloc(row);CK(a&&o);printf("PRN %d: %ux%u at %ux%u DPI\n",i,h[5],h[4],h[1],h[2]);
for(uint32_t y=0;y<h[4];y++){CK(fread(a,1,row,f)==row&&fread(o,1,row,b)==row);uint32_t sy=(uint64_t)y*p.height/h[4];for(unsigned c=0;c<6;c++){for(uint32_t x=0;x<h[5];x++){unsigned shift=6-(x%4)*2,got=(a[c*h[3]+x/4]>>shift)&3,orig=(o[c*h[3]+x/4]>>shift)&3;nonzero[c]+=got!=0;if(c>=4){whiteChanged+=got!=orig;continue;}uint32_t sx=(uint64_t)x*p.width/h[5];if(p.bits[(size_t)sy*p.width+sx]&nativeBits[c]){retained[c]++;changed[c]+=got!=orig;}else{excluded[c]++;bad[c]+=got!=0;}}if(c<4)for(uint32_t x=h[5];x<h[3]*4;x++)paddingBad+=((a[c*h[3]+x/4]>>(6-(x%4)*2))&3)!=0;}total+=h[5];}free(a);free(o);CK(fgetc(f)==EOF&&fgetc(b)==EOF);fclose(f);fclose(b);}
snprintf(file,sizeof file,"%s/final-verification.json",argv[1]);FILE*r=fopen(file,"wb");CK(r);uint64_t failures=whiteChanged+paddingBad;for(int c=0;c<4;c++)if(!nonzero[c]||!excluded[c]||!retained[c])failures++;for(int c=0;c<4;c++)failures+=bad[c]+changed[c];fprintf(r,"{\"pass\":%s,\"scope\":\"current PSD -> original roll tar -> original local native RIP -> final 4 PRN files\",\"physicalPrintDispatched\":false,\"nativePlaneOrder\":\"KCMYW1W2\",\"sourcePolicy\":[%u,%u],\"sourceMaskHistogram\":[",failures?"false":"true",p.width,p.height);for(int i=0;i<16;i++)fprintf(r,"%s%llu",i?",":"",histogram[i]);fprintf(r,"],\"printPixels\":%llu,\"planes\":[",total);for(int c=0;c<6;c++){fprintf(r,"%s{\"plane\":%d,\"nonzeroDots\":%llu",c?",":"",c,nonzero[c]);if(c<4)fprintf(r,",\"excludedChecked\":%llu,\"excludedNonzero\":%llu,\"selectedChecked\":%llu,\"selectedChanged\":%llu",excluded[c],bad[c],retained[c],changed[c]);fprintf(r,"}");}fprintf(r,"],\"whiteGlossChanged\":%llu,\"colorPaddingNonzero\":%llu,\"failures\":%llu}\n",whiteChanged,paddingBad,failures);fclose(r);printf("VERIFY failures=%llu pixels=%llu\n",failures,total);return failures?3:0;
}
