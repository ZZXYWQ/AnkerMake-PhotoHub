/* Scan only the staged Git publication; never scan user profiles or credentials. */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=cp.execFileSync('git',['-c','safe.directory='+root,'ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
const blocked=/\.(exe|dll|pdb|prn|psd|empf|har|saz|icc|icm|zip)$/i;
const sensitive=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bAKIA[A-Z0-9]{16}\b/,/[A-Z]:[\\/]Users[\\/][^\\/\s'"<>]+[\\/]/i,/"token"\s*:\s*"[0-9a-f]{64}"/i];
const issues=[];
for(const f of files){if(blocked.test(f)||/(^|\/)config\.(json|js)$/.test(f)||/(^|\/)(?:research[^/]*|node_modules|build-env|build-work)\//.test(f))issues.push(f+': excluded artifact');const raw=fs.readFileSync(path.join(root,f));if(raw.includes(0))issues.push(f+': binary file');const s=raw.toString('utf8');if(sensitive.some(p=>p.test(s)))issues.push(f+': sensitive literal');}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}console.log('PASS public-source allowlist and sensitive-literal scan: '+files.length+' text files');
