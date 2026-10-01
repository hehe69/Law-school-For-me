export const ROLE_COLORS: Record<string, string> = {
  argument: "bg-blue-50 border-blue-300 text-blue-900",
  counterargument: "bg-red-50 border-red-300 text-red-900",
  response: "bg-green-50 border-green-300 text-green-900",
  background: "bg-gray-100 border-gray-300 text-gray-800",
};
export const READ_COLORS: Record<string, string> = {
  unread: "bg-gray-100 border-gray-300 text-gray-700",
  skimmed: "bg-yellow-50 border-yellow-300 text-yellow-900",
  read: "bg-green-50 border-green-300 text-green-900",
};
export const KIND_COLORS: Record<string, string> = {
  support: "bg-blue-50 border-blue-300 text-blue-900",
  counter: "bg-red-50 border-red-300 text-red-900",
  background: "bg-gray-100 border-gray-300 text-gray-800",
  definition: "bg-purple-50 border-purple-300 text-purple-900",
};

export function RoleBadge({ role }: { role: string }) {
  return <span className={`badge ${ROLE_COLORS[role] ?? ROLE_COLORS.background}`}>{role}</span>;
}
export function ReadBadge({ status }: { status: string }) {
  return <span className={`badge ${READ_COLORS[status] ?? READ_COLORS.unread}`}>{status}</span>;
}
export function KindBadge({ kind }: { kind: string }) {
  return <span className={`badge ${KIND_COLORS[kind] ?? KIND_COLORS.background}`}>{kind}</span>;
}
export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {tags.map((t) => (
        <span key={t} className="badge border-gray-300 bg-white text-gray-700">
          {t}
        </span>
      ))}
    </span>
  );
}
export function SupportBadge({ support }: { support: number }) {
  return (
    <span
      className={`badge ${support === 0 ? "border-dashed border-red-400 text-red-700 bg-white" : "border-gray-300 bg-white text-gray-700"}`}
      title="Section–source links + linked extracts"
    >
      support {support}
    </span>
  );
}
