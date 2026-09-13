import { Dumbbell, BookOpen, Trees, Wine, Palette, Music } from "lucide-react";

/**
 * Conjuntos de iconos Premium por dominio (sección 8 del pedido: "crear un
 * conjunto inicial de iconos Premium adicionales... preparado para poder
 * añadir más posteriormente sin modificar la arquitectura"). Misma forma
 * {key, emoji, icon} que las opciones gratuitas ya existentes (ver
 * ROOM_ICON_OPTIONS_BASE en AddRoomWizard.jsx) para que IconPicker.jsx trate
 * ambos conjuntos de forma idéntica -- añadir un dominio nuevo (cajas,
 * objetos, categorías...) es solo exportar un array más con esta forma,
 * nunca tocar IconPicker.
 */
export const ROOM_ICON_OPTIONS_PREMIUM = [
  { key: "gimnasio", emoji: "🏋️", icon: Dumbbell },
  { key: "biblioteca", emoji: "📚", icon: BookOpen },
  { key: "terraza", emoji: "🌳", icon: Trees },
  { key: "bodega", emoji: "🍷", icon: Wine },
  { key: "estudio", emoji: "🎨", icon: Palette },
  { key: "musica", emoji: "🎵", icon: Music },
];
