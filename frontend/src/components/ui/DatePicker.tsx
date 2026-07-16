import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDateFormatPreference } from '../../features/preferences/dateFormatPreference';
import {
  formatExactDateForDisplay,
  formatExactDateValue,
  normalizeExactDateValue,
  parseExactDateInput
} from './datePickerUtils';

export type DatePrecision = 'Exact' | 'Estimated';

type DatePickerProps = {
  ariaLabel: string;
  disabled?: boolean;
  id: string;
  onChange: (value: string) => void;
  placeholder?: string;
  precision: DatePrecision;
  required?: boolean;
  value: string;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (value: number) => String(value).padStart(2, '0');

const parseDateValue = (value: string, precision: DatePrecision) => {
  const exactMatch = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(value);
  const estimatedMatch = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);

  if (precision === 'Exact' && exactMatch) {
    const date = new Date(Number(exactMatch[3]), Number(exactMatch[1]) - 1, Number(exactMatch[2]));
    return date.getFullYear() === Number(exactMatch[3])
      && date.getMonth() === Number(exactMatch[1]) - 1
      && date.getDate() === Number(exactMatch[2])
      ? date
      : null;
  }

  if (precision === 'Estimated' && estimatedMatch) {
    return new Date(Number(estimatedMatch[2]), Number(estimatedMatch[1]) - 1, 1);
  }

  return null;
};

const getInitialViewDate = (value: string, precision: DatePrecision) => (
  parseDateValue(precision === 'Exact' ? normalizeExactDateValue(value) : value, precision)
    ?? new Date()
);

export default function DatePicker({
  ariaLabel,
  disabled = false,
  id,
  onChange,
  placeholder,
  precision,
  required = false,
  value
}: DatePickerProps) {
  const { dateFormat } = useDateFormatPreference();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => getInitialViewDate(value, precision));
  const normalizedValue = precision === 'Exact' ? normalizeExactDateValue(value) : value;
  const selectedDate = parseDateValue(normalizedValue, precision);
  const displayValue = precision === 'Exact'
    ? formatExactDateForDisplay(normalizedValue, dateFormat)
    : normalizedValue;
  const displayPlaceholder = placeholder ?? (precision === 'Exact' ? dateFormat : 'MM/YYYY');

  useEffect(() => {
    setViewDate(getInitialViewDate(value, precision));
  }, [precision, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const changeMonth = (amount: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const selectExactDate = (date: Date) => {
    onChange(formatExactDateValue(date));
    setViewDate(date);
    setIsOpen(false);
  };

  const selectEstimatedMonth = (month: number) => {
    onChange(`${pad(month + 1)}/${viewDate.getFullYear()}`);
    setIsOpen(false);
  };

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const firstVisibleDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      1 - firstDayOfMonth.getDay()
    );

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstVisibleDate);
      date.setDate(firstVisibleDate.getDate() + index);
      return date;
    });
  }, [viewDate]);

  const isSameDay = (left: Date | null, right: Date) => Boolean(
    left
      && left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate()
  );

  return (
    <div className="date-picker" ref={pickerRef}>
      <div className={`date-picker-control ${disabled ? 'date-picker-control-disabled' : ''}`}>
        <input
          aria-label={ariaLabel}
          aria-required={required || undefined}
          autoComplete="off"
          className="date-picker-input"
          disabled={disabled}
          id={id}
          inputMode="numeric"
          maxLength={precision === 'Exact' ? 10 : 7}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(precision === 'Exact'
              ? parseExactDateInput(nextValue, dateFormat) ?? nextValue
              : nextValue);
          }}
          placeholder={displayPlaceholder}
          required={required}
          type="text"
          value={displayValue}
        />
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`Open ${ariaLabel} calendar`}
          className="date-picker-trigger"
          data-tooltip={`Open ${ariaLabel} calendar`}
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <CalendarDays size={19} aria-hidden="true" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="date-picker-popover" role="dialog" aria-label={`${ariaLabel} picker`}>
          <div className="date-picker-header">
            <button
              className="date-picker-nav-button"
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label={precision === 'Estimated' ? 'Previous year' : 'Previous month'}
              data-tooltip={precision === 'Estimated' ? 'Previous year' : 'Previous month'}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <strong aria-live="polite">
              {precision === 'Estimated'
                ? viewDate.getFullYear()
                : `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`}
            </strong>
            <button
              className="date-picker-nav-button"
              type="button"
              onClick={() => changeMonth(1)}
              aria-label={precision === 'Estimated' ? 'Next year' : 'Next month'}
              data-tooltip={precision === 'Estimated' ? 'Next year' : 'Next month'}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {precision === 'Estimated' ? (
            <div className="date-picker-month-grid" role="grid" aria-label="Choose month">
              {MONTH_NAMES.map((month, index) => {
                const isSelected = selectedDate?.getFullYear() === viewDate.getFullYear()
                  && selectedDate.getMonth() === index;

                return (
                  <button
                    className={`date-picker-month ${isSelected ? 'date-picker-selected' : ''}`}
                    key={month}
                    onClick={() => selectEstimatedMonth(index)}
                    type="button"
                  >
                    {month.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="date-picker-weekdays" aria-hidden="true">
                {WEEKDAY_LABELS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="date-picker-day-grid" role="grid" aria-label="Choose day">
                {calendarDays.map((date) => {
                  const isCurrentMonth = date.getMonth() === viewDate.getMonth();
                  const isSelected = isSameDay(selectedDate, date);

                  return (
                    <button
                      className={`date-picker-day ${isCurrentMonth ? '' : 'date-picker-day-outside'} ${isSelected ? 'date-picker-selected' : ''}`}
                      key={date.toISOString()}
                      onClick={() => selectExactDate(date)}
                      type="button"
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
