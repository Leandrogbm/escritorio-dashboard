import React, { useEffect, useRef, useState } from "react";
import { COLORS } from "../lib/theme.js";

// Modal de criar/editar reaproveitado por Clientes/Processos/Prazos/Honorários.
// `fields`: [{ key, label, type: "text"|"number"|"date"|"select", options?: [{value,label}],
//   onSelect?: (value) => ({ outroCampo: valor }) — só pra "select", preenche outro campo
//   de brinde quando essa opção muda (ex.: plano → valor mensal padrão)
//   onBlur?: async (value) => ({ outroCampo: valor }) | null — pra text/number, dispara ao
//   sair do campo (ex.: CEP → busca endereço)
//   mask?: (raw) => string — formata o valor a cada tecla (ex.: celular → "(11) 91234-5678") }]
export default function RecordFormModal({ open, title, fields, initialValues, onSubmit, onClose }) {
  const dialogRef = useRef(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? {});
      setError("");
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open, initialValues]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // só envia as colunas reais do form — initialValues pode trazer joins/metadados
      // (ex.: p.cliente aninhado) que não são colunas da tabela.
      // string vazia em campo opcional vira null (date/numeric não aceitam "").
      const clean = Object.fromEntries(fields.map((f) => {
        const v = values[f.key];
        return [f.key, v === "" || v === undefined ? null : v];
      }));
      await onSubmit(clean);
      onClose();
    } catch (err) {
      setError(err.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="rounded-lg p-0 backdrop:bg-black/40"
      style={{ border: `1px solid ${COLORS.line}`, width: "min(420px, 90vw)" }}
    >
      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
        <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 16 }}>
          {title}
        </p>

        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            {f.label}
            {f.type === "select" ? (
              <select
                required={!f.optional}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value, ...f.onSelect?.(e.target.value) }))}
                className="px-3 py-2 rounded-md text-sm"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              >
                <option value="" disabled>Selecione</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                required={!f.optional}
                type={f.type ?? "text"}
                step={f.type === "number" ? "0.01" : undefined}
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                // off: navegador não deve autopreencher email/senha de outra conta salva aqui —
                // esses campos são dados de terceiros (cliente/colaborador), não do próprio usuário.
                autoComplete="off"
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: f.mask ? f.mask(e.target.value) : e.target.value }))}
                onBlur={f.onBlur ? async (e) => {
                  const patch = await f.onBlur(e.target.value);
                  if (patch) setValues((v) => ({ ...v, ...patch }));
                } : undefined}
                className="px-3 py-2 rounded-md text-sm"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              />
            )}
          </label>
        ))}

        {error && <p className="text-xs" style={{ color: COLORS.wine }}>{error}</p>}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-md text-sm"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3.5 py-2 rounded-md text-sm font-semibold"
            style={{ background: COLORS.ink, color: "#fff", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
