import api from "../api/client";

export interface RequestCodeResponse {
  message: string;
  devCode?: string; // Solo en desarrollo
}

export interface VerifyCodeResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    emailVerified: boolean;
    isActive: boolean;
  };
}

export const authService = {
  /**
   * Solicita el envío de un código OTP al correo.
   * @param email Correo institucional
   */
  requestCode: async (email: string): Promise<RequestCodeResponse> => {
    const response = await api.post<RequestCodeResponse>('/auth/request-code', { email });
    return response.data;
  },

  /**
   * Verifica el código OTP y obtiene los tokens de sesión.
   * @param email Correo institucional
   * @param code Código de 6 dígitos
   */
  verifyCode: async (email: string, code: string): Promise<VerifyCodeResponse> => {
    const response = await api.post<VerifyCodeResponse>('/auth/verify-code', { email, code });
    return response.data;
  },

  refreshTokens: async (refreshToken: string): Promise<VerifyCodeResponse> => {
    const response = await api.post<VerifyCodeResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  logout: async (refreshToken: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/logout', { refreshToken });
    return response.data;
  },

  getMe: async (): Promise<VerifyCodeResponse['user']> => {
    const response = await api.get<VerifyCodeResponse['user']>('/auth/me');
    return response.data;
  },
};