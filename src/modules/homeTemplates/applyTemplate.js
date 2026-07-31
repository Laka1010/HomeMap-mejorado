import { homeContentService } from "../../services/homeContentService";
import { taskService } from "../../services/taskService";
import { shoppingListsService } from "../../services/shoppingListsService";
import { categoriesService } from "../../services/categoriesService";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Aplica una plantilla ya resuelta (nombres en texto plano, no claves i18n)
 * a una casa recién creada. `selection` = { rooms, tasks, shoppingLists,
 * categories }, todos opcionales/vacíos para "Empty Home". Se limita a
 * insertar filas reutilizando los servicios existentes (mismo esquema de
 * ids que usa el resto de la app en src/App.jsx) — ninguna tabla ni RPC
 * nueva. Debe llamarse ANTES de cambiar `currentHomeId` para que el fetch
 * de useHomeMapState (src/App.jsx) recoja el contenido en su primera carga.
 *
 * No lanza si una fila individual falla: una plantilla es una ayuda inicial,
 * no una transacción crítica, y el usuario puede añadir/corregir cualquier
 * cosa a mano después.
 */
export async function applyTemplate(houseId, selection) {
  if (!houseId || !selection) return;
  const rooms = selection.rooms || [];
  const tasks = selection.tasks || [];
  const shoppingLists = selection.shoppingLists || [];
  const categories = selection.categories || null;

  const results = await Promise.allSettled([
    ...rooms.map((room) =>
      homeContentService.createRoom(houseId, {
        id: "r-" + uid(),
        name: room.name,
        icon: room.icon || null,
        photo: null,
      }),
    ),
    ...tasks.map((task) =>
      taskService.createTask(houseId, {
        id: "task-" + uid(),
        title: task.title,
        status: "pending",
      }),
    ),
    ...shoppingLists.map((list, index) => shoppingListsService.createList(houseId, list.name, index)),
    ...(categories ? [categoriesService.replaceCategories(houseId, categories)] : []),
  ]);

  results
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.error("Error applying home template:", r.reason));
}
