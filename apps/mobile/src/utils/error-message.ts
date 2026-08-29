import { isAxiosError } from "axios";
import { OperationalContractError } from "@/services/operational-contract";

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

/**
 * Los errores de operación no deben filtrar textos internos como la relación
 * entre una asignación y un conductor. La autorización sigue resolviéndose en
 * el backend; esta capa solo ofrece una explicación útil para la persona.
 */
export function getOperationalErrorMessage(error: unknown): string {
  if (error instanceof OperationalContractError) {
    return "Recibimos información incompleta del servicio. Actualiza e intenta nuevamente.";
  }
  if (isAxiosError(error) && error.response) {
    if (error.response.status === 403) return "No tienes permiso para consultar este servicio.";
    if (error.response.status === 404) return "Este servicio ya no está disponible.";
    if (error.response.status === 409) return "El estado del servicio cambió. Actualiza para ver la información vigente.";
  }
  return getErrorMessage(error);
}

export { NETWORK_MESSAGE };
