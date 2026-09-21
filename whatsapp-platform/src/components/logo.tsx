import { MessageCircle } from "lucide-react";

export function Logo({ brandName, className = "" }: { brandName: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold text-ink-900 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <span className="text-base">{brandName}</span>
    </span>
  );
}
