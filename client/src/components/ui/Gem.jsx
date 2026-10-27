import { GEMS } from '../../lib/format';

export default function Gem({ packKey, size = 72, className = '' }) {
  const g = GEMS[packKey] || GEMS.employment;
  return (
    <span
      className={`gem inline-block shrink-0 ${className}`}
      style={{ width: size, height: size * 1.08, filter: `drop-shadow(0 ${Math.round(size * 0.28)}px ${Math.round(size * 0.3)}px ${g.shadow})`, '--gem-mid': g.mid, '--gem-deep': g.deep, '--gem-light': g.light, '--gem-shadow': g.shadow }}
      aria-hidden="true"
    />
  );
}
