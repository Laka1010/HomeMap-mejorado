import { useState } from "react";
import { useTranslation } from "../../i18n";
import { CurrencyPickerModal } from "../../components/settings/CurrencyPickerModal";
import { accountsService } from "./services/accountsService";
import { getCurrenciesList } from "../../utils/currencyUtils";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

const TYPE_OPTIONS = [
  { value: "bank", icon: "🏦", labelKey: "accounts.typeBank" },
  { value: "card", icon: "💳", labelKey: "accounts.typeCard" },
  { value: "cash", icon: "💵", labelKey: "accounts.typeCash" },
  { value: "savings", icon: "💰", labelKey: "accounts.typeSavings" },
  { value: "other", icon: "📦", labelKey: "accounts.typeOther" },
];

const COLOR_SWATCHES = ["#6366F1", "#22C55E", "#EC4899", "#F59E0B", "#06B6D4", "#EF4444", "#8B5CF6"];

/**
 * Alta/edición de una cuenta. Sin wizard multi-paso (todo en una pantalla,
 * como pide el diseño): nombre, tipo (icono fijo por tipo, sin selector de
 * icono aparte), moneda (reutiliza CurrencyPickerModal tal cual), color y,
 * solo al crear, saldo inicial — el saldo real ya no se edita a mano una vez
 * creada la cuenta, lo mantienen los triggers de la base de datos.
 */
export function AccountModal({ spaceId, userId, account, onClose, onSaved, onDeleted }) {
  const { t } = useTranslation();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const isEdit = !!account;
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "bank");
  const [color, setColor] = useState(account?.color || COLOR_SWATCHES[0]);
  const [currencyCode, setCurrencyCode] = useState(account?.currency_code || "EUR");
  const [initialBalance, setInitialBalance] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const currency = getCurrenciesList().find((c) => c.code === currencyCode);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const selectedType = TYPE_OPTIONS.find((o) => o.value === type);
      if (isEdit) {
        const saved = await accountsService.updateAccount(account.id, {
          name: name.trim(),
          type,
          icon: selectedType.icon,
          color,
          currency_code: currencyCode,
        });
        onSaved(saved);
      } else {
        const saved = await accountsService.createAccount(spaceId, userId, {
          name: name.trim(),
          type,
          icon: selectedType.icon,
          color,
          currencyCode,
          initialBalance: parseFloat(initialBalance) || 0,
        });
        onSaved(saved);
      }
    } catch (err) {
      setError(t(isEdit ? "accounts.updateError" : "accounts.createError"));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await accountsService.deleteAccount(account.id);
      onDeleted ? onDeleted() : onSaved(null);
    } catch (err) {
      setDeleteError(t("accounts.deleteError"));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("accounts.cancel")}>✕</button>
          <h3 className="hm-display hm-modal-title">{t(isEdit ? "accounts.editTitle" : "accounts.addTitle")}</h3>
        </div>
        <div className="hm-modal-body">
          <label className="hm-label">{t("accounts.nameLabel")}</label>
          <input
            className="hm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("accounts.namePlaceholder")}
          />

          <label className="hm-label" style={{ marginTop: 14 }}>{t("accounts.typeLabel")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                aria-label={t(opt.labelKey)}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: "var(--radius)",
                  border: type === opt.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: type === opt.value ? "var(--accent-soft)" : "var(--surface)",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                {opt.icon}
              </button>
            ))}
          </div>

          <label className="hm-label" style={{ marginTop: 14 }}>{t("accounts.colorLabel")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c,
                  border: color === c ? "3px solid var(--ink)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <label className="hm-label" style={{ marginTop: 14 }}>{t("accounts.currencyLabel")}</label>
          <button
            type="button"
            className="hm-input"
            onClick={() => setShowCurrencyPicker(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          >
            <span>{currency ? `${currency.flag} ${currency.code} · ${currency.symbol}` : currencyCode}</span>
          </button>

          {!isEdit && (
            <>
              <label className="hm-label" style={{ marginTop: 14 }}>{t("accounts.initialBalanceLabel")}</label>
              <input
                className="hm-input"
                type="number"
                min="0"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
              />
            </>
          )}

          {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="hm-btn hm-btn-soft" onClick={onClose}>{t("accounts.cancel")}</button>
            <button className="hm-btn hm-btn-primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
              {t("accounts.save")}
            </button>
          </div>

          {isEdit && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              {account.is_default ? (
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0 }}>{t("accounts.cannotDeleteDefault")}</p>
              ) : !confirmingDelete ? (
                <button
                  className="hm-btn hm-btn-ghost"
                  style={{ color: "var(--danger)" }}
                  onClick={() => { setDeleteError(""); setConfirmingDelete(true); }}
                >
                  {t("accounts.delete")}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--danger-soft)", padding: 12, borderRadius: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("accounts.confirmDelete")} {t("accounts.cannotUndo")}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="hm-btn hm-btn-soft" onClick={() => setConfirmingDelete(false)}>{t("accounts.cancel")}</button>
                    <button className="hm-btn hm-btn--danger" onClick={handleDelete} disabled={deleting}>{t("accounts.confirmYesDelete")}</button>
                  </div>
                </div>
              )}

              {deleteError && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{deleteError}</p>}
            </div>
          )}
        </div>
      </div>

      {showCurrencyPicker && (
        <CurrencyPickerModal
          currency={currencyCode}
          onSelect={(code) => { setCurrencyCode(code); setShowCurrencyPicker(false); }}
          onClose={() => setShowCurrencyPicker(false)}
        />
      )}
    </div>
  );
}
