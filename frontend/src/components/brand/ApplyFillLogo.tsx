import { APP_BRAND } from '../../constants/brand';

type ApplyFillLogoProps = {
  showWordmark?: boolean;
};

export function ApplyFillLogo({ showWordmark = true }: ApplyFillLogoProps) {
  return (
    <div className="brand-logo" aria-label={APP_BRAND.name}>
      <svg
        className="brand-logo-mark"
        viewBox="0 0 48 48"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <rect className="brand-logo-panel" x="7" y="5" width="34" height="38" rx="9" />
        <path className="brand-logo-fold" d="M31 5v9c0 1.7 1.3 3 3 3h7" />
        <path className="brand-logo-line" d="M16 19h13" />
        <path className="brand-logo-line" d="M16 26h17" />
        <path className="brand-logo-line" d="M16 33h9" />
        <path className="brand-logo-check" d="M27.5 34.5l4 4 8-10" />
      </svg>
      {showWordmark ? <span className="brand-logo-wordmark">{APP_BRAND.name}</span> : null}
    </div>
  );
}
