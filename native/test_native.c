#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ink_filter.h"
#include "layer_policy.h"
#include "policy_png.h"
#define CHECK(c) do{if(!(c)){fprintf(stderr,"FAIL line %d: %s (win=%lu)\n",__LINE__,#c,GetLastError());ExitProcess(2);}}while(0)
typedef struct {uint32_t magic,version,pid;volatile LONG ready,fault,requested,effective,busy,sequence,acknowledged,command,result;volatile LONG64 rows,files,bytes,before[6],after[6];} State;
static HMODULE dll;static uint8_t capture[2000000];static size_t used;static uint32_t bpl=5,colors=6;static int headCalls,blockCalls;
static void *sym(const char *name){void *p=GetProcAddress(dll,name);if(!p){fprintf(stderr,"missing %s\n",name);ExitProcess(3);}return p;}
static int headCallback(void *f,uint8_t *item){headCalls++;CHECK(*(uint32_t*)(item+0x50)==0x5555);bpl=*(uint32_t*)(item+0x5c);colors=*(uint32_t*)(item+0x6c);return 1;}
static int blockCallback(void *f,uint8_t *item){blockCalls++;uint32_t rows=*(uint32_t*)(item+0x64);size_t n=(size_t)bpl*colors*rows;uint8_t *p=*(uint8_t**)(item+0x58);CHECK(used+n<=sizeof capture);if(p)memcpy(capture+used,p,n);else memset(capture+used,0,n);used+=n;return 0;}
static int unused(void *p){return 0;}
static char previousFile[4096];static int fileCalls;
static uint8_t fileCallback(void *f,uint8_t *item){fileCalls++;uint8_t *s=item+0x48;const char *p=*(size_t*)(s+24)>15?*(char**)s:(char*)s;CHECK(strlen(p)<sizeof previousFile);strcpy(previousFile,p);FILE *in=fopen(p,"rb");CHECK(in);CHECK(fseek(in,48,SEEK_SET)==0);used=fread(capture,1,sizeof capture,in);fclose(in);return 1;}
static void makeString(uint8_t s[32],const char *p){memset(s,0,32);*(size_t*)(s+24)=15;void*(*assign)(void*,const char*,size_t)=sym("?assign@?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@QEAAAEAV12@QEBD_K@Z");assign(s,p,strlen(p));}
static void streamInit(uint8_t *stream,uint8_t *stop){memset(stream,0,0x140);*(void**)(stream+0x10)=stop;*(uint32_t*)(stream+0x70)=1;
 static void *hv[6],*bv[6],*ho[2],*bo[2];for(int i=0;i<6;i++)hv[i]=bv[i]=unused;hv[2]=headCallback;bv[2]=blockCallback;ho[0]=hv;bo[0]=bv;*(void**)(stream+0xb0)=ho;*(void**)(stream+0xf0)=bo;
}
static State *connectState(void){WCHAR name[80];swprintf(name,80,L"Local\\PhotoHubInk-%lu",GetCurrentProcessId());for(int i=0;i<200;i++){HANDLE m=OpenFileMappingW(FILE_MAP_ALL_ACCESS,0,name);if(m){State*s=MapViewOfFile(m,FILE_MAP_ALL_ACCESS,0,0,sizeof(State));if(s->fault){fprintf(stderr,"init fault %ld\n",s->fault);ExitProcess(4);}if(s->ready)return s;}Sleep(30);}CHECK(0);return 0;}
static void setMask(State*s,int mask){s->command=mask;LONG seq=InterlockedIncrement(&s->sequence);for(int i=0;i<100&&s->acknowledged!=seq;i++)Sleep(30);CHECK(s->acknowledged==seq&&s->result==0&&s->effective==mask);}
int main(int argc,char **argv){CHECK(argc==3);WCHAR host[32768],hook[32768];MultiByteToWideChar(CP_UTF8,0,argv[1],-1,host,32768);MultiByteToWideChar(CP_UTF8,0,argv[2],-1,hook,32768);CHECK(SetDllDirectoryW(host));WCHAR full[32768];swprintf(full,32768,L"%ls\\ColorEngineAPI.dll",host);dll=LoadLibraryW(full);CHECK(dll);
 void*(*ctor)(void*)=sym("??0PrnFileHandler@AnkerMake@@QEAA@XZ");void(*dtor)(void*)=sym("??1PrnFileHandler@AnkerMake@@QEAA@XZ");
 int(*create)(void*,unsigned,unsigned,unsigned,unsigned,unsigned)=sym("?createEmpty@PrnFileHandler@AnkerMake@@QEAA_NIIIII@Z");
 int(*set)(void*,int,int,int,uint8_t)=sym("?setDropValue@PrnFileHandler@AnkerMake@@QEAA_NHHHE@Z");
 uint8_t(*get)(void*,int,int,int)=sym("?getDropValue@PrnFileHandler@AnkerMake@@QEBAEHHH@Z");
 int(*save)(void*,void*)=sym("?saveToFile@PrnFileHandler@AnkerMake@@QEAA_NAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@Z");
 void*(*load)(void*,void*)=sym("??0PrnFileHandler@AnkerMake@@QEAA@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@Z");
 uint8_t prn[0x100]={0},loaded[0x100]={0},str[32];ctor(prn);CHECK(create(prn,19,7,300,300,6));
 for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<19;x++)CHECK(set(prn,x,y,c,(x+y*3+c)%4));
 const char *file="tests/native-six-channel.prn";makeString(str,file);CHECK(save(prn,str));load(loaded,str);for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<19;x++)CHECK(get(loaded,x,y,c)==(x+y*3+c)%4);dtor(loaded);dtor(prn);
 FILE *f=fopen(file,"rb");CHECK(f);uint8_t raw[1000];size_t size=fread(raw,1,sizeof raw,f);fclose(f);CHECK(size==48+7*6*5);CHECK(ph_prn_header((uint32_t*)raw,size));
 CHECK(LoadLibraryW(hook));State*s=connectState();int(*process)(void*,void*)=sym("?process@SendMemoryStream@AnkerMake@@UEAAHAEBV?$shared_ptr@UPrintItem@AnkerMake@@@std@@@Z");
 int(*layer)(void*,void*)=sym("?send_print_layer_item@SendMemoryStream@AnkerMake@@AEAAHUPrintLayerItem@2@@Z");
 uint8_t(*fileResult)(void*,void*)=sym("??R?$_Func_class@_NUPrintLayerItem@AnkerMake@@@std@@QEBA_NUPrintLayerItem@AnkerMake@@@Z");strcpy(previousFile,file);
 void *(*nativeMalloc)(size_t)=(void*)GetProcAddress(GetModuleHandleW(L"ucrtbase.dll"),"malloc");CHECK(nativeMalloc);
 puts("native PRN codec roundtrip passed (19x7, 6 channels, 2-bit)");
 FILE *auditFile=fopen("tests/native-ink-audit.jsonl","wb");CHECK(auditFile);
 for(int mask=0;mask<16;mask++){
  setMask(s,mask);uint8_t stream[0x140],stop=0,head[0x120]={0};streamInit(stream,&stop);used=0;
  *(void**)head=sym("??_7PrintHeadItem@AnkerMake@@6B@");*(uint32_t*)(head+0xc)=6;*(uint32_t*)(head+0x48)=1;*(uint32_t*)(head+0x4c)=1;memcpy(head+0x50,raw,48);*(size_t*)(head+0x98)=15;
  void *shared[2]={head,0};CHECK(process(stream,shared)==0);
  for(int y=0;y<7;y++){uint8_t row[0x70]={0};*(void**)row=sym("??_7PrintRowItem@AnkerMake@@6B@");*(uint32_t*)(row+0xc)=6;*(uint32_t*)(row+0x4c)=y;*(uint32_t*)(row+0x50)=y+1;*(void**)(row+0x58)=nativeMalloc(30);memcpy(*(void**)(row+0x58),raw+48+y*30,30);*(uint32_t*)(row+0x60)=30;*(uint32_t*)(row+0x64)=1;row[0x68]=y==6;shared[0]=row;CHECK(process(stream,shared)==0);}
  CHECK(used==210);for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<5;x++)CHECK(capture[(y*6+c)*5+x]==(c<4&&!(mask&((const unsigned[]){8,1,2,4})[c])?0:raw[48+(y*6+c)*5+x]));
  streamInit(stream,&stop);used=0;shared[0]=head;CHECK(process(stream,shared)==0);
  uint8_t block[0x70]={0};*(void**)block=sym("??_7PrintBlockItem@AnkerMake@@6B@");*(uint32_t*)(block+0xc)=6;*(uint32_t*)(block+0x50)=7;*(void**)(block+0x58)=nativeMalloc(210);memcpy(*(void**)(block+0x58),raw+48,210);*(uint32_t*)(block+0x60)=210;*(uint32_t*)(block+0x64)=7;block[0x68]=1;shared[0]=block;CHECK(process(stream,shared)==0);CHECK(used==210);for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<5;x++)CHECK(capture[(y*6+c)*5+x]==(c<4&&!(mask&((const unsigned[]){8,1,2,4})[c])?0:raw[48+(y*6+c)*5+x]));
  uint8_t li[0x70]={0};streamInit(stream,&stop);used=0;*(void**)li=sym("??_7PrintLayerItem@AnkerMake@@6B@");*(uint32_t*)(li+0xc)=6;makeString(li+0x48,file);CHECK(layer(stream,li)==0);CHECK(used==210);for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<5;x++)CHECK(capture[(y*6+c)*5+x]==(c<4&&!(mask&((const unsigned[]){8,1,2,4})[c])?0:raw[48+(y*6+c)*5+x]));
  uint8_t fileItem[0x70]={0},function[64]={0};void *fv[6]={unused,unused,fileCallback,unused,unused,unused},*fo[2]={fv,0};*(void**)(function+56)=fo;*(void**)fileItem=sym("??_7PrintLayerItem@AnkerMake@@6B@");*(uint32_t*)(fileItem+0xc)=6;makeString(fileItem+0x48,previousFile);used=0;CHECK(fileResult(function,fileItem)==1&&used==210);for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<5;x++)CHECK(capture[(y*6+c)*5+x]==(c<4&&!(mask&((const unsigned[]){8,1,2,4})[c])?0:raw[48+(y*6+c)*5+x]));
  uint8_t decoded[0x100]={0},decodedPath[32];makeString(decodedPath,previousFile);load(decoded,decodedPath);for(int y=0;y<7;y++)for(int c=0;c<6;c++)for(int x=0;x<19;x++)CHECK(get(decoded,x,y,c)==(c<4&&!(mask&((const unsigned[]){8,1,2,4})[c])?0:(x+y*3+c)%4));dtor(decoded);
  CHECK(s->fault==0);if(mask<15)for(int c=0;c<6;c++){CHECK(s->before[c]>0);CHECK(s->after[c]==(c<4&&!(mask&((const unsigned[]){8,1,2,4})[c])?0:s->before[c]));}
  fprintf(auditFile,"{\"mask\":%d,\"unselectedZero\":true,\"selectedExact\":true,\"whiteGlossExact\":true,\"paths\":[\"row\",\"block\",\"cached-prn\",\"file-callback\"],\"beforeNonzero\":[",mask);for(int c=0;c<6;c++)fprintf(auditFile,"%s%lld",c?",":"",s->before[c]);fprintf(auditFile,"],\"afterNonzero\":[");for(int c=0;c<6;c++)fprintf(auditFile,"%s%lld",c?",":"",s->after[c]);fprintf(auditFile,"]}\n");fflush(auditFile);
  printf("mask %02d: native live rows + blocks + cached/file PRN callbacks passed; unselected zero, selected/W/G exact\n",mask);
 }
 fclose(auditFile);
 s->busy=1;s->command=1;LONG seq=InterlockedIncrement(&s->sequence);for(int i=0;i<100&&s->acknowledged!=seq;i++)Sleep(30);CHECK(s->result==1&&s->requested==15);s->busy=0;
 CHECK(headCalls==48&&blockCalls==336&&fileCalls==16);
 /* Browser-generated print PNG -> native phCm parser -> actual original native
    output callbacks. No print-device or network callbacks are installed. */
 HMODULE testHook=GetModuleHandleW(L"PhotoHubInk-test.dll");CHECK(testHook);int(*testPolicy)(const WCHAR*)=(void*)GetProcAddress(testHook,"PhotoHubTestPolicy");CHECK(testPolicy);
 const WCHAR *policyPng=L"tests/layer-ink-print.png";CHECK(testPolicy(policyPng));PHPolicy policy={0};CHECK(ph_load_policy_png(policyPng,&policy)==1);
 int(*testParam)(void*)=(void*)GetProcAddress(testHook,"PhotoHubTestPolicyParam");CHECK(testParam);uint8_t params[0x640]={0},*mapHead=nativeMalloc(0x90);memset(mapHead,0,0x90);*(void**)mapHead=*(void**)(mapHead+8)=*(void**)(mapHead+16)=mapHead;mapHead[0x18]=mapHead[0x19]=1;*(void**)(params+0x630)=mapHead;
 makeString(params+0x60,"tests/layer-ink-print.png");CHECK(testParam(params)==1);makeString(params+0x60,"tests/layer-ink-print.dds");CHECK(testParam(params)==1);
 FILE*pngFile=_wfopen(policyPng,L"rb");CHECK(pngFile);fseek(pngFile,0,SEEK_END);size_t pngSize=ftell(pngFile);rewind(pngFile);uint8_t*pngData=malloc(pngSize);CHECK(fread(pngData,1,pngSize,pngFile)==pngSize);fclose(pngFile);uint8_t memImage[80]={0},memoryKey[32];makeString(memImage,"PhotoHub-memory-policy.png");makeString(memImage+32,"png");*(void**)(memImage+64)=pngData;*(size_t*)(memImage+72)=pngSize;makeString(memoryKey,"PhotoHub-memory-policy.png");
 void(*setMemory)(void*,void*,void*)=sym("?setMemoryImage@ripParams@RipData@@QEAAXAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AEBUImageDataMem@2@@Z");setMemory(params,memoryKey,memImage);makeString(params+0x60,"PhotoHub-memory-policy.png");CHECK(testParam(params)==1);makeString(params+0x60,"PhotoHub-memory-policy.dds");CHECK(testParam(params)==1);makeString(params+0x60,"unrelated-source.png");CHECK(testParam(params)==0);free(pngData);
 puts("PASS native source binding: exact PNG path, DDS sibling, original memory-image map and missing-source rejection");
 const char*layerFile="tests/native-layer-policy.prn";uint8_t layerPrn[0x100]={0},layerPath[32];ctor(layerPrn);CHECK(create(layerPrn,policy.width,policy.height,300,300,6));for(unsigned y=0;y<policy.height;y++)for(int c=0;c<6;c++)for(unsigned x=0;x<policy.width;x++)CHECK(set(layerPrn,x,y,c,(x+y*3+c)%4));makeString(layerPath,layerFile);CHECK(save(layerPrn,layerPath));dtor(layerPrn);
 FILE *lp=fopen(layerFile,"rb");CHECK(lp);fseek(lp,0,SEEK_END);size_t ls=ftell(lp);rewind(lp);uint8_t*lr=malloc(ls);CHECK(lr&&fread(lr,1,ls,lp)==ls);fclose(lp);uint32_t*lh=(void*)lr;size_t rowBytes=lh[3]*6,total=rowBytes*lh[4];CHECK(total<sizeof capture);uint8_t *expectedRows=malloc(total);memcpy(expectedRows,lr+48,total);CHECK(ph_filter_policy(expectedRows,total,lh[4],0,lh,&policy,0));
 {uint8_t stream[0x140],stop=0,head[0x120]={0};streamInit(stream,&stop);used=0;*(void**)head=sym("??_7PrintHeadItem@AnkerMake@@6B@");*(uint32_t*)(head+0xc)=6;*(uint32_t*)(head+0x48)=1;*(uint32_t*)(head+0x4c)=1;memcpy(head+0x50,lr,48);*(size_t*)(head+0x98)=15;void *shared[2]={head,0};CHECK(process(stream,shared)==0);
 for(unsigned y=0;y<lh[4];y++){uint8_t row[0x70]={0};*(void**)row=sym("??_7PrintRowItem@AnkerMake@@6B@");*(uint32_t*)(row+0xc)=6;*(uint32_t*)(row+0x4c)=y;*(uint32_t*)(row+0x50)=y+1;*(void**)(row+0x58)=nativeMalloc(rowBytes);memcpy(*(void**)(row+0x58),lr+48+y*rowBytes,rowBytes);*(uint32_t*)(row+0x60)=rowBytes;*(uint32_t*)(row+0x64)=1;row[0x68]=y==lh[4]-1;shared[0]=row;CHECK(process(stream,shared)==0);}CHECK(used==total&&!memcmp(capture,expectedRows,total));
 uint8_t li[0x70]={0};streamInit(stream,&stop);used=0;*(void**)li=sym("??_7PrintLayerItem@AnkerMake@@6B@");*(uint32_t*)(li+0xc)=6;makeString(li+0x48,layerFile);CHECK(layer(stream,li)==0);CHECK(used==total&&!memcmp(capture,expectedRows,total));
 uint8_t fi[0x70]={0},function[64]={0};void *fv[6]={unused,unused,fileCallback,unused,unused,unused},*fo[2]={fv,0};*(void**)(function+56)=fo;*(void**)fi=sym("??_7PrintLayerItem@AnkerMake@@6B@");*(uint32_t*)(fi+0xc)=6;makeString(fi+0x48,layerFile);used=0;CHECK(fileResult(function,fi)==1&&used==total&&!memcmp(capture,expectedRows,total));
 for(unsigned y=0;y<lh[4];y++)for(unsigned c=0;c<4;c+=3)for(unsigned x=0;x<lh[3];x++)CHECK(capture[((size_t)y*6+c)*lh[3]+x]==0);
 uint8_t decoded[0x100]={0},dp[32];makeString(dp,previousFile);load(decoded,dp);uint64_t allowed[4]={0},excluded[4]={0};for(unsigned y=0;y<policy.height;y++)for(int c=0;c<6;c++)for(unsigned x=0;x<policy.width;x++){int on=c>=4||(policy.bits[(size_t)y*policy.width+x]&((const unsigned[]){8,1,2,4})[c]);CHECK(get(decoded,x,y,c)==(on?(x+y*3+c)%4:0));if(c<4){if(on)allowed[c]++;else excluded[c]++;}}dtor(decoded);printf("per-layer dots allowed K/C/M/Y=%llu/%llu/%llu/%llu; excluded-zero K/C/M/Y=%llu/%llu/%llu/%llu\n",allowed[0],allowed[1],allowed[2],allowed[3],excluded[0],excluded[1],excluded[2],excluded[3]);
 }
 FILE *layerAudit=fopen("tests/layer-ink-native-results.json","wb");CHECK(layerAudit);fprintf(layerAudit,"{\"pass\":true,\"width\":%u,\"height\":%u,\"format\":\"native 6-plane 2-bit PRN\",\"fixture\":\"browser-generated policy plus native codec synthetic dot pattern\",\"perPixelExcludedZero\":true,\"entireYandKPlanesZero\":true,\"selectedDotsExact\":true,\"whiteGlossExact\":true,\"nativeCallbacks\":[\"row\",\"cached-prn\",\"file-callback\"],\"fileAndMemorySourceBinding\":true,\"physicalPrintDispatched\":false}\n",policy.width,policy.height);fclose(layerAudit);
 free(expectedRows);free(lr);
 ph_policy_free(&policy);s->command=16;LONG unarm=InterlockedIncrement(&s->sequence);for(int i=0;i<100&&s->acknowledged!=unarm;i++)Sleep(30);CHECK(s->result==0);
 puts("PASS browser print PNG per-layer policy -> native rows + cached/file PRN callbacks; spatially unselected dots zero; W/G unchanged");
 setMask(s,1);uint8_t bad[0x70]={0},data[30]={0},stream[0x140],stop=0;streamInit(stream,&stop);*(void**)bad=sym("??_7PrintRowItem@AnkerMake@@6B@");*(uint32_t*)(bad+0xc)=6;*(void**)(bad+0x58)=data;*(uint32_t*)(bad+0x60)=29;void *sharedBad[2]={bad,0};int calls=blockCalls;CHECK(process(stream,sharedBad)==0xd05&&s->fault==102&&blockCalls==calls);
 FILE *check=fopen(file,"rb");CHECK(check);uint8_t unchanged[1000];CHECK(fread(unchanged,1,sizeof unchanged,check)==size);fclose(check);CHECK(!memcmp(raw,unchanged,size));
 printf("PASS native callbacks heads=%d blocks=%d fileCallbacks=%d filteredRows=%lld cachedFiles=%lld; malformed rows rejected; source cache unchanged; different-mask cached copies restored from full source\n",headCalls,blockCalls,fileCalls,s->rows,s->files);return 0;
}
