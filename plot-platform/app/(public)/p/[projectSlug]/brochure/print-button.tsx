"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
