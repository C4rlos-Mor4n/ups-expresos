// Convierte un valor a JSON seguro para incrustar dentro de un bloque <script>.
// Sin escapado, un dato (p.ej. el nombre de una parada) que contenga "</script>"
// podría cerrar el bloque de script e inyectar HTML/JS arbitrario en el WebView.
export function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
