import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: só em produção — SW no dev server atrapalha o hot reload do Vite.
// updateViaCache: "none" — o sw.js em si nunca é servido do cache HTTP do navegador, sempre
// busca a versão real no servidor antes de decidir se precisa atualizar (senão o navegador
// podia ficar até 24h achando que o service worker antigo ainda é o mais novo).
// controllerchange dispara quando um novo SW assume (ele já força isso sozinho via
// skipWaiting+clients.claim em sw.js) — recarrega a aba sozinha pra pegar o build novo, sem
// precisar a pessoa fechar/reabrir. Guard evita loop se disparar mais de uma vez.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Só recarrega em troca de CONTROLADOR (SW antigo -> novo); na primeiríssima visita
  // (sem SW nenhum ainda) esse mesmo evento também dispara ao instalar o primeiro, e
  // recarregar aí seria um reload inútil pra todo visitante novo.
  const jaTinhaController = !!navigator.serviceWorker.controller;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }));
  let jaRecarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (jaRecarregou || !jaTinhaController) return;
    jaRecarregou = true;
    window.location.reload();
  });
}
