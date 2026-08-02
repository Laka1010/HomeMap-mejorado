import { useEffect, useState } from "react";
import { Plus, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import { formatCurrencyValue } from "../../utils/currencyUtils";
import { accountsService } from "./services/accountsService";
import { AccountModal } from "./AccountModal";
import { TransferModal } from "./TransferModal";

/**
 * Tarjetas horizontales de cuentas del Space activo, mismo patrón
 * "header + botón ghost" que GoalsSection. El saldo se formatea con la
 * moneda propia de CADA cuenta (`formatCurrencyValue`, sin pasar por
 * useCurrency — ese hook está atado a la moneda de la casa, no vale aquí
 * porque una cuenta puede tener una moneda distinta a la del hogar).
 */
export function AccountsSection({ spaceId, spaces, userId }) {
  const { t, locale } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState(null); // null=cerrado, {}=crear, {...}=editar
  const [showTransfer, setShowTransfer] = useState(false);

  const load = async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      setAccounts(await accountsService.listAccounts(spaceId));
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [spaceId]);

  const activeAccounts = accounts.filter((a) => a.status === "active");

  const handleSaved = () => {
    setEditingAccount(null);
    load();
  };

  return (
    <div className="hm-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
          {t("accounts.title")}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {activeAccounts.length >= 1 && (
            <button className="hm-btn hm-btn-ghost hm-btn--compact" style={{ color: "var(--accent)" }} onClick={() => setShowTransfer(true)}>
              <ArrowLeftRight size={14} /> {t("transfers.title")}
            </button>
          )}
          <button className="hm-btn hm-btn-ghost hm-btn--compact" style={{ color: "var(--accent)" }} onClick={() => setEditingAccount({})}>
            <Plus size={14} /> {t("accounts.add")}
          </button>
        </div>
      </div>

      {!loading && activeAccounts.length === 0 ? (
        <div style={{ padding: "16px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{t("accounts.empty")}</div>
      ) : (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
          {activeAccounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setEditingAccount(account)}
              style={{
                flexShrink: 0,
                width: 140,
                textAlign: "left",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--surface-alt)",
                padding: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: account.color || "var(--accent)", display: "grid", placeItems: "center", fontSize: 15 }}>
                {account.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {account.name}
              </div>
              {account.is_default && (
                <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 600 }}>{t("accounts.defaultBadge")}</div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                {formatCurrencyValue(account.balance, account.currency_code, locale)}
              </div>
            </button>
          ))}
        </div>
      )}

      {editingAccount && (
        <AccountModal
          spaceId={spaceId}
          userId={userId}
          account={editingAccount.id ? editingAccount : null}
          onClose={() => setEditingAccount(null)}
          onSaved={handleSaved}
        />
      )}

      {showTransfer && (
        <TransferModal
          spaceId={spaceId}
          spaces={spaces}
          accounts={activeAccounts}
          onClose={() => setShowTransfer(false)}
          onDone={() => { setShowTransfer(false); load(); }}
        />
      )}
    </div>
  );
}
