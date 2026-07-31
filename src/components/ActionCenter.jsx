import { useState, useEffect } from "react";
import { Plus, Box, ShoppingCart, CheckSquare, CreditCard, Wallet, DollarSign, BoxSelect } from "lucide-react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { useTranslation } from "../i18n";

// ActionCenter: Floating Action Button + Bottom Sheet
export function ActionCenter({ currentTab, openModal, currentHome, position = "center" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { handleRef, handleMouseDown, isSuppressingClick, sheetStyle } = useDragToDismiss(() => setOpen(false));

  useEffect(() => {
    // Close when route changes
    setOpen(false);
  }, [currentTab]);

  const openAction = (type, payload) => {
    setOpen(false);
    // small delay to allow sheet to close before opening modal
    setTimeout(() => openModal && openModal(type, payload), 120);
  };

  // Define cards with icon, color, title, subtitle, modalType
  const ALL_ACTIONS = [
    { key: "object", icon: "📦", color: "#5E8C61", title: t("actionCenter.object"), subtitle: t("actionCenter.objectSubtitle"), modal: "addObject" },
    { key: "container", icon: "📦", color: "#5E8C61", title: t("actionCenter.container"), subtitle: t("actionCenter.containerSubtitle"), modal: "addContainer" },
    { key: "room", icon: "🚪", color: "#7A6BFF", title: t("actionCenter.room"), subtitle: t("actionCenter.roomSubtitle"), modal: "addRoom" },
    { key: "zone", icon: "📍", color: "#6B7A5E", title: t("actionCenter.zone"), subtitle: t("actionCenter.zoneSubtitle"), modal: "addZone" },

    { key: "shopping", icon: "🛒", color: "#2EAD57", title: t("actionCenter.shopping"), subtitle: t("actionCenter.shoppingSubtitle"), modal: "addShopping" },
    { key: "task", icon: "✅", color: "#8A5CFF", title: t("actionCenter.task"), subtitle: t("actionCenter.taskSubtitle"), modal: "addTask" },
    { key: "movement", icon: "💸", color: "#C94B4B", title: t("actionCenter.movement"), subtitle: t("actionCenter.movementSubtitle"), modal: "addMovement" },
    { key: "bill", icon: "📄", color: "#E69B3C", title: t("actionCenter.bill"), subtitle: t("actionCenter.billSubtitle"), modal: "addBill" },
  ];

  // Contextual ordering based on currentTab
  const orderedActions = () => {
    const ctx = currentTab || "inicio";

    if (ctx === "hogar") {
      const primary = ALL_ACTIONS.filter(a => ["object", "container", "room", "zone"].includes(a.key));
      const secondary = ALL_ACTIONS.filter(a => !["object", "container", "room", "zone"].includes(a.key));
      return [...primary, { separator: true }, ...secondary];
    }

    if (ctx === "organizacion") {
      const primary = ALL_ACTIONS.filter(a => ["shopping", "task"].includes(a.key));
      const secondary = ALL_ACTIONS.filter(a => !["shopping", "task"].includes(a.key));
      return [...primary, { separator: true }, ...secondary];
    }

    if (ctx === "economia") {
      const primary = ALL_ACTIONS.filter(a => ["movement", "bill"].includes(a.key));
      const secondary = ALL_ACTIONS.filter(a => !["movement", "bill"].includes(a.key));
      return [...primary, { separator: true }, ...secondary];
    }

    // default: homepage or others - order by frequent usage
    const favOrder = ["object", "shopping", "task", "movement", "bill"];
    const sorted = favOrder.map(k => ALL_ACTIONS.find(a => a.key === k)).filter(Boolean);
    const rest = ALL_ACTIONS.filter(a => !favOrder.includes(a.key));
    return [...sorted, { separator: true }, ...rest];
  };

  const fabSize = position === "corner" ? 54 : 64;
  const fabRadius = position === "corner" ? 999 : 20;

  return (
    <>
      <style>{`
        @keyframes hmFabPing {
          0% { transform: scale(1); opacity: 0.55; }
          75%, 100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes hmFabBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
      {/* FAB */}
      <div
        style={
          position === "corner"
            ? { position: "fixed", right: 22, bottom: 84, zIndex: 90 }
            : { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, zIndex: 90 }
        }
      >
        {!open && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", inset: 0, width: fabSize, height: fabSize, borderRadius: fabRadius,
              background: "var(--accent)", animation: "hmFabPing 2.6s cubic-bezier(0,0,.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        )}
        <button
          aria-label={t("actionCenter.heading")}
          onClick={() => setOpen((s) => !s)}
          className="hm-btn hm-btn-primary hm-btn--icon"
          style={{
            position: "relative",
            width: fabSize, height: fabSize, borderRadius: fabRadius,
            boxShadow: position === "corner" ? "0 8px 20px rgba(0,0,0,0.18)" : "0 8px 24px rgba(0,0,0,0.14)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: position === "corner" ? 28 : 22, padding: 0,
            animation: open ? "none" : "hmFabBob 2.6s ease-in-out infinite",
          }}
        >
          <span style={{
            display: "inline-block",
            transform: open ? "rotate(135deg) scale(1.1)" : "rotate(0) scale(1)",
            transition: "transform .32s cubic-bezier(.34,1.56,.64,1)",
          }}>+</span>
        </button>
      </div>

      {/* Bottom sheet overlay */}
      {open && (
        <div
          className="hm-modal-overlay"
          style={{ background: "rgba(8,10,12,0.36)", backdropFilter: "blur(6px)", alignItems: "flex-end", padding: 0 }}
          onClick={() => { if (!isSuppressingClick()) setOpen(false); }}
        >
          <div
            className="hm-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 920,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              background: "var(--surface)",
              paddingBottom: 20,
              boxShadow: "0 -20px 40px rgba(0,0,0,0.12)",
              zIndex: 1401,
              ...sheetStyle,
            }}
          >
            <div ref={handleRef} className="hm-modal-handle-wrap" onMouseDown={handleMouseDown}>
              <div className="hm-modal-handle" />
            </div>
            <div style={{ padding: "0 20px", display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>+</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{t("actionCenter.heading")}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("actionCenter.subtitle")}</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button className="hm-btn hm-btn-ghost" onClick={() => setOpen(false)}>{t("actionCenter.close")}</button>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: "0 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {orderedActions().map((a, i) => {
                  if (a.separator) return <div key={`sep-${i}`} style={{ gridColumn: "1/-1", height: 12 }} />;

                  return (
                    <button
                      key={a.key}
                      onClick={() => openAction(a.modal, a.key === "object" ? { roomId: currentHome?.rooms?.[0]?.id } : undefined)}
                      className="hm-card hm-tap"
                      style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}
                    >
                      <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                        <span style={{ color: a.color }}>{a.icon}</span>
                      </div>

                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{a.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
