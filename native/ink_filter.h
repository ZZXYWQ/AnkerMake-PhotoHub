#ifndef PHOTOHUB_INK_FILTER_H
#define PHOTOHUB_INK_FILTER_H
#include <stdint.h>
#include <stddef.h>
#include <string.h>
/* ColorEngine 5.0.4: row-major, six planar 2-bit channels per row: K C M Y W1 W2.
   W1/W2 and all padding of selected planes remain byte-for-byte unchanged. */
/* UI bits are C=1 M=2 Y=4 K=8; native final physical planes are KCMY. */
static const uint8_t ph_plane_mask[4]={8,1,2,4};
typedef struct { uint64_t before[6], after[6], bytes; } PHInkAudit;
static int ph_filter(uint8_t *data, size_t length, uint32_t rows,
                     uint32_t channels, uint32_t mask, PHInkAudit *audit) {
    if (mask > 15 || channels != 6 || !rows || !length ||
        length > 1024ULL*1024*1024 || length % ((uint64_t)rows*channels)) return 0;
    size_t plane = length / rows / channels;
    if (!plane || !data) return 0;
    for (uint32_t r=0; r<rows; r++) for (uint32_t c=0; c<6; c++) {
        uint8_t *p=data+((size_t)r*6+c)*plane;
        uint64_t count=0;
        for(size_t i=0;i<plane;i++) count += p[i]!=0;
        if(audit) audit->before[c]+=count;
        if(c<4 && !(mask & ph_plane_mask[c])) memset(p,0,plane);
        if(audit) audit->after[c]+=(c<4 && !(mask&ph_plane_mask[c]))?0:count;
    }
    if(audit) audit->bytes+=length;
    return 1;
}
static int ph_prn_header(const uint32_t *h, uint64_t file_size) {
    return h[0]==0x5555 && h[3]>0 && h[3]<=16777216 && h[4]>0 &&
           h[5]>0 && h[5]<=(uint64_t)h[3]*4 && h[7]==6 && h[8]==2 &&
           file_size>=48+(uint64_t)h[3]*h[4]*6;
}
#endif
