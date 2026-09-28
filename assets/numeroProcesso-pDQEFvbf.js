import{c as l,j as c,b as s,I as d,J as p,N as h}from"./index-B7XvKaq0.js";/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=l("ArchiveRestore",[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h2",key:"tvwodi"}],["path",{d:"M20 8v11a2 2 0 0 1-2 2h-2",key:"1gkqxj"}],["path",{d:"m9 15 3-3 3 3",key:"1pd0qc"}],["path",{d:"M12 12v9",key:"192myk"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=l("Archive",[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",key:"1s80jp"}],["path",{d:"M10 12h4",key:"a56b0p"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=l("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=l("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);function x({ativo:t,onClick:e}){return c.jsxs("button",{onClick:e,"aria-pressed":t,className:"flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold",style:{border:`1px solid ${t?s.brass:s.line}`,background:t?"rgba(165,121,59,0.10)":"transparent",color:s.ink},children:[c.jsx(u,{size:14})," ",t?"Voltar aos ativos":"Arquivo"]})}function b(){var e,o;if(typeof((e=globalThis.crypto)==null?void 0:e.randomUUID)=="function")return globalThis.crypto.randomUUID();const t=new Uint8Array(16);if(typeof((o=globalThis.crypto)==null?void 0:o.getRandomValues)=="function")globalThis.crypto.getRandomValues(t);else for(let a=0;a<t.length;a+=1)t[a]=Math.floor(Math.random()*256);return t[6]=t[6]&15|64,t[8]=t[8]&63|128,[...t].map((a,r)=>{const i=a.toString(16).padStart(2,"0");return[4,6,8,10].includes(r)?`-${i}`:i}).join("")}const g=["Cível","Trabalhista","Tributário","Penal","Previdenciário","Empresarial / Societário","Família e Sucessões","Consumidor","Imobiliário","Ambiental","Administrativo","Eleitoral","Contratos","Bancário","Digital / Cibernético","Agrário","Internacional","Propriedade Intelectual"];function k(t,e,o,a){const r=d(t==null?void 0:t.plano),i=r==null?void 0:r[e];if(i==null||o<i)return null;const n=p(r.value);return n?`Limite de ${i} ${a} do plano ${r.label} atingido. Assine o plano ${h(n)} em "Minha Empresa" pra continuar cadastrando.`:`Limite de ${i} ${a} do plano ${r.label} atingido. Fale com o suporte da plataforma.`}function v(t){const e=(t||"").replace(/\D/g,"").slice(0,20);return e?e.length<=7?e:e.length<=9?`${e.slice(0,7)}-${e.slice(7)}`:e.length<=13?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9)}`:e.length<=14?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13)}`:e.length<=16?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13,14)}.${e.slice(14)}`:`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13,14)}.${e.slice(14,16)}.${e.slice(16)}`:""}export{$ as A,x as B,y as F,f as a,u as b,g as c,k as d,v as f,b as g};
