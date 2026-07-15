export type EntrySortOrder = 'recent' | 'oldest' | 'alpha-asc' | 'alpha-desc';

export const DEFAULT_ENTRY_SORT_ORDER: EntrySortOrder = 'recent';

export const readEntrySortOrder = (storageKey: string): EntrySortOrder => {
  const storedValue = localStorage.getItem(storageKey);
  return storedValue === 'oldest' || storedValue === 'alpha-asc' || storedValue === 'alpha-desc'
    ? storedValue
    : DEFAULT_ENTRY_SORT_ORDER;
};

type SortableEntryConfig<T> = {
  getEndTime: (entry: T) => number | null;
  getLabel: (entry: T) => string;
  getStartTime: (entry: T) => number | null;
  isDraft: (entry: T) => boolean;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const sortEntries = <T>(entries: T[], order: EntrySortOrder, config: SortableEntryConfig<T>) => (
  entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftIsDraft = config.isDraft(left.entry);
      const rightIsDraft = config.isDraft(right.entry);

      if (leftIsDraft !== rightIsDraft) return leftIsDraft ? -1 : 1;

      if (order === 'alpha-asc' || order === 'alpha-desc') {
        const comparison = collator.compare(config.getLabel(left.entry).trim(), config.getLabel(right.entry).trim());
        if (comparison !== 0) return order === 'alpha-asc' ? comparison : -comparison;
      } else if (order === 'recent') {
        const leftEnd = config.getEndTime(left.entry) ?? Number.NEGATIVE_INFINITY;
        const rightEnd = config.getEndTime(right.entry) ?? Number.NEGATIVE_INFINITY;
        if (leftEnd !== rightEnd) return rightEnd - leftEnd;

        const leftStart = config.getStartTime(left.entry) ?? Number.NEGATIVE_INFINITY;
        const rightStart = config.getStartTime(right.entry) ?? Number.NEGATIVE_INFINITY;
        if (leftStart !== rightStart) return rightStart - leftStart;
      } else {
        const leftStart = config.getStartTime(left.entry) ?? Number.POSITIVE_INFINITY;
        const rightStart = config.getStartTime(right.entry) ?? Number.POSITIVE_INFINITY;
        if (leftStart !== rightStart) return leftStart - rightStart;

        const leftEnd = config.getEndTime(left.entry) ?? Number.POSITIVE_INFINITY;
        const rightEnd = config.getEndTime(right.entry) ?? Number.POSITIVE_INFINITY;
        if (leftEnd !== rightEnd) return leftEnd - rightEnd;
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry)
);
