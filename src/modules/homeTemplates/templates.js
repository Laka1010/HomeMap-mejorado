/**
 * Definición declarativa de las plantillas de hogar. Añadir una plantilla
 * nueva = un objeto más en HOME_TEMPLATES (ningún componente ni servicio
 * necesita tocarse). Los nombres de habitaciones/tareas/listas se guardan
 * como claves i18n (no texto fijo) — quien las use debe resolverlas con
 * t() antes de insertarlas, ver applyTemplate.js.
 *
 * `icon` reutiliza las keys existentes de ROOM_ICONS (src/App.jsx) cuando
 * hay una equivalencia clara (salon/cocina/habitacion/bano/trastero/garaje/
 * oficina). Las keys nuevas (comedor/jardin/lavanderia/estudio/recepcion/
 * reunion) no están en ROOM_ICONS todavía, así que caen al icono genérico
 * de casa — semánticamente correctas ya, visualmente se pueden afinar más
 * adelante sin tocar esta plantilla.
 */

const C = "homeTemplates.content.";

export const HOME_TEMPLATES = [
  {
    id: "apartment",
    emoji: "🏢",
    color: "#4C7A8B",
    nameKey: "homeTemplates.apartment.name",
    descKey: "homeTemplates.apartment.desc",
    rooms: [
      { nameKey: C + "livingRoom", icon: "salon" },
      { nameKey: C + "kitchen", icon: "cocina" },
      { nameKey: C + "bedroom", icon: "habitacion" },
      { nameKey: C + "bathroom", icon: "bano" },
      { nameKey: C + "storage", icon: "trastero" },
    ],
    tasks: [
      { titleKey: C + "takeOutTrash" },
      { titleKey: C + "vacuum" },
      { titleKey: C + "cleanBathroom" },
    ],
    shoppingLists: [
      { nameKey: C + "groceries" },
      { nameKey: C + "householdSupplies" },
    ],
    categories: null,
  },
  {
    id: "house",
    emoji: "🏡",
    color: "#6B7A5E",
    nameKey: "homeTemplates.house.name",
    descKey: "homeTemplates.house.desc",
    rooms: [
      { nameKey: C + "livingRoom", icon: "salon" },
      { nameKey: C + "kitchen", icon: "cocina" },
      { nameKey: C + "diningRoom", icon: "comedor" },
      { nameKey: C + "masterBedroom", icon: "habitacion" },
      { nameKey: C + "bedroom2", icon: "habitacion" },
      { nameKey: C + "bedroom3", icon: "habitacion" },
      { nameKey: C + "bathroom", icon: "bano" },
      { nameKey: C + "garage", icon: "garaje" },
      { nameKey: C + "garden", icon: "jardin" },
      { nameKey: C + "laundryRoom", icon: "lavanderia" },
      { nameKey: C + "storage", icon: "trastero" },
    ],
    tasks: [
      { titleKey: C + "cleanKitchen" },
      { titleKey: C + "takeOutTrash" },
      { titleKey: C + "waterPlants" },
      { titleKey: C + "laundryTask" },
    ],
    shoppingLists: [
      { nameKey: C + "groceries" },
      { nameKey: C + "cleaning" },
      { nameKey: C + "diy" },
    ],
    categories: null,
  },
  {
    id: "office",
    emoji: "💼",
    color: "#3D5A80",
    nameKey: "homeTemplates.office.name",
    descKey: "homeTemplates.office.desc",
    rooms: [
      { nameKey: C + "reception", icon: "recepcion" },
      { nameKey: C + "officeRoom", icon: "oficina" },
      { nameKey: C + "meetingRoom", icon: "reunion" },
      { nameKey: C + "storage", icon: "trastero" },
      { nameKey: C + "kitchen", icon: "cocina" },
    ],
    tasks: [],
    shoppingLists: [],
    categories: [C + "equipment", C + "furniture", C + "supplies"],
  },
  {
    id: "student",
    emoji: "🎓",
    color: "#C98A3E",
    nameKey: "homeTemplates.student.name",
    descKey: "homeTemplates.student.desc",
    rooms: [
      { nameKey: C + "bedroom", icon: "habitacion" },
      { nameKey: C + "kitchen", icon: "cocina" },
      { nameKey: C + "bathroom", icon: "bano" },
      { nameKey: C + "studyArea", icon: "estudio" },
    ],
    tasks: [],
    shoppingLists: [
      { nameKey: C + "groceries" },
      { nameKey: C + "university" },
      { nameKey: C + "cleaning" },
    ],
    categories: null,
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    color: "#8E5B72",
    nameKey: "homeTemplates.family.name",
    descKey: "homeTemplates.family.desc",
    rooms: [
      { nameKey: C + "livingRoom", icon: "salon" },
      { nameKey: C + "kitchen", icon: "cocina" },
      { nameKey: C + "diningRoom", icon: "comedor" },
      { nameKey: C + "bedroom", icon: "habitacion" },
      { nameKey: C + "bathroom", icon: "bano" },
      { nameKey: C + "garden", icon: "jardin" },
      { nameKey: C + "storage", icon: "trastero" },
    ],
    tasks: [
      { titleKey: C + "takeOutTrash" },
      { titleKey: C + "vacuum" },
      { titleKey: C + "cleanBathroom" },
      { titleKey: C + "waterPlants" },
    ],
    shoppingLists: [
      { nameKey: C + "groceries" },
      { nameKey: C + "cleaning" },
      { nameKey: C + "householdSupplies" },
    ],
    categories: null,
    // Nota mostrada en el preview, no crea nada por sí misma (Members ya
    // funciona vía código de invitación existente — ver houseService.js).
    highlightNoteKey: "homeTemplates.family.previewNote",
  },
  {
    id: "custom",
    emoji: "🎨",
    color: "#8B6B4C",
    nameKey: "homeTemplates.custom.name",
    descKey: "homeTemplates.custom.desc",
    isCustom: true,
    rooms: [],
    tasks: [],
    shoppingLists: [],
    categories: null,
  },
];

export function getTemplateById(id) {
  return HOME_TEMPLATES.find((tpl) => tpl.id === id) || null;
}
