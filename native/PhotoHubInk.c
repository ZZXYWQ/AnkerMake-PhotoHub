/* AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only. Older PhotoHub releases must not be used for layer-local CMYK jobs. */
#define WIN32_LEAN_AND_MEAN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#include <windows.h>
#include <bcrypt.h>
#include <stdint.h>
#include <stdio.h>
#include "vendor/minhook-1.3.4/include/MinHook.h"
#include "ink_filter.h"
#include "layer_policy.h"
#include "policy_png.h"

/* No input, display, network, or printer-device hooks. Only this exact native RIP. */
typedef struct {
 uint32_t magic, version, pid; volatile LONG ready, fault, requested, effective, busy;
 volatile LONG sequence, acknowledged, command, result;
 volatile LONG64 rows, files, bytes, before[6], after[6];
 volatile LONG policyRequired,policyActive;volatile LONG64 policyPixels;
} PHState;
static PHState *state;
static HMODULE selfModule;
static SRWLOCK gate=SRWLOCK_INIT;
static void *rowVT,*blockVT,*headVT;
static int (*realProcess)(void*,void*);
static int (*realLayer)(void*,void*);
static uint8_t (*realFileCallback)(void*,void*);
static void (*realStart)(void*,void*),(*realExecute)(void*,void*);
static uint8_t (*engineRunning)(void*);
static void *(*nativeAssign)(void*,const char*,size_t);
static void (*nativeLayerDestroy)(void*);
static uint8_t (*hasMemoryImage)(void*,void*);
static void *(*getMemoryImage)(void*,void*,void*);
static void (*destroyMemoryImage)(void*),(*destroyString)(void*);
static LONG activeMask=15, queued=0;
static int (*realSingle)(void*,void*,float,float);
static int (*realExecute2D)(void*);
static PHPolicy activePolicy;
static uint32_t activeHeader[12];
static SRWLOCK policyGate=SRWLOCK_INIT;
static SRWLOCK singleGate=SRWLOCK_INIT;
static void fault(LONG code);
static int loadSourcePolicy(void*param,PHPolicy*out){
 uint8_t *source=(uint8_t*)param+0x60,key[32]={0};size_t n=*(size_t*)(source+16),cap=*(size_t*)(source+24);if(!n||n>32760)return 0;const char*p=cap>15?*(char**)source:(char*)source;nativeAssign(key,p,n);int result=0;
 for(int attempt=0;attempt<2;attempt++){
  const char*name=*(size_t*)(key+24)>15?*(char**)key:(char*)key;size_t count=*(size_t*)(key+16);WCHAR path[32768];int z=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,name,(int)count,path,32767);if(!z)break;path[z]=0;
  result=ph_load_policy_png(path,out);if(result)break;
  if(hasMemoryImage(param,key)){uint8_t mem[80]={0};getMemoryImage(param,mem,key);const uint8_t*data=*(uint8_t**)(mem+64);size_t length=*(size_t*)(mem+72);if(data&&length&&length<=1024ULL*1024*1024)result=ph_load_policy_bytes(data,length,out);destroyMemoryImage(mem);if(result)break;}
  /* Native ImageDecompress derives a DDS sibling from the PNG. It changes
     compression, not source pixel coordinates. Never guess across directories. */
  if(attempt||count<4||_stricmp(name+count-4,".dds"))break;char *png=malloc(count+1);if(!png){result=-1;break;}memcpy(png,name,count+1);memcpy(png+count-4,".png",4);nativeAssign(key,png,count);free(png);
 }destroyString(key);return result;
}
static int beginPolicy(void*param){
 PHPolicy found={0};if(loadSourcePolicy(param,&found)!=1){ph_policy_free(&found);fault(111);return 0;}
 AcquireSRWLockExclusive(&policyGate);ph_policy_free(&activePolicy);activePolicy=found;memset(activeHeader,0,sizeof activeHeader);state->policyActive=1;state->policyPixels=(LONG64)found.width*found.height;ReleaseSRWLockExclusive(&policyGate);return 1;
}
static void endPolicy(void){AcquireSRWLockExclusive(&policyGate);state->policyActive=0;ph_policy_free(&activePolicy);ReleaseSRWLockExclusive(&policyGate);}
static int single(void *handler,void *param,float x,float y){
 if(!state->policyRequired)return realSingle(handler,param,x,y);
 AcquireSRWLockExclusive(&singleGate);if(!beginPolicy(param)){ReleaseSRWLockExclusive(&singleGate);return 0xd05;}
 int result=realSingle(handler,param,x,y);endPolicy();ReleaseSRWLockExclusive(&singleGate);return result;
}
/* REA 5.0.4: creative/roll 2D bypasses print_single_layer and passes the
   handler's ripParams at +0x4f0 directly to the RIP service. Keep its exact
   source policy alive through all synchronous PRN completion callbacks. */
static int execute2D(void*handler){
 if(!state->policyRequired)return realExecute2D(handler);
 AcquireSRWLockExclusive(&singleGate);if(!beginPolicy((uint8_t*)handler+0x4f0)){ReleaseSRWLockExclusive(&singleGate);return 0xd05;}
 int result=realExecute2D(handler);endPolicy();ReleaseSRWLockExclusive(&singleGate);return result;
}

static void audit(const PHInkAudit *a) {
 InterlockedAdd64(&state->bytes,(LONG64)a->bytes);
 for(int c=0;c<6;c++) {InterlockedAdd64(&state->before[c],a->before[c]);InterlockedAdd64(&state->after[c],a->after[c]);}
}
static void fault(LONG code) {InterlockedExchange(&state->fault,code);}
static void resetAudit(void){state->rows=state->files=state->bytes=0;for(int c=0;c<6;c++)state->before[c]=state->after[c]=0;}
static uint32_t maskNow(void) {return (uint32_t)InterlockedCompareExchange(&activeMask,0,0);}
static int accessible(void *ptr,size_t size) {
 uintptr_t p=(uintptr_t)ptr,end=p+size;
 if(!p||end<p) return 0;
 while(p<end) {MEMORY_BASIC_INFORMATION m;if(!VirtualQuery((void*)p,&m,sizeof m)||m.State!=MEM_COMMIT||
    (m.Protect&(PAGE_NOACCESS|PAGE_GUARD))||!(m.Protect&(PAGE_READWRITE|PAGE_WRITECOPY|PAGE_EXECUTE_READWRITE|PAGE_EXECUTE_WRITECOPY))) return 0;
   uintptr_t next=(uintptr_t)m.BaseAddress+m.RegionSize;if(next<=p)return 0;p=next;}
 return 1;
}
static int process(void *stream,void *shared) {
 uint32_t mask=maskNow();
 if(mask!=15||state->policyRequired) {
  uint8_t *item=*(uint8_t**)shared;void *vt=*(void**)item;
  if(vt==headVT) {
   /* Native header is at +0x50; original sender requires six 2-bit planes. */
   uint32_t *h=(uint32_t*)(item+0x50);
   if(h[7]!=6||h[8]!=2||!h[3]){fault(101);return 0xd05;}
   if(state->policyRequired){AcquireSRWLockExclusive(&policyGate);memcpy(activeHeader,h,48);int valid=state->policyActive;ReleaseSRWLockExclusive(&policyGate);if(!valid){fault(112);return 0xd05;}}
  } else if(vt==rowVT || vt==blockVT) {
   uint8_t *data=*(uint8_t**)(item+0x58);uint32_t len=*(uint32_t*)(item+0x60);
   uint32_t rows=vt==rowVT?1:*(uint32_t*)(item+0x64);
   if(data) {PHInkAudit a={0};
    int valid=accessible(data,len);
    if(valid&&state->policyRequired){AcquireSRWLockShared(&policyGate);valid=state->policyActive&&ph_filter_policy(data,len,rows,*(uint32_t*)(item+0x4c),activeHeader,&activePolicy,&a);ReleaseSRWLockShared(&policyGate);}
    else if(valid)valid=ph_filter(data,len,rows,*(uint32_t*)(item+0xc),mask,&a);
    if(!valid){fault(102);return 0xd05;}
    audit(&a);InterlockedAdd64(&state->rows,rows);
   }
  }
 }
 return realProcess(stream,shared);
}
static int readExact(HANDLE f,void *p,DWORD size) {DWORD got=0;return ReadFile(f,p,size,&got,0)&&got==size;}
static int writeExact(HANDLE f,const void *p,DWORD size) {DWORD got=0;return WriteFile(f,p,size,&got,0)&&got==size;}
/* Cached PRN path: make a private filtered copy. Original cached file is never modified.
   Reassign only the by-value temporary with the host's own std::string allocator. */
static int prepareFile(void *item,uint32_t mask,WCHAR tmp[MAX_PATH]) {
 uint8_t *s=(uint8_t*)item+0x48;size_t n=*(size_t*)(s+16),cap=*(size_t*)(s+24);
 const char *src=cap>15?*(char**)s:(char*)s;
 HANDLE input=INVALID_HANDLE_VALUE,output=INVALID_HANDLE_VALUE;uint8_t *row=0;WCHAR path[32768],tmpDir[MAX_PATH],origin[32768],sidecar[MAX_PATH+8];
 uint32_t h[12];LARGE_INTEGER size;int ok=0;
 if(!n||n>32760||!MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,src,-1,path,32768))goto done;
 DWORD envLen=GetEnvironmentVariableW(L"LOCALAPPDATA",tmpDir,MAX_PATH);if(!envLen||envLen>MAX_PATH-60)goto done;
 wcscat(tmpDir,L"\\EufyPhotoCraftBridge");CreateDirectoryW(tmpDir,0);wcscat(tmpDir,L"\\ink-cache");CreateDirectoryW(tmpDir,0);
 /* Re-filter from the complete source, including after a restart. Never use a
    previous single-channel copy as the source for a different combination. */
 if(!_wcsnicmp(path,tmpDir,wcslen(tmpDir))&&path[wcslen(tmpDir)]==L'\\') {
  if(wcslen(path)>=MAX_PATH)goto done;swprintf(sidecar,MAX_PATH+8,L"%ls.origin",path);
  HANDLE meta=CreateFileW(sidecar,GENERIC_READ,FILE_SHARE_READ,0,OPEN_EXISTING,0,0);DWORD bytes=0;
  if(meta==INVALID_HANDLE_VALUE)goto done;LARGE_INTEGER metaSize;
  int valid=GetFileSizeEx(meta,&metaSize)&&metaSize.QuadPart>=4&&metaSize.QuadPart<=sizeof(origin)&&!(metaSize.QuadPart&1)&&ReadFile(meta,origin,(DWORD)metaSize.QuadPart,&bytes,0)&&bytes==metaSize.QuadPart&&origin[bytes/2-1]==0;
  CloseHandle(meta);if(!valid)goto done;wcscpy(path,origin);
 }
 if(mask==15&&!state->policyRequired){char utf8[131072];int z=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,path,-1,utf8,sizeof utf8,0,0);if(!z)goto done;nativeAssign(s,utf8,z-1);return 1;}
 input=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,0,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,0);
 if(input==INVALID_HANDLE_VALUE||!GetFileSizeEx(input,&size)||!readExact(input,h,48)||!ph_prn_header(h,size.QuadPart))goto done;
 if(!GetTempFileNameW(tmpDir,L"PHI",0,tmp))goto done;
 output=CreateFileW(tmp,GENERIC_WRITE,0,0,CREATE_ALWAYS,FILE_ATTRIBUTE_TEMPORARY,0);
 if(output==INVALID_HANDLE_VALUE||!writeExact(output,h,48))goto done;
 DWORD rowSize=h[3]*6;row=HeapAlloc(GetProcessHeap(),0,rowSize);if(!row)goto done;
 for(uint32_t y=0;y<h[4];y++){PHInkAudit a={0};if(!readExact(input,row,rowSize))goto done;int valid;
  if(state->policyRequired){AcquireSRWLockShared(&policyGate);valid=state->policyActive&&ph_filter_policy(row,rowSize,1,y,h,&activePolicy,&a);ReleaseSRWLockShared(&policyGate);}else valid=ph_filter(row,rowSize,1,6,mask,&a);
  if(!valid||!writeExact(output,row,rowSize))goto done;audit(&a);InterlockedIncrement64(&state->rows);}
 /* Preserve optional trailer bytes without interpreting them as ink. */
 {uint64_t left=(uint64_t)size.QuadPart-48-(uint64_t)rowSize*h[4];while(left){DWORD count=(DWORD)(left<rowSize?left:rowSize);if(!readExact(input,row,count)||!writeExact(output,row,count))goto done;left-=count;}}
 CloseHandle(input);input=INVALID_HANDLE_VALUE;CloseHandle(output);output=INVALID_HANDLE_VALUE;
 swprintf(sidecar,MAX_PATH+8,L"%ls.origin",tmp);output=CreateFileW(sidecar,GENERIC_WRITE,0,0,CREATE_NEW,FILE_ATTRIBUTE_TEMPORARY,0);
 if(output==INVALID_HANDLE_VALUE||!writeExact(output,path,(DWORD)((wcslen(path)+1)*sizeof(WCHAR))))goto done;
 CloseHandle(output);output=INVALID_HANDLE_VALUE;
 {char utf8[MAX_PATH*4];int z=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,tmp,-1,utf8,sizeof utf8,0,0);if(!z)goto done;
  nativeAssign(s,utf8,(size_t)z-1);}
 InterlockedIncrement64(&state->files);ok=1;
done:
 if(row)HeapFree(GetProcessHeap(),0,row);
 if(input!=INVALID_HANDLE_VALUE)CloseHandle(input);if(output!=INVALID_HANDLE_VALUE)CloseHandle(output);
 if(!ok&&tmp[0]){DeleteFileW(tmp);swprintf(sidecar,MAX_PATH+8,L"%ls.origin",tmp);DeleteFileW(sidecar);tmp[0]=0;}
 return ok;
}
static void removeCopy(const WCHAR *tmp){if(tmp[0]){WCHAR sidecar[MAX_PATH+8];DeleteFileW(tmp);swprintf(sidecar,MAX_PATH+8,L"%ls.origin",tmp);DeleteFileW(sidecar);}}
static int layer(void *stream,void *item) {
 WCHAR tmp[MAX_PATH]={0};if(!prepareFile(item,maskNow(),tmp)){fault(103);nativeLayerDestroy(item);return 0xd08;}
 int result=realLayer(stream,item);removeCopy(tmp);return result;
}
static uint8_t fileCallback(void *callback,void *item) {
 WCHAR tmp[MAX_PATH]={0};if(!prepareFile(item,maskNow(),tmp)){fault(104);nativeLayerDestroy(item);return 0;}
 uint8_t result=realFileCallback(callback,item);
 /* The host may consume the file asynchronously. Keep it with its origin sidecar. */
 if(!result)removeCopy(tmp);return result;
}
static void start(void *engine,void *param) {
 if(*(uint32_t*)param!=0){realStart(engine,param);return;}
 AcquireSRWLockExclusive(&gate);
 if(!state->busy){activeMask=state->requested;state->effective=activeMask;state->fault=0;resetAudit();}state->busy++;queued++;
 ReleaseSRWLockExclusive(&gate);realStart(engine,param);
 if(!engineRunning(engine)){AcquireSRWLockExclusive(&gate);if(queued>0){queued--;state->busy--;}ReleaseSRWLockExclusive(&gate);}
}
static void execute(void *engine,void *param) {
 AcquireSRWLockExclusive(&gate);
 if(queued>0)queued--;else{if(!state->busy){activeMask=state->requested;state->effective=activeMask;state->fault=0;resetAudit();}state->busy++;}
 ReleaseSRWLockExclusive(&gate);realExecute(engine,param);
 AcquireSRWLockExclusive(&gate);state->busy--;if(!state->busy)activeMask=state->requested;ReleaseSRWLockExclusive(&gate);
}
static int hashFile(const WCHAR *path,const char *expected) {
 BCRYPT_ALG_HANDLE alg=0;BCRYPT_HASH_HANDLE hash=0;HANDLE file=INVALID_HANDLE_VALUE;BYTE out[32],buf[65536];int ok=0;DWORD count;
 if(BCryptOpenAlgorithmProvider(&alg,BCRYPT_SHA256_ALGORITHM,0,0)||BCryptCreateHash(alg,&hash,0,0,0,0,0))goto done;
 file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,0,OPEN_EXISTING,0,0);if(file==INVALID_HANDLE_VALUE)goto done;
 while(ReadFile(file,buf,sizeof buf,&count,0)&&count)if(BCryptHashData(hash,buf,count,0))goto done;
 if(BCryptFinishHash(hash,out,32,0))goto done;
 char hex[65];for(int i=0;i<32;i++)sprintf(hex+i*2,"%02x",out[i]);ok=!strcmp(hex,expected);
done:if(file!=INVALID_HANDLE_VALUE)CloseHandle(file);if(hash)BCryptDestroyHash(hash);if(alg)BCryptCloseAlgorithmProvider(alg,0);return ok;
}
static DWORD WINAPI initialize(void *unused) {
 WCHAR name[80],path[32768];swprintf(name,80,L"Local\\PhotoHubInk-%lu",GetCurrentProcessId());
 HANDLE mapping=CreateFileMappingW(INVALID_HANDLE_VALUE,0,PAGE_READWRITE,0,sizeof(PHState),name);if(!mapping)return 0;
 state=MapViewOfFile(mapping,FILE_MAP_ALL_ACCESS,0,0,sizeof(PHState));if(!state)return 0;
 memset(state,0,sizeof *state);state->magic=0x31494850;state->version=2;state->pid=GetCurrentProcessId();state->requested=state->effective=15;
 HMODULE engine=GetModuleHandleW(L"ColorEngineAPI.dll");
 if(!engine){fault(1);return 0;}
 GetModuleFileNameW(engine,path,32768);
 if(!hashFile(path,"17a8593d0517e205e8131d924b9e156211ea4f50210f8bfe575cdcecc438c849")){fault(2);return 0;}
 GetModuleFileNameW(0,path,32768);
#ifndef PH_TEST_HOST
 if(!hashFile(path,"ab65f2f978018460b24d9d6397c91be073e95822e0497094b5ab02a495d10c97")){fault(3);return 0;}
#endif
 rowVT=GetProcAddress(engine,"??_7PrintRowItem@AnkerMake@@6B@");blockVT=GetProcAddress(engine,"??_7PrintBlockItem@AnkerMake@@6B@");headVT=GetProcAddress(engine,"??_7PrintHeadItem@AnkerMake@@6B@");
 nativeAssign=(void*)GetProcAddress(engine,"?assign@?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@QEAAAEAV12@QEBD_K@Z");
 hasMemoryImage=(void*)GetProcAddress(engine,"?hasMemoryImage@ripParams@RipData@@QEBA_NAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@Z");
 getMemoryImage=(void*)GetProcAddress(engine,"?getMemoryImage@ripParams@RipData@@QEBA?BUImageDataMem@2@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@Z");
 destroyMemoryImage=(void*)GetProcAddress(engine,"??1ImageDataMem@RipData@@QEAA@XZ");
 destroyString=(void*)GetProcAddress(engine,"??1?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@QEAA@XZ");
 engineRunning=(void*)GetProcAddress(engine,"?isRunning@ColorEngine@AnkerMake@@QEBA_NXZ");
 nativeLayerDestroy=(void*)GetProcAddress(engine,"??1PrintLayerItem@AnkerMake@@UEAA@XZ");
 if(!nativeLayerDestroy)nativeLayerDestroy=(void*)GetProcAddress(engine,"??1PrintLayerItem@AnkerMake@@QEAA@XZ");
 if(!rowVT||!blockVT||!headVT||!nativeAssign||!nativeLayerDestroy||!engineRunning||!hasMemoryImage||!getMemoryImage||!destroyMemoryImage||!destroyString||MH_Initialize()!=MH_OK){fault(4);return 0;}
 const char *symbols[]={"?process@SendMemoryStream@AnkerMake@@UEAAHAEBV?$shared_ptr@UPrintItem@AnkerMake@@@std@@@Z","?send_print_layer_item@SendMemoryStream@AnkerMake@@AEAAHUPrintLayerItem@2@@Z","?startAyncTask@ColorEngine@AnkerMake@@QEAAXUTaskParam@2@@Z","?excuteTask@ColorEngine@AnkerMake@@AEAAXUTaskParam@2@@Z","??R?$_Func_class@_NUPrintLayerItem@AnkerMake@@@std@@QEBA_NUPrintLayerItem@AnkerMake@@@Z"};
 void *hooks[]={process,layer,start,execute,fileCallback};void **originals[]={(void**)&realProcess,(void**)&realLayer,(void**)&realStart,(void**)&realExecute,(void**)&realFileCallback};
 for(int i=0;i<5;i++){void *target=GetProcAddress(engine,symbols[i]);if(!target||MH_CreateHook(target,hooks[i],originals[i])!=MH_OK||MH_QueueEnableHook(target)!=MH_OK){MH_Uninitialize();fault(5);return 0;}}
 {void*target=GetProcAddress(engine,"?print_single_layer@PrintModeHandler@AnkerMake@@IEAAHAEBVripParams@RipData@@MM@Z");if(!target||MH_CreateHook(target,single,(void**)&realSingle)!=MH_OK||MH_QueueEnableHook(target)!=MH_OK){MH_Uninitialize();fault(7);return 0;}}
 {void*target=GetProcAddress(engine,"?excute@Print2DModeHandler@AnkerMake@@UEAAHXZ");if(!target||MH_CreateHook(target,execute2D,(void**)&realExecute2D)!=MH_OK||MH_QueueEnableHook(target)!=MH_OK){MH_Uninitialize();fault(8);return 0;}}
 if(MH_ApplyQueued()!=MH_OK){MH_Uninitialize();fault(6);return 0;}
 InterlockedExchange(&state->ready,1);
 for(;;){if(state->sequence!=state->acknowledged){AcquireSRWLockExclusive(&gate);LONG seq=state->sequence,cmd=state->command;state->result=state->busy?1:(cmd<0||cmd>17)?2:0;
   if(!state->result){if(cmd>=16){state->policyRequired=cmd==17;}else{if(state->requested!=cmd)resetAudit();state->requested=cmd;activeMask=cmd;state->effective=cmd;}state->fault=0;}
   InterlockedExchange(&state->acknowledged,seq);ReleaseSRWLockExclusive(&gate);}Sleep(30);}
 return 0;
}
BOOL WINAPI DllMain(HINSTANCE instance,DWORD reason,void *reserved) {
 if(reason==DLL_PROCESS_ATTACH){selfModule=instance;DisableThreadLibraryCalls(instance);HANDLE t=CreateThread(0,0,initialize,0,0,0);if(t)CloseHandle(t);}return TRUE;
}
#ifdef PH_TEST_HOST
/* Test fixture only. Not exported by the production DLL. Exercises the same PNG
   reader and native output callbacks without a printer or a fabricated RIP job. */
__declspec(dllexport) int PhotoHubTestPolicy(const WCHAR*path){
 PHPolicy p={0};int ok=ph_load_policy_png(path,&p);if(ok!=1)return 0;
 AcquireSRWLockExclusive(&policyGate);ph_policy_free(&activePolicy);activePolicy=p;state->policyRequired=1;state->policyActive=1;state->policyPixels=(LONG64)p.width*p.height;ReleaseSRWLockExclusive(&policyGate);return 1;
}
__declspec(dllexport) int PhotoHubTestPolicyParam(void*param){PHPolicy p={0};int result=loadSourcePolicy(param,&p);ph_policy_free(&p);return result;}
#endif
