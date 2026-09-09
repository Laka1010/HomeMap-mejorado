import { describe, it, expect } from "vitest";
import { buildSearchIndex, searchGrouped } from "../modules/search/searchEngine";

const state = {
  objects: [
    { id: "o1", name: "Cargador USB-C", description: "del portátil", category: "Electrónica" },
    { id: "o2", name: "Taladro" },
  ],
  rooms: [{ id: "r1", name: "Cocina" }],
  containers: [{ id: "c1", name: "Caja de herramientas" }],
  tasks: [{ id: "t1", title: "Comprar bombillas", assignee: "Ana" }],
  shoppingItems: [{ id: "s1", name: "Leche", category: "Lácteos" }],
};

const getPath = (entity) => (entity.id === "o1" ? ["Casa", "Salón"] : []);

describe("buildSearchIndex", () => {
  it("indexes every collection with a stable shape", () => {
    const index = buildSearchIndex(state, { getPath });
    expect(index.map((e) => e.type).sort()).toEqual(
      ["container", "object", "object", "room", "shopping", "task"].sort(),
    );
    const charger = index.find((e) => e.id === "o1");
    expect(charger.subtitle).toBe("Casa · Salón");
    expect(charger.path).toEqual(["Casa", "Salón"]);
  });

  it("omits bills when canSeeEconomy is false", () => {
    const bills = [{ id: "b1", name: "Factura de la luz" }];
    const withEconomy = buildSearchIndex(state, { bills, canSeeEconomy: true });
    const withoutEconomy = buildSearchIndex(state, { bills, canSeeEconomy: false });
    expect(withEconomy.some((e) => e.type === "bill")).toBe(true);
    expect(withoutEconomy.some((e) => e.type === "bill")).toBe(false);
  });

  it("includes members when provided", () => {
    const index = buildSearchIndex(state, { members: [{ user_id: "u1", name: "Ana", email: "ana@x.com" }] });
    const member = index.find((e) => e.type === "member");
    expect(member.title).toBe("Ana");
    expect(member.subtitle).toBe("ana@x.com");
  });
});

describe("searchGrouped", () => {
  const index = buildSearchIndex(state, { getPath });

  it("returns [] for an empty query", () => {
    expect(searchGrouped(index, "")).toEqual([]);
    expect(searchGrouped(index, "   ")).toEqual([]);
  });

  it("matches accent-insensitively across fields and groups by category", () => {
    const groups = searchGrouped(index, "electronica");
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("object");
    expect(groups[0].items[0].id).toBe("o1");
  });

  it("keeps a real total even when the group is capped at 6", () => {
    const many = {
      objects: Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, name: `Tornillo ${i}` })),
    };
    const [group] = searchGrouped(buildSearchIndex(many, {}), "tornillo");
    expect(group.items).toHaveLength(6);
    expect(group.total).toBe(9);
  });

  it("orders groups object → room → container → task → shopping", () => {
    const groups = searchGrouped(buildSearchIndex(
      { ...state, objects: [{ id: "o1", name: "cocina lenta" }], rooms: [{ id: "r1", name: "Cocina" }] },
      {},
    ), "cocina");
    expect(groups.map((g) => g.type)).toEqual(["object", "room"]);
  });
});
