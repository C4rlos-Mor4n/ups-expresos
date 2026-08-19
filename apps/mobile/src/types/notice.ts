export type NoticeSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Notice {
  id: string;
  title: string;
  message: string;
  severity: NoticeSeverity;
  publishedFrom: string;
  publishedUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
