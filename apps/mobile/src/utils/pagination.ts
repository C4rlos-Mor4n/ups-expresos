export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
}

interface Identifiable {
  id: string;
}

// Fusiona una página entrante con las existentes, deduplicando por id y
// calculando si hay más páginas a partir del meta de paginación del backend.
export function appendPage<T extends Identifiable>(
  existing: T[],
  incoming: T[],
  meta: { page: number; totalPages: number },
): PaginatedResult<T> {
  const byId = new Map<string, T>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  const items = Array.from(byId.values());
  return {
    items,
    hasMore: meta.page < meta.totalPages,
  };
}
