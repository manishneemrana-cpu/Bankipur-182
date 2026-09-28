import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "@/lib/constants";

const root = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("white-label (Product Contract rule 1)", () => {
  it("defines the product name in exactly one place", () => {
    const hits = ["app", "components", "lib"]
      .flatMap((d) => sourceFiles(path.join(root, d)))
      .filter((f) => readFileSync(f, "utf8").includes(PRODUCT_NAME));
    expect(hits.map((f) => path.relative(root, f))).toEqual([
      "lib/constants.ts",
    ]);
  });
});
