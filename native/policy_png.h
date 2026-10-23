#ifndef PHOTOHUB_POLICY_PNG_H
#define PHOTOHUB_POLICY_PNG_H
static int ph_load_policy_bytes(const uint8_t*bytes,size_t length,PHPolicy*out){
 if(length<20||memcmp(bytes,"\x89PNG\r\n\x1a\n",8))return 0;int found=0;
 for(size_t at=8;at+12<=length;){uint32_t n=ph_be32(bytes+at);if(n>length-at-12)goto bad;const uint8_t*type=bytes+at+4;
  if(!memcmp(type,"phCm",4)){if(found||ph_be32(bytes+at+8+n)!=ph_crc(type,(size_t)n+4)||!ph_policy_decode(out,bytes+at+8,n))goto bad;found=1;}
  if(!memcmp(type,"IEND",4))return found;at+=(size_t)n+12;
 }bad:ph_policy_free(out);return -1;
}
/* Read only our ancillary PNG chunk; neither PNG pixels nor source files change. */
static int ph_load_policy_png(const WCHAR *path,PHPolicy*out){
 HANDLE f=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_WRITE,0,OPEN_EXISTING,0,0);if(f==INVALID_HANDLE_VALUE)return 0;
 LARGE_INTEGER length,pos;uint8_t head[8],*body=0;DWORD got;int result=0;
 if(!GetFileSizeEx(f,&length)||length.QuadPart<20||!ReadFile(f,head,8,&got,0)||got!=8||memcmp(head,"\x89PNG\r\n\x1a\n",8))goto done;
 uint64_t at=8;while(at+12<=(uint64_t)length.QuadPart){if(!ReadFile(f,head,8,&got,0)||got!=8)goto bad;uint32_t n=ph_be32(head);if(n>(uint64_t)length.QuadPart-at-12)goto bad;
  if(!memcmp(head+4,"phCm",4)){if(result||n<16||n>134217744)goto bad;body=malloc((size_t)n+4);if(!body)goto bad;memcpy(body,head+4,4);if(!ReadFile(f,body+4,n,&got,0)||got!=n||!ReadFile(f,head,4,&got,0)||got!=4||ph_be32(head)!=ph_crc(body,n+4)||!ph_policy_decode(out,body+4,n))goto bad;free(body);body=0;result=1;}
  else{pos.QuadPart=(uint64_t)n+4;if(!SetFilePointerEx(f,pos,0,FILE_CURRENT))goto bad;}
  if(!memcmp(head+4,"IEND",4))break;at+=(uint64_t)n+12;
 }goto done;
 bad:result=-1;ph_policy_free(out);
 done:free(body);CloseHandle(f);return result;
}
#endif
