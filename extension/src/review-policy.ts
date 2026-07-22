import { type ReviewItem, isSensitiveSemantic } from './contracts';

export function reviewInputType(item: Pick<ReviewItem, 'semantic'>): 'password' | 'text' {
  return isSensitiveSemantic(item.semantic) ? 'password' : 'text';
}

export function sensitiveConfirmationFieldIds(items: ReviewItem[], selectedFieldIds: Set<string>): string[] {
  return items
    .filter((item) => selectedFieldIds.has(item.field.id) && isSensitiveSemantic(item.semantic))
    .map((item) => item.field.id);
}
