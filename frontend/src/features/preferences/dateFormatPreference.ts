import { createContext, useContext } from 'react';

export type DateFormatPreference = 'MM/DD/YYYY' | 'DD/MM/YYYY';

export type DateFormatPreferenceContextValue = {
  dateFormat: DateFormatPreference;
  error: string;
  isLoading: boolean;
  retry: () => void;
  setDateFormat: (format: DateFormatPreference) => void;
};

export const DateFormatPreferenceContext = createContext<DateFormatPreferenceContextValue | null>(null);

export const useDateFormatPreference = () => {
  const context = useContext(DateFormatPreferenceContext);
  if (!context) throw new Error('useDateFormatPreference must be used within DateFormatPreferenceProvider.');
  return context;
};
