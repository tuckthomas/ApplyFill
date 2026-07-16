import type { DateFormatPreference } from '../../features/preferences/dateFormatPreference';

const pad = (value: number) => String(value).padStart(2, '0');

export const formatExactDateValue = (date: Date) => (
  `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`
);

export const normalizeExactDateValue = (value: string) => {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!isoMatch) return value;

  return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
};

const isValidExactDate = (month: number, day: number, year: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

export const formatExactDateForDisplay = (value: string, format: DateFormatPreference) => {
  const normalizedValue = normalizeExactDateValue(value);
  const match = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(normalizedValue);
  if (!match) return value;

  const [, month, day, year] = match;
  return format === 'DD/MM/YYYY'
    ? `${day}/${month}/${year}`
    : `${month}/${day}/${year}`;
};

export const parseExactDateInput = (value: string, format: DateFormatPreference) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const month = format === 'DD/MM/YYYY' ? second : first;
  const day = format === 'DD/MM/YYYY' ? first : second;

  return isValidExactDate(month, day, year)
    ? `${pad(month)}/${pad(day)}/${year}`
    : null;
};
