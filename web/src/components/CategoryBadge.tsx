export default function CategoryBadge({
  icon,
  label,
  color,
}: {
  icon: string;
  label: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color ?? "#7A7A7A"}1A`, color: color ?? "#7A7A7A" }}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
