export type NoticeSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

// Shape real de GET /mobile/notices (el endpoint mobile no devuelve
// isActive / createdAt / updatedAt; esos pertenecen al DTO admin).
export interface Notice {
  id: string;
  title: string;
  message: string;
  severity: NoticeSeverity;
  publishedFrom: string;
  publishedUntil: string | null;
}
