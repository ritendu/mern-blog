import { initials } from '../utils/format';

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="hn-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
