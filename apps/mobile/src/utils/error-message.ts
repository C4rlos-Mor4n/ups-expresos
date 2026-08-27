import { isAxiosError } from "axios";

const NETWORK_MESSAGE =
  "No pudimos conectarnos al servidor. Verifica tu conexión e intenta nuevamente.";

/**
 * Convierte un error desconocido en un mensaje humano, distinguiendo:
 * - Errores HTTP con respuesta del servidor (4xx/5xx): usa el mensaje del backend
 *   cuando existe, o un mensaje genérico según el status.
 * - Errores de red / timeout / sin respuesta: mensaje de conexión.
 */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const backendMessage = error.response.data?.message;
      if (typeof backendMessage === "string" && backendMessage.length > 0) {
        return backendMessage;
      }
      if (status === 404) return "El recurso solicitado no existe.";
      if (status === 403) return "No tienes permisos para realizar esta acción.";
      if (status >= 500) return "Ocurrió un error en el servidor. Intenta nuevamente más tarde.";
      return "No se pudo completar la solicitud.";
    }
    // Sin response: timeout, offline, DNS, etc.
    return NETWORK_MESSAGE;
  }
  return NETWORK_MESSAGE;
}

export { NETWORK_MESSAGE };