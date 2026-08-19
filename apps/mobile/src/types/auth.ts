export interface RequestCodeDto {
  email: string;
}

export interface VerifyCodeDto {
  email: string;
  code: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: "STUDENT" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  emailVerified: boolean;
  isActive: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}