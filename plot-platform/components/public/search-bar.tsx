"use client";

import { useState } from "react";

import {
  filtersToChips,
  parseSearchQuery,
  type SearchFilters,
} from "@/lib/search/parse";

export function SearchBar({
  onChange,
}: {
  onChange: (filters: SearchFilters | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters | null>(null);

  function apply(next: SearchFilters | null) {
    setFilters(next);
    onChange(next && Object.keys(next).length > 0 ? next : null);
  }

  function removeChip(key: keyof SearchFilters) {
    if (!filters) return;
    const next = { ...filters };
    delete next[key];
    if (key === "areaValue") delete next.areaUnit;
    apply(Object.keys(next).length > 0 ? next : null);
  }

  const chips = filters ? filtersToChips(filters) : [];

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(query.trim() ? parseSearchQuery(query) : null);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "1200 east corner 30 ft road under 40 lakh"'
          className="h-10 flex-1 rounded-md border border-input px-3 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeChip(c.key as keyof SearchFilters)}
              className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs"
            >
              {c.label} <span aria-hidden>×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              apply(null);
            }}
            className="text-xs text-muted-foreground underline"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
