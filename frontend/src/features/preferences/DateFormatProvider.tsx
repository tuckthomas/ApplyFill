import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DateFormatPreferenceContext } from './dateFormatPreference';
import type { DateFormatPreference } from './dateFormatPreference';
import { loadSetting, saveSetting } from './settingsRepository';

type DateFormatPreferenceProviderProps = {
  children: ReactNode;
};

type DateFormatSettingDocument = {
  value: DateFormatPreference;
};

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

const isDateFormatPreference = (value: unknown): value is DateFormatPreference => (
  value === 'MM/DD/YYYY' || value === 'DD/MM/YYYY'
);

export function DateFormatPreferenceProvider({ children }: DateFormatPreferenceProviderProps) {
  const [dateFormat, setDateFormatState] = useState<DateFormatPreference>(inferDateFormat);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const saveVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    void loadSetting<DateFormatSettingDocument>('date-format', controller.signal)
      .then((setting) => {
        if (setting && isDateFormatPreference(setting.content.value)) {
          setDateFormatState(setting.content.value);
        }
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error
          ? loadError.message
          : 'ApplyFill could not load your date choice. Keep ApplyFill open, then try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const setDateFormat = (format: DateFormatPreference) => {
    const previousFormat = dateFormat;
    const version = saveVersion.current + 1;
    saveVersion.current = version;
    setError('');
    setDateFormatState(format);
    void saveSetting('date-format', 1, { value: format } satisfies DateFormatSettingDocument).catch((saveError) => {
      if (saveVersion.current !== version) return;
      setDateFormatState(previousFormat);
      setError(saveError instanceof Error
        ? saveError.message
        : 'ApplyFill could not save your date choice. Keep ApplyFill open, then try again.');
    });
  };

  return (
    <DateFormatPreferenceContext.Provider value={{
      dateFormat,
      error,
      isLoading,
      retry: () => setReloadKey((value) => value + 1),
      setDateFormat,
    }}>
      {children}
    </DateFormatPreferenceContext.Provider>
  );
}
