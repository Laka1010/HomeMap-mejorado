import { Search, Package, Home, Box, CheckSquare, ShoppingCart, Wallet, Users, MapPin } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useGlobalSearch } from "./useGlobalSearch";
import { EmptyState } from "../../components/EmptyState";
import { ObjectDndProvider, useDraggableObject, useObjectDropTarget } from "../../dnd/objectDnd";

const CATEGORY_META = {
  object: { labelKey: "search.type.object", icon: Package },
  room: { labelKey: "search.type.room", icon: Home },
  container: { labelKey: "search.type.container", icon: Box },
  task: { labelKey: "search.type.task", icon: CheckSquare },
  shopping: { labelKey: "search.type.shopping", icon: ShoppingCart },
  bill: { labelKey: "search.type.bill", icon: Wallet },
  member: { labelKey: "search.type.member", icon: Users },
};

/**
 * Contenido del buscador global (se monta dentro de un <Modal> genérico en
 * App.jsx, igual que ShareHomeModal). Busca en las 7 categorías del hogar y
 * agrupa los resultados; la lógica de búsqueda en sí vive en useGlobalSearch
 * / searchEngine.js, aquí solo hay presentación y navegación.
 */
export function GlobalSearchModal(props) {
  return (
    <ObjectDndProvider>
      <GlobalSearchModalInner {...props} />
    </ObjectDndProvider>
  );
}

function GlobalSearchModalInner({ state, houseId, canSeeEconomy, members, getPath, goTo, onMoveObject, onOpenMembers, onClose }) {
  const { t } = useTranslation();
  const { query, setQuery, groups } = useGlobalSearch({ state, houseId, canSeeEconomy, members, getPath, t });

  const handleSelect = (entry) => {
    switch (entry.type) {
      case "object":
        goTo({ tab: "objectDetail", objectId: entry.id });
        break;
      case "room":
        goTo({ tab: "micasa", roomId: entry.id });
        break;
      case "container":
        goTo({ tab: "cajas", containerId: entry.id });
        break;
      case "task":
        goTo({ tab: "tareas" });
        break;
      case "shopping":
        goTo({ tab: "compras" });
        break;
      case "bill":
        goTo({ tab: "economia" });
        break;
      case "member":
        // A diferencia de los demás casos, onOpenMembers() abre otro modal
        // usando el mismo estado `modal` de App.jsx que este buscador (el
        // houseSettings sustituye al globalSearch en el mismo slot) — así
        // que NO hay que llamar también a onClose() aquí: cerraría justo el
        // modal que se acaba de abrir (el bug original: onClose() se
        // llamaba siempre al final, sin excepción para este caso).
        onOpenMembers?.();
        return;
      default:
        break;
    }
    onClose?.();
  };

  const hasQuery = query.trim() !== "";
  const hasResults = groups.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="hm-card" style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <Search size={18} style={{ color: "var(--ink-soft)", marginLeft: 8, flexShrink: 0 }} />
        <input
          className="hm-input"
          style={{ border: "none", fontSize: 15, padding: "10px 4px" }}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!hasQuery ? (
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{t("search.startTypingHint")}</p>
      ) : !hasResults ? (
        <EmptyState card icon={Search} title={t("common.noResults")} subtitle={t("common.noResultsDetails", { query })} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((group) => {
            const meta = CATEGORY_META[group.type];
            const GroupIcon = meta.icon;
            return (
              <div key={group.type}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--ink-soft)" }}>
                  <GroupIcon size={13} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {t(meta.labelKey)}
                  </span>
                  <span style={{ fontSize: 11.5 }}>· {group.total}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.items.map((entry) => (
                    <ResultRow
                      key={`${entry.type}-${entry.id}`}
                      entry={entry}
                      GroupIcon={GroupIcon}
                      state={state}
                      onSelect={handleSelect}
                      onMoveObject={onMoveObject}
                    />
                  ))}
                  {group.total > group.items.length && (
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "0 4px" }}>
                      {t("search.andMore", { count: group.total - group.items.length })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Fila de resultado. Un objeto se puede arrastrar; una habitación o una caja
 * son destinos: soltar un objeto encima lo mueve ahí (mismo `moveObject` que
 * el modal "Mover"). El resto de tipos son solo un botón que navega.
 */
function ResultRow({ entry, GroupIcon, state, onSelect, onMoveObject }) {
  const realObject = entry.type === "object" ? state.objects.find((o) => o.id === entry.id) : null;
  const { dragHandleProps, isDragging, guardClick } = useDraggableObject(realObject || { id: entry.id });

  const isDropTarget = (entry.type === "room" || entry.type === "container") && !!onMoveObject;
  const targetLocation = entry.type === "room"
    ? { roomId: entry.id, zoneId: null, containerId: null }
    // contenedor: normalizeLocation deriva room/zone a partir del contenedor
    : { roomId: null, zoneId: null, containerId: entry.id };
  const { ref, isOver } = useObjectDropTarget({
    id: isDropTarget ? `search-${entry.type}-${entry.id}` : null,
    onDrop: (obj) => onMoveObject?.(obj.id, targetLocation),
    canDrop: (obj) => {
      if (entry.type === "room") return obj.roomId !== entry.id || obj.zoneId || obj.containerId;
      return obj.containerId !== entry.id;
    },
    disabled: !isDropTarget,
  });

  const canDragObject = entry.type === "object" && !!realObject;

  return (
    <button
      ref={ref}
      className={`hm-card hm-tap${isOver ? " is-over" : ""}`}
      style={{
        padding: 12,
        cursor: "pointer",
        textAlign: "left",
        border: isOver ? "1px solid var(--accent)" : "none",
        outline: isOver ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        background: isOver ? "var(--accent-soft)" : undefined,
        opacity: isDragging ? 0.4 : 1,
        width: "100%",
        touchAction: canDragObject ? "pan-y" : undefined,
      }}
      onPointerDown={canDragObject ? dragHandleProps.onPointerDown : undefined}
      onClick={guardClick(() => onSelect(entry))}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <GroupIcon size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.title}
          </div>
          {entry.subtitle && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.path && <MapPin size={10} style={{ flexShrink: 0 }} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.subtitle}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
