import { AxiosError } from "axios";
import { getErrorMessage, getOperationalErrorMessage, NETWORK_MESSAGE } from "./error-message";
import { OperationalContractError } from "@/services/operational-contract";

function makeAxiosError(status: number, message?: string): AxiosError {
  const error = new AxiosError("boom", undefined, undefined, undefined, {
    status,
    data: message ? { message } : {},
    statusText: "error",
    headers: {},
    config: {} as never,
  });
  return error;
}

function makeNetworkError(): AxiosError {
  return new AxiosError("Network Error", undefined, undefined, undefined);
}

describe("getErrorMessage", () => {
  it("returns the backend message for an HTTP error that includes one", () => {
    const err = makeAxiosError(400, "Email domain is not allowed");
    expect(getErrorMessage(err)).toBe("Email domain is not allowed");
  });

  it("returns a server error message for 500 without backend message", () => {
    const err = makeAxiosError(500);
    expect(getErrorMessage(err)).toBe("Ocurrió un error en el servidor. Intenta nuevamente más tarde.");
  });

  it("returns a not found message for 404", () => {
    const err = makeAxiosError(404);
    expect(getErrorMessage(err)).toBe("El recurso solicitado no existe.");
  });

  it("returns the network message for an error without response (offline/timeout)", () => {
    expect(getErrorMessage(makeNetworkError())).toBe(NETWORK_MESSAGE);
  });

  it("returns the network message for non-axios errors", () => {
    expect(getErrorMessage(new Error("boom"))).toBe(NETWORK_MESSAGE);
    expect(getErrorMessage("string error")).toBe(NETWORK_MESSAGE);
  });

  it("keeps operational authorization and malformed payload errors user-safe", () => {
    expect(getOperationalErrorMessage(makeAxiosError(403, "Service assignment does not belong to the authenticated driver"))).toBe("No tienes permiso para consultar este servicio.");
    expect(getOperationalErrorMessage(new OperationalContractError())).toBe("Recibimos información incompleta del servicio. Actualiza e intenta nuevamente.");
  });
});
