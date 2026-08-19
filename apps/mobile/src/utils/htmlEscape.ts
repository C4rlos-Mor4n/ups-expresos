// Escapa caracteres sensibles a HTML. Se usa antes de insertar valores
// (nombres de paradas, referencias) dentro de strings HTML en el WebView.
export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Versión JavaScript autónoma que se inyecta en el bloque <script> del WebView
// para escapar los mismos caracteres en tiempo de ejecución. Mantiene el mismo
// comportamiento que escapeHtml (misma tabla de entidades).
export const ESCAPE_HTML_JS = `
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
`;
