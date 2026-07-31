/**
 * Catálogo curado usado por el paso "Custom" del asistente de plantillas
 * (checkboxes, ver WelcomeGate.jsx: CustomBuilderStep). No es texto libre a
 * propósito: mantiene acotado lo que una casa nueva puede sembrar antes de
 * existir siquiera. Reutiliza las mismas claves i18n que las plantillas
 * fijas (templates.js) para no duplicar traducciones.
 */

const C = "homeTemplates.content.";

export const CUSTOM_ROOM_CATALOG = [
  { id: "livingRoom", nameKey: C + "livingRoom", icon: "salon" },
  { id: "kitchen", nameKey: C + "kitchen", icon: "cocina" },
  { id: "diningRoom", nameKey: C + "diningRoom", icon: "comedor" },
  { id: "bedroom", nameKey: C + "bedroom", icon: "habitacion" },
  { id: "masterBedroom", nameKey: C + "masterBedroom", icon: "habitacion" },
  { id: "bathroom", nameKey: C + "bathroom", icon: "bano" },
  { id: "storage", nameKey: C + "storage", icon: "trastero" },
  { id: "garage", nameKey: C + "garage", icon: "garaje" },
  { id: "garden", nameKey: C + "garden", icon: "jardin" },
  { id: "laundryRoom", nameKey: C + "laundryRoom", icon: "lavanderia" },
  { id: "studyArea", nameKey: C + "studyArea", icon: "estudio" },
  { id: "officeRoom", nameKey: C + "officeRoom", icon: "oficina" },
];

export const CUSTOM_TASK_CATALOG = [
  { id: "takeOutTrash", titleKey: C + "takeOutTrash" },
  { id: "vacuum", titleKey: C + "vacuum" },
  { id: "cleanBathroom", titleKey: C + "cleanBathroom" },
  { id: "cleanKitchen", titleKey: C + "cleanKitchen" },
  { id: "waterPlants", titleKey: C + "waterPlants" },
  { id: "laundryTask", titleKey: C + "laundryTask" },
];

export const CUSTOM_LIST_CATALOG = [
  { id: "groceries", nameKey: C + "groceries" },
  { id: "householdSupplies", nameKey: C + "householdSupplies" },
  { id: "cleaning", nameKey: C + "cleaning" },
  { id: "diy", nameKey: C + "diy" },
  { id: "university", nameKey: C + "university" },
];

export const CUSTOM_CATEGORY_CATALOG = [
  { id: "equipment", nameKey: C + "equipment" },
  { id: "furniture", nameKey: C + "furniture" },
  { id: "supplies", nameKey: C + "supplies" },
  { id: "categoryOther", nameKey: C + "categoryOther" },
];
