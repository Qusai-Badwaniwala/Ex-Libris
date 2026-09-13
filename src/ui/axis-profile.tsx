import type { AxisRating, Work } from '../db/schema';
import { MATCH_AXIS_KEYS, axisWord, type AxisKey } from '../axes/axes';
import { caption, resetButton } from './styles';

function visibleWords(rating: AxisRating | undefined) {
  if (!rating) return [];
  const words: { key: AxisKey; label: string }[] = MATCH_AXIS_KEYS.flatMap((key) =>
    rating[key] === undefined ? [] : [{ key, label: axisWord(key, rating[key]) }],
  );
  if (rating.endingNone) {
    const endingIndex = MATCH_AXIS_KEYS.indexOf('ending');
    const beforeEnding = MATCH_AXIS_KEYS.slice(0, endingIndex).filter(
      (key) => rating[key] !== undefined,
    ).length;
    words.splice(beforeEnding, rating.ending === undefined ? 0 : 1, {
      key: 'ending',
      label: 'Unfinished',
    });
  }
  if (rating.translation !== undefined)
    words.push({ key: 'translation', label: axisWord('translation', rating.translation) });
  return words;
}

export function AxisProfile({
  work,
  rating,
  onEdit,
}: {
  work: Work;
  rating: AxisRating | undefined;
  onEdit: (key?: AxisKey) => void;
}) {
  const words = visibleWords(rating);
  const endingLocked = work.status !== 'finished' && !rating?.endingNone;
  const note = rating?.endingNone
    ? 'Unfinished means the author stopped; it is not an ending score.'
    : words.length === 0
      ? 'Unrated. Set any axes that describe how this felt to read.'
      : endingLocked
        ? 'The ending stays open until this is marked Finished.'
        : 'Tap anywhere here to change the profile.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {words.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {words.map((word, index) => (
            <span
              key={`${word.key}-${word.label}`}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <button
                aria-label={`Edit ${word.key === 'powerSystem' ? 'Power system' : word.key} axis: ${word.label}`}
                onClick={() => onEdit(word.key)}
                style={{
                  ...resetButton,
                  minHeight: 44,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--display-vf-sm)' as unknown as number,
                  fontSize: 22,
                  lineHeight: '26px',
                }}
              >
                {word.label}
              </button>
              {index < words.length - 1 ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 'var(--hairline-width)',
                    height: 18,
                    background: 'var(--hairline-strong)',
                    margin: '0 10px',
                  }}
                />
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <button
          onClick={() => onEdit()}
          style={{ ...resetButton, minHeight: 44, textAlign: 'left', color: 'var(--accent-text)' }}
        >
          Set axes
        </button>
      )}
      <span style={{ ...caption, color: 'var(--text-muted)', textWrap: 'pretty' }}>{note}</span>
    </div>
  );
}
