const pad = (value: number) => String(value).padStart(2, '0');

export const formatExactDateValue = (date: Date) => (
  `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`
);

export const normalizeExactDateValue = (value: string) => {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!isoMatch) return value;

  return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
};
