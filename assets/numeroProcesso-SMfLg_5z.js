import{c as t,A as s,E as c,G as p}from"./index-D4qZhnAQ.js";/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=t("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=t("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=t("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]),h=["Cível","Trabalhista","Tributário","Penal","Previdenciário","Empresarial / Societário","Família e Sucessões","Consumidor","Imobiliário","Ambiental","Administrativo","Eleitoral","Contratos","Bancário","Digital / Cibernético","Agrário","Internacional","Propriedade Intelectual"];function f(l,e,n,o){const a=s(l==null?void 0:l.plano),i=a==null?void 0:a[e];if(i==null||n<i)return null;const r=c(a.value);return r?`Limite de ${i} ${o} do plano ${a.label} atingido. Faça upgrade para o plano ${p(r)} pra continuar cadastrando (fale com o suporte da plataforma).`:`Limite de ${i} ${o} do plano ${a.label} atingido. Fale com o suporte da plataforma.`}function y(l){const e=(l||"").replace(/\D/g,"").slice(0,20);return e?e.length<=7?e:e.length<=9?`${e.slice(0,7)}-${e.slice(7)}`:e.length<=13?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9)}`:e.length<=14?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13)}`:e.length<=16?`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13,14)}.${e.slice(14)}`:`${e.slice(0,7)}-${e.slice(7,9)}.${e.slice(9,13)}.${e.slice(13,14)}.${e.slice(14,16)}.${e.slice(16)}`:""}export{$ as A,u as D,m as F,h as a,f as b,y as f};
