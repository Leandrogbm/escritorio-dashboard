import{c as n,H as s,I as c,J as d}from"./index-o4Merz4a.js";/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=n("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=n("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=n("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);function f(){var e,o;if(typeof((e=globalThis.crypto)==null?void 0:e.randomUUID)=="function")return globalThis.crypto.randomUUID();const t=new Uint8Array(16);if(typeof((o=globalThis.crypto)==null?void 0:o.getRandomValues)=="function")globalThis.crypto.getRandomValues(t);else for(let i=0;i<t.length;i+=1)t[i]=Math.floor(Math.random()*256);return t[6]=t[6]&15|64,t[8]=t[8]&63|128,[...t].map((i,l)=>{const a=i.toString(16).padStart(2,"0");return[4,6,8,10].includes(l)?`-${a}`:a}).join("")}const h=["Cível","Trabalhista","Tributário","Penal","Previdenciário","Empresarial / Societário","Família e Sucessões","Consumidor","Imobiliário","Ambiental","Administrativo","Eleitoral","Contratos","Bancário","Digital / Cibernético","Agrário","Internacional","Propriedade Intelectual"];function y(t,e,o,i){const l=s(t==null?void 0:t.plano),a=l==null?void 0:l[e];if(a==null||o<a)return null;const r=c(l.value);return r?`Limite de ${a} ${i} do plano ${l.label} atingido. Assine o plano ${d(r)} em "Minha Empresa" pra continuar cadastrando.`:`Limite de ${a} ${i} do plano ${l.label} atingido. Fale com o suporte da plataforma.`}function g(t){const e=(t||"").replace(/\D/g,"").slice(0,20);return e?e.length<=7?e:e.length<=9?`${e.slice(0,7)}-${e.slice(7)}`:e.length<=13?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9)}`:e.length<=14?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13)}`:e.length<=16?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13,14)}.${e.slice(14)}`:`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13,14)}.${e.slice(14,16)}.${e.slice(16)}`:""}export{u as A,m as D,$ as F,h as a,y as b,g as f,f as g};
