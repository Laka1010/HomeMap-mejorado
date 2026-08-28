import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Clock3, Flame, History, Plus, Receipt, ShoppingCart, Sparkles, Star, Trash2 } from "lucide-react";
import { ModuleCard } from "../core/ModuleCard";
import { FavoriteStar } from "../../components/FavoriteStar";
import { shoppingService } from "../../services/shoppingService";
import { getCategoryIcon, getPriorityMeta, isUrgent } from "./shoppingMeta";
import { computeFrequentProducts } from "./frequentProducts";
import { ShoppingCheckoutMode } from "./ShoppingCheckoutMode";
import { getPortalTarget } from "../../utils/portalTarget";
import { EmptyState } from "../../components/EmptyState";
import { useTranslation } from "../../i18n";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * El escaneo de ticket con IA (ReceiptScanModal) ya está implementado pero
 * aún no se activa de cara al usuario; este aviso ocupa su sitio en los dos
 * puntos de entrada (lista y modo checkout) hasta que se habilite.
 */
function ScanReceiptComingSoon({ onClose }) {
  const { t } = useTranslation();
  return createPortal(
    <div className="hm-fade-in" style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="hm-card hm-card--p24" style={{ maxWidth: 340, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <Receipt size={32} style={{ color: "var(--accent)" }} />
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t("shoppingModule.scanReceiptComingSoonTitle")}</div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>{t("shoppingModule.scanReceiptComingSoon")}</div>
        <button className="hm-btn hm-btn-primary hm-btn--full" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>,
    getPortalTarget()
  );
}

function CategoryEmojiIcon({ emoji }) {
  return function CategoryIconCmp({ size = 16, style }) {
    return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{emoji}</span>;
  };
}

function PriorityBadge({ priority }) {
  const { t } = useTranslation();
  const meta = getPriorityMeta(priority);
  const Icon = meta.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: meta.color, fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap" }}>
      <Icon size={12} /> {t(meta.labelKey)}
    </span>
  );
}

function ShoppingItemCard({ item, onToggle, onToggleFavorite }) {
  const { t } = useTranslation();
  return (
    <ModuleCard
      // El emoji se sigue derivando de la categoría (cuando el producto trae
      // una, p.ej. importado de un ticket), pero su nombre ya no se escribe
      // debajo: en una lista de la compra ocupaba una línea por producto sin
      // aportar nada que el propio nombre no dijera ya.
      icon={CategoryEmojiIcon({ emoji: getCategoryIcon(item.category) })}
      title={item.name}
      badge={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FavoriteStar active={item.favorite} onToggle={() => onToggleFavorite(item.id)} size={15} />
          <PriorityBadge priority={item.priority} />
        </span>
      }
      accent={item.completed}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("shoppingModule.quantityUnit", { count: item.quantity || 1 })}</div>
        {item.notes ? <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{item.notes}</div> : null}
        <button
          className={(item.completed ? "hm-btn hm-btn-soft" : "hm-btn hm-btn-primary") + " hm-btn--full"}
          onClick={() => onToggle(item.id)}
        >
          <Check size={14} /> {item.completed ? t("shoppingModule.markPending") : t("shoppingModule.markPurchased")}
        </button>
      </div>
    </ModuleCard>
  );
}

function ItemSection({ icon: Icon, title, items, onToggle, onToggleFavorite, muted }) {
  if (items.length === 0) return null;
  return (
    <div style={muted ? { opacity: 0.7 } : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontWeight: 700, fontSize: 14 }}>
        <Icon size={16} style={{ color: "var(--accent)" }} /> {title}
        <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>({items.length})</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {items.map((item) => <ShoppingItemCard key={item.id} item={item} onToggle={onToggle} onToggleFavorite={onToggleFavorite} />)}
      </div>
    </div>
  );
}

function FrequentSuggestions({ suggestions, onAdd }) {
  const { t } = useTranslation();
  if (suggestions.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontWeight: 700, fontSize: 14 }}>
        <Sparkles size={16} style={{ color: "var(--accent)" }} /> {t("shoppingModule.frequentProducts")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {suggestions.map((s) => (
          <button key={s.name} className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => onAdd(s)}>
            <span style={{ fontSize: 15 }}>{getCategoryIcon(s.category)}</span> {s.name} <Plus size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShoppingModule({ state, dispatch, openModal, deleteShoppingList, addShopping, onCompletePurchase, onRepeatPurchase, onSaveReceiptPurchase }) {
  const { t } = useTranslation();
  const shoppingItems = Array.isArray(state.shoppingItems) ? state.shoppingItems : [];
  const shoppingLists = Array.isArray(state.shoppingLists) ? state.shoppingLists : [];
  const [activeListId, setActiveListId] = useState(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(null); // null | { listId, purchasedItemIds }

  const knownProductNames = useMemo(() => {
    const purchases = Array.isArray(state.shoppingPurchases) ? state.shoppingPurchases : [];
    const names = new Set(shoppingItems.map((i) => i.name).filter(Boolean));
    purchases.forEach((p) => (p.items || []).forEach((it) => it.name && names.add(it.name)));
    return Array.from(names);
  }, [state.shoppingPurchases, shoppingItems]);

  const activeList = shoppingLists.find((l) => l.id === activeListId) || null;
  const listItems = useMemo(
    () => activeList ? shoppingItems.filter((item) => item.listId === activeList.id) : [],
    [activeList, shoppingItems]
  );

  const visibleItems = favoritesOnly
    ? listItems.filter((item) => item.favorite)
    : listItems;

  const pendingItems = visibleItems.filter((item) => !item.completed);
  const completedItems = visibleItems.filter((item) => item.completed);
  const todayItems = pendingItems.filter((item) => isUrgent(item.priority));
  const laterItems = pendingItems.filter((item) => !isUrgent(item.priority));

  const frequentSuggestions = useMemo(() => {
    const purchases = Array.isArray(state.shoppingPurchases) ? state.shoppingPurchases : [];
    const pendingNames = listItems.filter((i) => !i.completed).map((i) => i.name);
    return computeFrequentProducts(purchases, { excludeNames: pendingNames, limit: 6 });
  }, [state.shoppingPurchases, listItems]);

  const togglePurchased = (itemId) => {
    const item = shoppingItems.find((i) => i.id === itemId);
    const nextCompleted = !item?.completed;
    dispatch((current) => ({
      ...current,
      shoppingItems: current.shoppingItems.map((i) => i.id === itemId ? { ...i, completed: nextCompleted } : i),
    }));
    shoppingService.updateItem(itemId, { completed: nextCompleted }).catch((error) => {
      console.error("Error updating shopping item:", error);
    });
  };

  const toggleFavorite = (itemId) => {
    const item = shoppingItems.find((i) => i.id === itemId);
    const nextFavorite = !item?.favorite;
    dispatch((current) => ({
      ...current,
      shoppingItems: current.shoppingItems.map((i) => i.id === itemId ? { ...i, favorite: nextFavorite } : i),
    }));
    shoppingService.updateItem(itemId, { favorite: nextFavorite }).catch((error) => {
      console.error("Error updating shopping item favorite:", error);
    });
  };

  const addFrequentSuggestion = (suggestion) => {
    if (!activeList || !addShopping) return;
    addShopping({
      id: "s-" + uid(),
      listId: activeList.id,
      name: suggestion.name,
      category: suggestion.category || null,
      quantity: 1,
      priority: "week",
      completed: false,
    });
  };

  const handleFinishCheckout = async (completedForPurchase, store) => {
    if (completedForPurchase.length > 0 && onCompletePurchase) {
      await onCompletePurchase({ listId: activeList.id, items: completedForPurchase, store });
    }
    setCheckoutMode(false);
  };

  const handleSaveReceipt = async (scanData) => {
    if (!onSaveReceiptPurchase) return;
    await onSaveReceiptPurchase({
      ...scanData,
      listId: scanningReceipt?.listId ?? null,
      purchasedItemIds: scanningReceipt?.purchasedItemIds ?? [],
    });
    setScanningReceipt(null);
    setCheckoutMode(false);
  };

  const handleDeleteList = (listId) => {
    if (activeListId === listId) setActiveListId(null);
    setConfirmingDeleteId(null);
    deleteShoppingList && deleteShoppingList(listId);
  };

  if (scanningReceipt) {
    return <ScanReceiptComingSoon onClose={() => setScanningReceipt(null)} />;
  }

  if (activeList && checkoutMode) {
    return (
      <ShoppingCheckoutMode
        items={listItems}
        onToggle={togglePurchased}
        onFinish={handleFinishCheckout}
        onClose={() => setCheckoutMode(false)}
        onScanReceipt={(completed) => setScanningReceipt({
          listId: activeList.id,
          purchasedItemIds: completed.map((i) => i.id),
        })}
      />
    );
  }

  if (!activeList) {
    return (
      <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t("shopping.title")}</h1>
          <div className="hm-scroll" style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", maxWidth: "100%" }}>
            <button className="hm-btn hm-btn-soft hm-btn--compact" style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => openModal("shoppingHistory")}><History size={13} /> {t("shoppingModule.history")}</button>
            <button className="hm-btn hm-btn-soft hm-btn--compact" style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => setScanningReceipt({ listId: null, purchasedItemIds: [] })}><Receipt size={13} /> {t("shoppingModule.scanReceipt")}</button>
            <button className="hm-btn hm-btn-primary hm-btn--compact" style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => openModal("addShoppingList")}><Plus size={13} /> {t("shoppingModule.newList")}</button>
          </div>
        </div>

        {shoppingLists.length === 0 ? (
          <EmptyState card icon={ShoppingCart} title={t("shoppingModule.emptyListsTitle")} subtitle={t("shoppingModule.emptyListsSubtitle")} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {shoppingLists.map((list) => {
              const items = shoppingItems.filter((item) => item.listId === list.id);
              const pending = items.filter((item) => !item.completed).length;
              const confirming = confirmingDeleteId === list.id;
              return (
                <div key={list.id} className="hm-card hm-tap" style={{ padding: 16, cursor: confirming ? "default" : "pointer" }} onClick={() => !confirming && setActiveListId(list.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{list.name}</div>
                    {!confirming ? (
                      <button
                        className="hm-btn hm-btn-ghost hm-btn--compact hm-text-danger"
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(list.id); }}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setConfirmingDeleteId(null)}>{t("shoppingModule.no")}</button>
                        <button className="hm-btn hm-btn--danger hm-btn--compact" onClick={() => handleDeleteList(list.id)}>{t("common.yes")}</button>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: confirming ? "var(--danger)" : "var(--ink-soft)", marginTop: 6 }}>
                    {confirming ? t("shoppingModule.confirmDeleteList") : items.length === 0 ? t("shoppingModule.noProducts") : t("shoppingModule.pendingOfTotal", { pending, total: items.length })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hm-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="hm-btn hm-btn-soft hm-btn--compact" onClick={() => setActiveListId(null)}><ArrowLeft size={16} /></button>
          <h1 className="hm-display" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{activeList.name}</h1>
        </div>
        <div className="hm-scroll" style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", maxWidth: "100%" }}>
          <button className="hm-btn hm-btn-soft hm-btn--compact" style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => openModal("shoppingHistory", { listId: activeList.id })}><History size={13} /> {t("shoppingModule.history")}</button>
          {listItems.length > 0 && (
            <button className="hm-btn hm-btn-soft hm-btn--compact" style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => setCheckoutMode(true)}><ShoppingCart size={13} /> {t("shoppingModule.checkoutMode")}</button>
          )}
          {listItems.length > 0 && (
            <button
              className={"hm-btn hm-btn--compact " + (favoritesOnly ? "hm-btn-primary" : "hm-btn-soft")}
              style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              <Star size={13} fill={favoritesOnly ? "currentColor" : "none"} /> {t("common.favoritesFilter")}
            </button>
          )}
          <button className="hm-btn hm-btn-primary hm-btn--compact" style={{ fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => openModal("addShopping", { listId: activeList.id })}><Plus size={13} /> {t("shopping.add")}</button>
        </div>
      </div>

      {/* Antes esta barra era selector de categoría + Favoritos + "Editar
          categorías". Al quitar las categorías de las listas solo queda el
          filtro de favoritos, que ya no necesita una tarjeta propia: va suelto
          junto a las acciones de la cabecera. */}

      {listItems.length === 0 ? (
        <EmptyState
          card
          icon={ShoppingCart}
          title={t("shoppingModule.emptyListTitle")}
          subtitle={t("shoppingModule.emptyListSubtitle")}
          action={<button className="hm-btn hm-btn-primary" onClick={() => openModal("addShopping", { listId: activeList.id })}><Plus size={15} /> {t("shopping.addProduct")}</button>}
        />
      ) : visibleItems.length === 0 ? (
        <div className="hm-card hm-card--p24 hm-card--center">
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            {favoritesOnly ? t("shoppingModule.noFavoriteItems") : t("shoppingModule.noProductsInCategory")}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <ItemSection icon={Flame} title={t("shoppingModule.todaySection")} items={todayItems} onToggle={togglePurchased} onToggleFavorite={toggleFavorite} />
          <ItemSection icon={Clock3} title={t("shoppingModule.laterSection")} items={laterItems} onToggle={togglePurchased} onToggleFavorite={toggleFavorite} />
          <FrequentSuggestions suggestions={frequentSuggestions} onAdd={addFrequentSuggestion} />
          <ItemSection icon={Check} title={t("shoppingModule.purchasedSection")} items={completedItems} onToggle={togglePurchased} onToggleFavorite={toggleFavorite} muted />
        </div>
      )}
    </div>
  );
}
