import type { CSSProperties } from "react";

type UiIconName =
  | "wallet"
  | "level"
  | "gift"
  | "spark"
  | "gamepad"
  | "chevron-down"
  | "chevron-up"
  | "close"
  | "plus";

type UiIconProps = {
  name: UiIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

function resolvePath(name: UiIconName) {
  switch (name) {
    case "wallet":
      return (
        <>
          <path d="M3 8.5h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 8.5V7a2 2 0 0 1 1.6-2l10.8-2.4A1.5 1.5 0 0 1 17 4v4.5" />
          <path d="M21 12h-4a1.5 1.5 0 0 0 0 3h4z" />
        </>
      );
    case "level":
      return (
        <>
          <path d="M4 18V9.5a2.5 2.5 0 0 1 2.5-2.5H17" />
          <path d="M7 18V6.5a2.5 2.5 0 0 1 2.5-2.5H20" />
          <path d="M4 18h16" />
          <path d="M14 11l2 2 4-4" />
        </>
      );
    case "gift":
      return (
        <>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M12 8v13" />
          <path d="M3 13h18" />
          <path d="M12 8c-2.7 0-4-1.3-4-3a2.5 2.5 0 0 1 4-2c1.1.8 1.7 2 2 5" />
          <path d="M12 8c2.7 0 4-1.3 4-3a2.5 2.5 0 0 0-4-2c-1.1.8-1.7 2-2 5" />
        </>
      );
    case "spark":
      return (
        <>
          <path d="M12 2l2.2 5.7L20 10l-5.8 2.3L12 18l-2.2-5.7L4 10l5.8-2.3z" />
          <path d="M18.5 2.5v3" />
          <path d="M20 4h-3" />
          <path d="M4.5 16.5v3" />
          <path d="M6 18h-3" />
        </>
      );
    case "gamepad":
      return (
        <>
          <path d="M7 10h10a4 4 0 0 1 3.9 3.2l.7 3.2a2.5 2.5 0 0 1-3.9 2.6l-2.7-1.9a2 2 0 0 0-2.3 0l-1.6 1.1a2 2 0 0 1-2.2 0l-1.6-1.1a2 2 0 0 0-2.3 0l-2.7 1.9a2.5 2.5 0 0 1-3.9-2.6l.7-3.2A4 4 0 0 1 7 10z" />
          <path d="M8 14h4" />
          <path d="M10 12v4" />
          <circle cx="16.2" cy="13.8" r="1" />
          <circle cx="18.4" cy="16" r="1" />
        </>
      );
    case "chevron-down":
      return <path d="M6 9l6 6 6-6" />;
    case "chevron-up":
      return <path d="M18 15l-6-6-6 6" />;
    case "close":
      return (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      );
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    default:
      return null;
  }
}

export default function UiIcon({ name, size = 16, className, style }: UiIconProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {resolvePath(name)}
    </svg>
  );
}
