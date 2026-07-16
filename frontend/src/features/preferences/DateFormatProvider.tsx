import { useState } from 'react';
import type { ReactNode } from 'react';
import { DateFormatPreferenceContext } from './dateFormatPreference';
import type { DateFormatPreference } from './dateFormatPreference';

type DateFormatPreferenceProviderProps = {
  children: ReactNode;
};

const DATE_FORMAT_STORAGE_KEY = 'applyfill.date-format';

const inferDateFormat = (): DateFormatPreference => {
  const parts = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(new Date(2020, 10, 22));
  const monthIndex = parts.findIndex((part) => part.type === 'month');
  const dayIndex = parts.findIndex((part) => part.type === 'day');

  return dayIndex >= 0 && monthIndex >= 0 && dayIndex < monthIndex
    ? 'DD/MM/YYYY'
    : 'MM/DD/YYYY';
};

const readDateFormat = (): DateFormatPreference => {
  const storedFormat = localStorage.getItem(DATE_FORMAT_STORAGE_KEY);
  return storedFormat === 'MM/DD/YYYY' || storedFormat === 'DD/MM/YYYY'
    ? storedFormat
    : inferDateFormat();
};

export function DateFormatPreferenceProvider({ children }: DateFormatPreferenceProviderProps) {
  const [dateFormat, setDateFormatState] = useState<DateFormatPreference>(readDateFormat);

  const setDateFormat = (format: DateFormatPreference) => {
    localStorage.setItem(DATE_FORMAT_STORAGE_KEY, format);
    setDateFormatState(format);
  };

  return (
    <DateFormatPreferenceContext.Provider value={{ dateFormat, setDateFormat }}>
      {children}
    </DateFormatPreferenceContext.Provider>
  );
}
