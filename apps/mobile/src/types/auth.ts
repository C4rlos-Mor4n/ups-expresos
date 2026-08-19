export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: "STUDENT" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  emailVerified: boolean;
  isActive: boolean;
}