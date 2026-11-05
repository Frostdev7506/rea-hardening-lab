const fs=require('fs'),vm=require('vm');
const s=fs.readFileSync(require('node:path').join(__dirname, '../../evidence/artifacts/after-server.js'),'utf8');
const defs=s.slice(s.indexOf('function _0x58bf('),s.indexOf('function token_decrypt_2ef3('))+s.slice(s.indexOf('function _0x3286('),s.indexOf('function kxbvf6('));
const rotation=s.slice(s.indexOf('(function('),s.indexOf(',((()=>'));
const context=vm.createContext({});vm.runInContext(defs+';'+rotation+');',context,{timeout:3000});
const aliases=new Set(['_0x3286']);let prev=0;while(prev!==aliases.size){prev=aliases.size;for(const m of s.matchAll(/(_0x[\da-f]+)\s*=\s*(_0x[\da-f]+)\b/g)){if(aliases.has(m[2]))aliases.add(m[1]);}}
let decoded=s.replace(/(_0x[\da-f]+)\((0x[\da-f]+)\)/g,(m,a,b)=>aliases.has(a)?JSON.stringify(context._0x3286(Number(b))):m).replace(/0x[\da-f]+/g,m=>String(Number(m)));
fs.writeFileSync(require('node:path').join(__dirname, 'server-decoded.js'),decoded);
console.log('aliases',aliases.size);
console.log(decoded.slice(29000,52000));
