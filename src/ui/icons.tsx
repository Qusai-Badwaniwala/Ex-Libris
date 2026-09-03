/**
 * Every icon in the app, copied path-for-path from design/Ex Libris.dc.html.
 *
 * They are components rather than an icon font or a library because the design
 * drew them at specific sizes with a specific 1.25 stroke, and a substituted
 * set would be the most visible unrequested change possible. Stroke colour is
 * `currentColor` throughout so a parent decides it, which is how the prototype
 * used them.
 */

interface IconProps {
  size?: number;
  color?: string;
}

const stroke = {
  fill: 'none',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ChevronLeft({ size = 14, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg
      width={(size * 8) / 14}
      height={size}
      viewBox="0 0 8 14"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M7 1L1 7l6 6" />
    </svg>
  );
}

export function ChevronRight({ size = 12, color = 'var(--text-muted)' }: IconProps) {
  return (
    <svg
      width={(size * 7) / 12}
      height={size}
      viewBox="0 0 7 12"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M1 1l5 5-5 5" />
    </svg>
  );
}

export function Menu({ size = 14, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg width={18} height={size} viewBox="0 0 18 14" stroke={color} aria-hidden="true" {...stroke}>
      <path d="M1 1h16M1 7h16M1 13h11" />
    </svg>
  );
}

export function Search({ size = 16, color = 'var(--text-muted)' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l4 4" />
    </svg>
  );
}

export function Sun({ size = 17, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <circle cx="9" cy="9" r="3.6" />
      <path d="M9 1v1.8M9 15.2V17M1 9h1.8M15.2 9H17M3.3 3.3l1.3 1.3M13.4 13.4l1.3 1.3M14.7 3.3l-1.3 1.3M4.6 13.4l-1.3 1.3" />
    </svg>
  );
}

export function Moon({ size = 17, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M15 11.3A6.6 6.6 0 1 1 6.7 3a5.4 5.4 0 0 0 8.3 8.3z" />
    </svg>
  );
}

export function ListView({ color = 'var(--text-primary)' }: IconProps) {
  return (
    <svg width={14} height={12} viewBox="0 0 14 12" stroke={color} aria-hidden="true" {...stroke}>
      <path d="M1 1h12M1 6h12M1 11h12" />
    </svg>
  );
}

export function SpineView({ color = 'var(--text-faint)' }: IconProps) {
  return (
    <svg width={14} height={12} viewBox="0 0 14 12" stroke={color} aria-hidden="true" {...stroke}>
      <path d="M1 1v10M5 1v10M9 1v10M13 1v10" />
    </svg>
  );
}

export function NoteIcon({ size = 16, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M3 2h10v12H3zM6 6h5M6 9h5" />
    </svg>
  );
}

export function TrashIcon({ size = 16, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10" />
    </svg>
  );
}

export function BackupIcon({ size = 16, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
    </svg>
  );
}

export function AboutIcon({ size = 16, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7v4M8 5h.01" />
    </svg>
  );
}

export function LibraryTab({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" stroke={color} aria-hidden="true" {...stroke}>
      <rect x="2" y="2" width="5" height="14" rx="1" />
      <rect x="9" y="2" width="5" height="14" rx="1" />
    </svg>
  );
}

export function WishlistTab({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" stroke={color} aria-hidden="true" {...stroke}>
      <path d="M4 2h10v14l-5-4-5 4z" />
    </svg>
  );
}

export function StatsTab({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" stroke={color} aria-hidden="true" {...stroke}>
      <path d="M3 15V9M9 15V3M15 15v-4" />
    </svg>
  );
}

export function SettingsTab({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" stroke={color} aria-hidden="true" {...stroke}>
      <path d="M2 5h14M2 13h14" />
      <circle cx="7" cy="5" r="2" fill="var(--surface-base)" />
      <circle cx="12" cy="13" r="2" fill="var(--surface-base)" />
    </svg>
  );
}

export function Plus({ color = 'var(--on-accent)' }: IconProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      stroke={color}
      aria-hidden="true"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <path d="M10 3v14M3 10h14" />
    </svg>
  );
}

export function Pencil({ size = 22, color = 'var(--text-primary)' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M3 13.2l0.5-2.7L11 3l2.2 2.2-7.5 7.5-2.7 0.5z" />
      <path d="M9.9 4.1l2.2 2.2" />
    </svg>
  );
}

export function Close({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      stroke={color}
      aria-hidden="true"
      {...stroke}
    >
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}
