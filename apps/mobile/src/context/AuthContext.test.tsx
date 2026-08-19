import React, { useEffect } from "react";
import { create, act } from "react-test-renderer";
import * as SecureStore from "expo-secure-store";
import { AuthProvider, useAuth } from "./AuthContext";
import { authService } from "../services/auth.service";
import { AuthUser } from "@/types/auth";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../services/auth.service", () => ({
  authService: {
    logout: jest.fn(),
    getMe: jest.fn(),
  },
}));

jest.mock("../api/client", () => ({
  setOnSessionExpired: jest.fn(),
  setOnTokensRotated: jest.fn(),
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockLogout = authService.logout as jest.Mock;
const mockGetMe = authService.getMe as jest.Mock;

const user: AuthUser = {
  id: "u1",
  email: "student@est.ups.edu.ec",
  name: null,
  role: "STUDENT",
  emailVerified: true,
  isActive: true,
};

// Harness que expone logout para dispararlo bajo demanda. La asignación se hace
// en un effect (no durante el render) para no violar la pureza de los componentes.
const logoutRef: { current: (() => Promise<void>) | null } = { current: null };
function Harness() {
  const { logout } = useAuth();
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);
  return null;
}

describe("AuthContext logout after token rotation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logoutRef.current = null;
    mockGetMe.mockResolvedValue(user);
    mockLogout.mockResolvedValue({ message: "Logged out" });
    // El refresh token vigente en SecureStore (rotado por el cliente HTTP).
    mockGetItem.mockImplementation((key: string) => {
      if (key === "refresh_token") return Promise.resolve("R2");
      if (key === "access_token") return Promise.resolve("A2");
      if (key === "user") return Promise.resolve(JSON.stringify(user));
      return Promise.resolve(null);
    });
  });

  it("logs out using the current refresh token persisted in SecureStore, not stale state", async () => {
    await act(async () => {
      create(
        <AuthProvider>
          <Harness />
        </AuthProvider>
      );
    });

    // El estado React podría quedar stale (R1) tras un refresh, pero el valor
    // vigente en SecureStore es R2. logout debe enviar R2, no R1.
    expect(logoutRef.current).toBeTruthy();
    await act(async () => {
      await logoutRef.current!();
    });

    expect(mockLogout).toHaveBeenCalledWith("R2");
    expect(mockLogout).not.toHaveBeenCalledWith("R1");
    expect(mockDeleteItem).toHaveBeenCalledWith("access_token");
    expect(mockDeleteItem).toHaveBeenCalledWith("refresh_token");
    expect(mockDeleteItem).toHaveBeenCalledWith("user");
  });

  it("clears the local session even when backend logout fails", async () => {
    mockLogout.mockRejectedValue(new Error("network down"));

    await act(async () => {
      create(
        <AuthProvider>
          <Harness />
        </AuthProvider>
      );
    });

    await act(async () => {
      await logoutRef.current!();
    });

    expect(mockLogout).toHaveBeenCalledWith("R2");
    expect(mockDeleteItem).toHaveBeenCalledWith("refresh_token");
  });

  it("does not crash when there is no session", async () => {
    mockGetItem.mockResolvedValue(null);

    await act(async () => {
      create(
        <AuthProvider>
          <Harness />
        </AuthProvider>
      );
    });

    await act(async () => {
      await logoutRef.current!();
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockDeleteItem).toHaveBeenCalledWith("refresh_token");
  });
});
