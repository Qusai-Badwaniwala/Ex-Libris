import { Close, Search } from './icons';
import { resetButton } from './styles';

/** Same field anatomy in both approved surfaces; their data sources stay separate. */
export function SearchField({
  value,
  onChange,
  catalogue = false,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  catalogue?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 44,
        padding: '0 14px',
        background: 'var(--surface-sunken)',
        border: `var(--hairline-width) solid ${catalogue ? 'var(--accent)' : 'var(--hairline-strong)'}`,
        borderRadius: catalogue ? 'var(--radius-button)' : 'var(--radius-pill)',
      }}
    >
      <Search color="var(--text-secondary)" />
      <input
        className="exl-search-input"
        type="search"
        aria-label={ariaLabel ?? (catalogue ? 'Search the catalogue' : 'Search your library')}
        placeholder={
          placeholder ?? (catalogue ? 'Title or author' : 'Your library, your notes, your tags')
        }
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--size-body)',
        }}
      />
      {value && (
        <button
          aria-label="Clear search"
          onClick={() => onChange('')}
          style={{
            ...resetButton,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 44,
            flex: 'none',
          }}
        >
          <Close size={12} />
        </button>
      )}
    </div>
  );
}
