import type { AxisRating, Work } from '../db/schema';
import { AXES, axisWord, type AxisKey } from '../axes/axes';

export function AxisProfile({
  work,
  rating,
  onEdit,
}: {
  work: Work;
  rating: AxisRating | undefined;
  onEdit: (key?: AxisKey) => void;
}) {
  return (
    <div className="room-axis-profile">
      {AXES.map((axis) => {
        const score = rating?.[axis.key];
        const locked = axis.key === 'ending' && work.status !== 'finished';
        const word =
          axis.key === 'ending' && rating?.endingNone
            ? 'Unfinished'
            : score
              ? axisWord(axis.key, score)
              : locked
                ? 'After finishing'
                : 'Not set';
        return (
          <button
            key={axis.key}
            disabled={locked}
            aria-label={`Edit ${axis.name} axis: ${word}`}
            onClick={() => onEdit(axis.key)}
          >
            <span>{axis.name}</span>
            <strong>{word}</strong>
            {!locked && <span aria-hidden="true">↗</span>}
          </button>
        );
      })}
      <p>Words to describe the reading experience. Every axis is optional.</p>
    </div>
  );
}
