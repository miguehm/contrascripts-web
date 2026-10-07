// src/types/Script.ts — modelo de persistencia multi-guion (§6 del PLAN.md).
//
// Un guion es `{ id, title, text, updatedAt }`. La lista completa vive en
// localStorage bajo `contrascripts.scripts.v1` y solo `store/` la lee/escribe;
// los componentes acceden vía `useScripts()`.

/** Un guion Fountain editable. */
export interface Script {
  /** Identificador único (ver `newId()` en `src/lib/scripts.ts`). */
  id: string
  /** Título editable; se usa para la lista y para derivar el nombre de archivo. */
  title: string
  /** Texto Fountain completo. */
  text: string
  /** Epoch ms de la última edición; ordena la lista (reciente primero). */
  updatedAt: number
}
