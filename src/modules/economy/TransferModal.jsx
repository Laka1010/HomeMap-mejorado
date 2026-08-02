import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { transfersService } from "./services/transfersService";

/**
 * Transferir (entre 2 cuentas del Space activo) o Contribuir (desde una
 * cuenta del Space activo hacia otro Space al que el usuario pertenece,
 * ej. Personal -> Household). Misma operación en la base de datos
 * (`_execute_financial_transfer`), presentada como 2 pestañas porque son 2
 * acciones distintas para quien las usa.
 */
export function TransferModal({ spaceId, spaces, accounts, onClose, onDone }) {
  const { t } = useTranslation();
  const otherSpaces = (spaces || []).filter((s) => s.id !== spaceId);
  const canTransfer = accounts.length >= 2;
  const canContribute = otherSpaces.length > 0 && accounts.length >= 1;

  // Un Space con una sola cuenta (ej. Personal recién creado) no puede
  // transferir entre cuentas propias — el modo por defecto debe ser el que
  // sí esté disponible, si no el formulario nunca es alcanzable.
  const [mode, setMode] = useState(canTransfer ? "transfer" : "contribute");

  const [fromAccountId, setFromAccountId] = useState(accounts?.[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(accounts?.[1]?.id || "");
  const [toSpaceId, setToSpaceId] = useState(otherSpaces[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // El <select> "A la cuenta" excluye la cuenta origen de sus opciones, pero
  // eso solo cambia lo que se ve — si `fromAccountId` cambia a lo que ya
  // era `toAccountId`, el estado de React se queda con las dos iguales
  // (el <select> del DOM cae a su primera opción válida por su cuenta, sin
  // disparar onChange, así que parece correcto en pantalla mientras el envío
  // se bloquea en silencio). Reasigna `toAccountId` a otra cuenta válida en
  // cuanto colisionan.
  useEffect(() => {
    if (fromAccountId && fromAccountId === toAccountId) {
      setToAccountId(accounts.find((a) => a.id !== fromAccountId)?.id || "");
    }
  }, [fromAccountId, accounts]);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    // Validar ANTES de setSaving(true): un return dentro del try, después de
    // marcar saving, se saltaría el catch y dejaría el botón deshabilitado
    // para siempre (saving nunca vuelve a false).
    if (mode === "transfer" && (!fromAccountId || !toAccountId || fromAccountId === toAccountId)) return;
    if (mode === "contribute" && (!fromAccountId || !toSpaceId)) return;

    setSaving(true);
    setError("");
    try {
      if (mode === "transfer") {
        await transfersService.transferBetweenAccounts(fromAccountId, toAccountId, parsedAmount, note.trim() || undefined);
      } else {
        await transfersService.contributeToSpace(fromAccountId, toSpaceId, parsedAmount, note.trim() || undefined);
      }
      onDone();
    } catch (err) {
      setError(t("transfers.error"));
      setSaving(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={onClose}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="hm-modal-handle" />
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("transfers.cancel")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t("transfers.title")}</h3>
        </div>
        <div className="hm-modal-body">
          {canTransfer && canContribute && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                className={"hm-btn hm-btn--full " + (mode === "transfer" ? "hm-btn-primary" : "hm-btn-soft")}
                onClick={() => setMode("transfer")}
              >
                {t("transfers.transferTab")}
              </button>
              <button
                type="button"
                className={"hm-btn hm-btn--full " + (mode === "contribute" ? "hm-btn-primary" : "hm-btn-soft")}
                onClick={() => setMode("contribute")}
              >
                {t("transfers.contributeTab")}
              </button>
            </div>
          )}

          {!canTransfer && !canContribute && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("transfers.needTwoAccounts")}</p>
          )}
          {mode === "transfer" && !canTransfer && canContribute && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("transfers.needTwoAccounts")}</p>
          )}
          {mode === "contribute" && !canContribute && canTransfer && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("transfers.noOtherSpaces")}</p>
          )}

          {mode === "transfer" && canTransfer && (
            <>
              <label className="hm-label">{t("transfers.fromLabel")}</label>
              <select className="hm-input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>

              <label className="hm-label" style={{ marginTop: 14 }}>{t("transfers.toAccountLabel")}</label>
              <select className="hm-input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.filter((a) => a.id !== fromAccountId).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </>
          )}

          {mode === "contribute" && canContribute && (
            <>
              <label className="hm-label">{t("transfers.fromLabel")}</label>
              <select className="hm-input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>

              <label className="hm-label" style={{ marginTop: 14 }}>{t("transfers.toSpaceLabel")}</label>
              <select className="hm-input" value={toSpaceId} onChange={(e) => setToSpaceId(e.target.value)}>
                {otherSpaces.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </>
          )}

          {((mode === "transfer" && canTransfer) || (mode === "contribute" && canContribute)) && (
            <>
              <label className="hm-label" style={{ marginTop: 14 }}>{t("transfers.amountLabel")}</label>
              <input className="hm-input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />

              <label className="hm-label" style={{ marginTop: 14 }}>{t("transfers.noteLabel")}</label>
              <input className="hm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("transfers.notePlaceholder")} />

              {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{error}</p>}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("transfers.cancel")}</button>
                <button className="hm-btn hm-btn-primary" onClick={handleSubmit} disabled={saving || !amount}>
                  {t(mode === "transfer" ? "transfers.submitTransfer" : "transfers.submitContribute")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
