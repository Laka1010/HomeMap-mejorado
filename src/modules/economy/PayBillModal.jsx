import { useEffect, useState } from "react";
import { Wallet, HeartHandshake } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useCurrency } from "../../currency";
import { economyService } from "./services/economyService";
import { accountsService } from "./services/accountsService";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";
import { SelectField } from "../../components/SelectField";

/**
 * "¿Cómo quieres pagarla?" — desde una cuenta del propio Household, o
 * mediante una contribución inmediata desde cualquier cuenta accesible del
 * usuario (Personal, Shared o del propio Household). Ambas opciones llaman
 * a un RPC atómico (pay_bill_from_account / pay_bill_via_contribution) que
 * crea el gasto y marca la factura pagada en una sola transacción.
 */
export function PayBillModal({ bill, spaceId, spaces, onClose, onPaid }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(onClose);
  const [mode, setMode] = useState(null); // null | 'account' | 'contribution'
  const [householdAccounts, setHouseholdAccounts] = useState([]);
  const [contributionAccounts, setContributionAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "account" && spaceId) {
      accountsService.listAccounts(spaceId).then((list) => {
        const active = list.filter((a) => a.status === "active");
        setHouseholdAccounts(active);
        setAccountId(active.find((a) => a.is_default)?.id || active[0]?.id || "");
      }).catch(() => {});
    }
    if (mode === "contribution" && spaces?.length) {
      Promise.all(spaces.map((s) => accountsService.listAccounts(s.id).then((list) => list.map((a) => ({ ...a, spaceName: s.name })))))
        .then((groups) => {
          const flat = groups.flat().filter((a) => a.status === "active");
          setContributionAccounts(flat);
          setAccountId(flat[0]?.id || "");
        })
        .catch(() => {});
    }
  }, [mode, spaceId, spaces]);

  const handleSubmit = async () => {
    if (!accountId) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "account") await economyService.payBillFromAccount(bill.id, accountId);
      else await economyService.payBillViaContribution(bill.id, accountId);
      onPaid();
    } catch (err) {
      console.error("Error paying bill:", err);
      setError(t("bills.payError"));
      setSaving(false);
    }
  };

  return (
    <div className="hm-modal-overlay" onClick={(e) => { if (isSuppressingClick()) return; onClose(e); }}>
      <div className="hm-modal hm-scroll" style={{ maxWidth: 440, ...sheetStyle }} onClick={(e) => e.stopPropagation()}>
        <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
          <div className="hm-modal-handle" />
        </div>
        <div className="hm-modal-header">
          <button className="hm-modal-close" onClick={onClose} aria-label={t("bills.close")}>✕</button>
          <h3 className="hm-display hm-modal-title">{bill.name}</h3>
        </div>
        <div className="hm-modal-body">
          <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, marginBottom: 16 }}>{formatCurrency(bill.amount)}</div>

          {!mode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{t("bills.payChoiceTitle")}</div>
              <button
                className="hm-btn hm-btn-soft hm-btn--full"
                style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => setMode("account")}
              >
                <Wallet size={16} /> {t("bills.payFromAccount")}
              </button>
              <button
                className="hm-btn hm-btn-soft hm-btn--full"
                style={{ justifyContent: "flex-start", gap: 10, flexDirection: "column", alignItems: "flex-start" }}
                onClick={() => setMode("contribution")}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><HeartHandshake size={16} /> {t("bills.payViaContribution")}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 500 }}>{t("bills.payViaContributionHint")}</span>
              </button>
            </div>
          )}

          {mode === "account" && (
            <>
              <label className="hm-label">{t("bills.chooseAccountLabel")}</label>
              <SelectField
                title={t("bills.chooseAccountLabel")}
                value={accountId}
                onChange={setAccountId}
                options={householdAccounts.map((a) => ({ value: a.id, label: a.name, emoji: a.icon }))}
              />
            </>
          )}

          {mode === "contribution" && (
            <>
              <label className="hm-label">{t("bills.chooseAccountLabel")}</label>
              <SelectField
                title={t("bills.chooseAccountLabel")}
                value={accountId}
                onChange={setAccountId}
                options={contributionAccounts.map((a) => ({ value: a.id, label: `${a.name} — ${a.spaceName}`, emoji: a.icon }))}
              />
            </>
          )}

          {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "10px 0 0" }}>{error}</p>}

          {mode && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="hm-btn hm-btn-soft" onClick={() => setMode(null)}>{t("bills.cancel")}</button>
              <button className="hm-btn hm-btn-primary" onClick={handleSubmit} disabled={saving || !accountId}>
                {t("bills.confirmPay")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
