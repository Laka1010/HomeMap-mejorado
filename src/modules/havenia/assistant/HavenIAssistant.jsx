import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "../../../utils/portalTarget";
import { X, Sparkles, Send, MapPin } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { sendAssistantMessage } from "./assistantService";
import { ASSISTANT_TOOL_DISPLAY } from "./assistantTools";
import { isLikelyOnTopic } from "./topicFilter";
import { premiumService } from "../../../services/premiumService";

/** Objetos navegables (con id) que trajeron las tools de búsqueda de este mensaje, sin duplicados. */
function objectsFromToolCalls(toolCalls) {
  const seen = new Set();
  const result = [];
  for (const tc of toolCalls || []) {
    for (const obj of tc.objects || []) {
      if (seen.has(obj.id)) continue;
      seen.add(obj.id);
      result.push(obj);
    }
  }
  return result;
}

/**
 * Chat del asistente de Haven IA. Sin memoria permanente (sección 15 del
 * pedido): `messages` vive solo en este componente y se manda entero en
 * cada petición; cerrar el modal lo descarta. Nunca toca Supabase
 * directamente -- solo llama a sendAssistantMessage, que invoca la Edge
 * Function ai-assistant (ahí vive el bucle de tool-calling real).
 */
export function HavenIAssistant({ onClose, houseId, isPremium, onRequirePremium, onOpenObject }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(null);
  const scrollRef = useRef(null);

  // Defensa en profundidad, mismo motivo que ConsumableScanModal/TicketScanModal.
  useEffect(() => {
    if (!isPremium) onRequirePremium();
  }, [isPremium, onRequirePremium]);

  // Solo para pintar el aviso de límite alcanzado con antelación -- el
  // bloqueo real (que no sea saltable cambiando el cliente) lo hace siempre
  // ai-assistant en el servidor antes de llamar al proveedor de IA.
  useEffect(() => {
    if (!isPremium) return;
    let cancelled = false;
    premiumService.getPremiumUsage("ai_chat").then((data) => { if (!cancelled) setUsage(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isPremium]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  if (!isPremium) return null;

  const limitReached = usage != null && !usage.allowed;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || limitReached) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");

    if (!isLikelyOnTopic(text)) {
      setMessages((prev) => [...prev, { role: "assistant", content: t("assistant.offTopicReply"), toolCalls: [] }]);
      return;
    }

    setSending(true);
    try {
      const result = await sendAssistantMessage(nextMessages, houseId, crypto.randomUUID());
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply, toolCalls: result.toolCalls || [] }]);
      premiumService.getPremiumUsage("ai_chat").then(setUsage).catch(() => {});
    } catch (err) {
      console.error("Error hablando con el asistente de Haven IA:", err);
      setError(err?.message || t("assistant.sendError"));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return createPortal(
    <div className="hm-fade-in" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1300, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <button className="hm-btn hm-btn-soft hm-btn--icon" onClick={onClose} aria-label={t("assistant.closeAria")}><X size={18} /></button>
        <div style={{ flex: 1 }}>
          <div className="hm-display" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} style={{ color: "var(--accent)" }} /> {t("assistant.title")}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="hm-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 13, padding: "40px 20px", maxWidth: 360, margin: "0 auto" }}>
            {t("assistant.emptyHint")}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              className={m.role === "user" ? "hm-card-flat" : "hm-card"}
              style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 16, background: m.role === "user" ? "var(--accent-soft)" : undefined }}
            >
              {m.role === "assistant" && m.toolCalls?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {m.toolCalls.map((tc, j) => {
                    const meta = ASSISTANT_TOOL_DISPLAY[tc.name];
                    const Icon = meta?.icon;
                    return (
                      <span key={j} className="hm-badge hm-badge--neutral" style={{ fontSize: 10.5 }}>
                        {Icon && <Icon size={11} />} {meta ? t(meta.labelKey) : tc.name}
                      </span>
                    );
                  })}
                </div>
              )}
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.content}</div>
              {m.role === "assistant" && objectsFromToolCalls(m.toolCalls).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {objectsFromToolCalls(m.toolCalls).map((obj) => (
                    <button
                      key={obj.id}
                      className="hm-btn hm-btn-soft hm-btn--compact"
                      style={{ fontSize: 12.5, justifyContent: "flex-start" }}
                      onClick={() => onOpenObject(obj.id)}
                    >
                      <MapPin size={13} /> {obj.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div className="hm-card" style={{ padding: "10px 14px", borderRadius: 16, fontSize: 13, color: "var(--ink-soft)" }}>
              {t("assistant.thinking")}
            </div>
          </div>
        )}
        {error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div> : null}
      </div>

      {limitReached && (
        <div style={{ padding: "0 20px 12px", fontSize: 13, color: "var(--danger)", textAlign: "center" }}>
          {t("havenIA.usage.limitReached")}
        </div>
      )}
      <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <input
          className="hm-input"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("assistant.inputPlaceholder")}
          disabled={sending || limitReached}
        />
        <button className="hm-btn hm-btn-primary hm-btn--icon" onClick={handleSend} disabled={sending || limitReached || !input.trim()} aria-label={t("assistant.sendAria")}>
          <Send size={16} />
        </button>
      </div>
    </div>,
    getPortalTarget()
  );
}
