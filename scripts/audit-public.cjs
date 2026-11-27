/* Scan only the staged Git publication; never scan user profiles or credentials. */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=cp.execFileSync('git',['-c','safe.directory='+root,'ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
const blocked=/\.(exe|dll|pdb|prn|psd|empf|har|saz|icc|icm|zip)$/i;
const sensitive=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bAKIA[A-Z0-9]{16}\b/,/[A-Z]:[\\/]Users[\\/][^\\/\s'"<>]+[\\/]/i,/"token"\s*:\s*"[0-9a-f]{64}"/i];
const issues=[];
const branding=new Map([['installer/branding/ZZXLAB.ico',Buffer.from([0,0,1,0])],['installer/branding/ZZXLAB.png',Buffer.from([137,80,78,71,13,10,26,10])],['installer/branding/ZZXLAB-wordmark.png',Buffer.from([137,80,78,71,13,10,26,10])],['installer/branding/wizard.bmp',Buffer.from('BM')],['installer/branding/wizard-small.bmp',Buffer.from('BM')]]);
for(const f of files){if(blocked.test(f)||/(^|\/)config\.(json|js)$/.test(f)||/(^|\/)(?:research[^/]*|node_modules|build-env|build-work)\//.test(f))issues.push(f+': excluded artifact');const raw=cp.execFileSync('git',['show',':'+f],{cwd:root,maxBuffer:16*1024*1024});if(branding.has(f)){const magic=branding.get(f);if(raw.length>2*1024*1024||!raw.subarray(0,magic.length).equals(magic))issues.push(f+': invalid branding asset');continue;}if(raw.includes(0))issues.push(f+': binary file');const s=raw.toString('utf8');if(sensitive.some(p=>p.test(s)))issues.push(f+': sensitive literal');if(new RegExp('co'+'dex','i').test(s))issues.push(f+': excluded product branding');}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}console.log('PASS staged public-source allowlist and sensitive-literal scan: '+files.length+' files');
