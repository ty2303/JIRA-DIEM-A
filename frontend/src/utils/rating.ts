import type { Review } from '@/types/review';

export function getAverageRating(items: Review[]) {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, r) => sum + r.rating, 0);
  return Number((total / items.length).toFixed(1));
}
