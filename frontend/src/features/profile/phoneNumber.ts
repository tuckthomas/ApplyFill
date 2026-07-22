export const PHONE_DIGIT_COUNT = 11;

export const getPhoneDigits = (value: string) => value.replace(/\D/g, '').slice(0, PHONE_DIGIT_COUNT);

export const normalizePhoneNumber = (value: string) => {
  const digits = getPhoneDigits(value);
  return digits.length === PHONE_DIGIT_COUNT ? `+${digits}` : '';
};

export const isStoredPhoneNumber = (value: string) => value === '' || /^\+\d{11}$/.test(value);

export const formatPhoneNumber = (value: string) => {
  const digits = getPhoneDigits(value);
  if (!digits) return '';

  const countryCode = digits.slice(0, 1);
  const areaCode = digits.slice(1, 4);
  const exchange = digits.slice(4, 7);
  const subscriber = digits.slice(7, 11);

  let formatted = `+${countryCode}`;
  if (areaCode) formatted += ` (${areaCode}`;
  if (areaCode.length === 3) formatted += ')';
  if (exchange) formatted += ` ${exchange}`;
  if (subscriber) formatted += `-${subscriber}`;
  return formatted;
};

export const isIncompletePhoneNumber = (value: string) => {
  const digitCount = getPhoneDigits(value).length;
  return digitCount > 0 && digitCount < PHONE_DIGIT_COUNT;
};
