// Claves de SecureStore de la sesión. Única fuente: las usan el cliente HTTP
// (renovación de tokens) y AuthContext (login/logout).
export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const USER_KEY = "user";
