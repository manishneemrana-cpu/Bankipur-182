import { Construction, type LucideIcon } from "lucide-react";

export function AdminStub({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
      <div className="mt-4 flex max-w-2xl flex-col items-start gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <p className="text-sm text-ink-500">{description}</p>
      </div>
    </div>
  );
}
