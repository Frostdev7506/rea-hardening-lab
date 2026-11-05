import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { calculateQuote } from './recovered.mjs';
const s=fs.readFileSync(new URL('./server-decoded.js',import.meta.url),'utf8');
const outer=s.slice(s.indexOf('_11505976={'),s.indexOf(',_2851381={}'));
const inner=s.slice(s.indexOf('_1742560={'),s.indexOf(";_5913340['r'](_4632416)"));
const constants=s.slice(s.indexOf('let _4056413='),s.indexOf(';var _1213331='));
const quote=s.slice(s.indexOf('_2861177=function(')+9,s.indexOf('(_15734060);}catch(_4912897)'));
const c=vm.createContext({});
vm.runInContext('const _3944979=()=>{}, _2586433=()=>{}, _2701692=()=>{};const '+outer+';const '+inner+';'+constants+';globalThis.oracle='+quote+';',c);
function output(fn,p) {try{return {value:JSON.parse(JSON.stringify(fn(p)))}}catch(e){return {error:e.message}}}
let seed=123456789;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let total=0, eligible=0, rejected=0;
function check(p) { const recovered=output(calculateQuote,p), original=output(c.oracle,p); assert.deepEqual(recovered,original,JSON.stringify(p)); total++; if (recovered.error) rejected++; else eligible++; }
const zones=['local','national','remote'],items=['general','fragile','battery'],promos=['','NIGHTOWL17','BULKLANE','UNKNOWN'];
const weights=[0.1,0.5,1,2,2.01,6,7.5,7.999,8,12,12.01,15,15.01,20];
const times=['2026-11-06T13:59:59Z','2026-11-06T14:00:00Z','2026-11-06T16:59:59Z','2026-11-06T17:00:00Z','2026-11-06T18:00:00Z','2026-11-10T17:00:00Z','2026-11-11T09:00:00Z','2026-12-24T17:00:00Z','2026-12-25T09:00:00Z','2026-12-31T18:00:00Z','2027-01-01T09:00:00Z'];
for(let i=0;i<15000;i++) {
 const p={weight:weights[i%weights.length],length:1+Math.floor(random()*120),width:1+Math.floor(random()*120),height:1+Math.floor(random()*120),zone:zones[i%3],item:items[Math.floor(i/3)%3],express:!!(i%2),insured:!!(Math.floor(i/2)%2),declaredValue:[1,179.51,179.52,2500,2500.01,10000][i%6],promo:promos[Math.floor(i/7)%4],dispatchAt:times[i%times.length]};
 // Every other input uses compact dimensions so eligible and pricing paths are well covered.
 if(i%2===0){p.length=20;p.width=10;p.height=10;}
 check(p);
}
for (const zone of zones) for (const item of items) for (const express of [false,true]) for (const insured of [false,true]) for (const promo of promos) for (const weight of weights) for (const dispatchAt of times) for (const declaredValue of [1,179.51,179.52,2500,2500.01,10000]) {
  check({weight,length:20,width:10,height:10,zone,item,express,insured,promo,dispatchAt,declaredValue});
}
for (const length of [99.999,100,100.001,120]) for (const width of [1,10,100]) for (const height of [1,10,100]) for (const zone of zones) {
  check({weight:0.1,length,width,height,zone,item:'general',express:false,insured:true,promo:'BULKLANE',dispatchAt:'2026-11-06T17:00:00Z',declaredValue:100});
}
console.log(JSON.stringify({checks:total,eligible,rejected,status:'passed',sample:calculateQuote({weight:8,length:20,width:10,height:10,zone:'national',express:false,item:'general',insured:true,declaredValue:1000,promo:'NIGHTOWL17',dispatchAt:'2026-11-10T18:00:00Z'})},null,2));
