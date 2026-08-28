import { fuzzyMatchAny } from "../../utils/textMatch";
import { categoryLabel } from "../economy/economyCategories";

/**
 * Motor del buscador global: sin React, sin red, sin IA — solo construye un
 * índice plano a partir de las colecciones ya cargadas en la app y lo
 * filtra por texto. `getPath` se recibe por parámetro (en vez de
 * importarse) porque solo App.jsx tiene la jerarquía habitación/zona/caja
 * necesaria para construir la ruta de objetos y cajas; así este módulo no
 * depende de App.jsx y es fácil de testear en aislamiento.
 */
export function buildSearchIndex(state, { bills = [], members = [], canSeeEconomy = true, getPath, t } = {}) {
  const billCategory = (value) => (t ? categoryLabel(value, t) : value);
  const index = [];
  const path = (entity) => (getPath ? getPath(entity) : []);

  (state.objects || []).forEach((o) => {
    const p = path(o);
    index.push({
      type: "object",
      id: o.id,
      title: o.name,
      subtitle: p.join(" · ") || null,
      path: p,
      searchable: [o.name, o.description, o.notes, o.category, ...p],
      raw: o,
    });
  });

  (state.rooms || []).forEach((r) => {
    index.push({
      type: "room",
      id: r.id,
      title: r.name,
      subtitle: null,
      path: [r.name],
      searchable: [r.name],
      raw: r,
    });
  });

  (state.containers || []).forEach((c) => {
    const p = path(c);
    index.push({
      type: "container",
      id: c.id,
      title: c.name,
      subtitle: p.join(" · ") || null,
      path: p,
      searchable: [c.name, ...p],
      raw: c,
    });
  });

  (state.tasks || []).forEach((task) => {
    index.push({
      type: "task",
      id: task.id,
      title: task.title,
      subtitle: task.assignee || null,
      path: null,
      searchable: [task.title, task.description, task.assignee],
      raw: task,
    });
  });

  (state.shoppingItems || []).forEach((item) => {
    index.push({
      type: "shopping",
      id: item.id,
      title: item.name,
      subtitle: item.category || null,
      path: null,
      searchable: [item.name, item.category, item.notes],
      raw: item,
    });
  });

  // Los niños no ven economía (mismo permiso que el resto de la app), así
  // que ni siquiera se indexan sus facturas.
  if (canSeeEconomy) {
    bills.forEach((bill) => {
      index.push({
        type: "bill",
        id: bill.id,
        title: bill.name,
        subtitle: bill.category ? billCategory(bill.category) : null,
        path: null,
        searchable: [bill.name, bill.category, billCategory(bill.category), bill.notes],
        raw: bill,
      });
    });
  }

  members.forEach((member) => {
    index.push({
      type: "member",
      id: member.user_id || member.id,
      title: member.name,
      subtitle: member.email || null,
      path: null,
      searchable: [member.name, member.email],
      raw: member,
    });
  });

  return index;
}

const CATEGORY_ORDER = ["object", "room", "container", "task", "shopping", "bill", "member"];
const MAX_PER_CATEGORY = 6;

/**
 * Filtra el índice por texto y agrupa por categoría en un orden fijo. Cada
 * grupo se recorta a MAX_PER_CATEGORY: con cientos de objetos, mostrar todo
 * no ayuda a leer más rápido y sí hace más lento el render en cada tecla.
 * `total` conserva el conteo real para poder decir "y N más".
 */
export function searchGrouped(index, query) {
  const q = (query || "").trim();
  if (!q) return [];

  const matches = index.filter((entry) => fuzzyMatchAny(entry.searchable, q));

  return CATEGORY_ORDER
    .map((type) => {
      const items = matches.filter((m) => m.type === type);
      return { type, items: items.slice(0, MAX_PER_CATEGORY), total: items.length };
    })
    .filter((group) => group.items.length > 0);
}
