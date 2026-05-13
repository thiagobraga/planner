import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applySearch, matchesQuery } from "../searchService.js";

const arbText = fc.string({ minLength: 0, maxLength: 30 });
const arbUpdated = fc.tuple(
  fc.integer({ min: 2020, max: 2025 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
  fc.integer({ min: 0, max: 23 }),
).map(([y, mo, d, h]) =>
  `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`,
);

const arbEntity = fc.record({
  text: arbText,
  description: fc.option(arbText, { nil: null }),
  updatedAt: arbUpdated,
});

const arbQuery = fc.string({ minLength: 2, maxLength: 20 });

describe("Property 23: Search correctness (Requirements 17.1, 17.2, 17.3)", () => {
  it("result contains exactly the entities whose text/description matches case-insensitively", () => {
    fc.assert(
      fc.property(fc.array(arbEntity, { maxLength: 100 }), arbQuery, (entities, q) => {
        const result = applySearch(entities, q);

        for (const e of result) {
          expect(
            matchesQuery(e.text, q) || (e.description ? matchesQuery(e.description, q) : false),
          ).toBe(true);
        }

        const matched = entities.filter(
          (e) => matchesQuery(e.text, q) || (e.description ? matchesQuery(e.description, q) : false),
        );

        expect(result.length).toBe(Math.min(matched.length, 50));
      }),
      { numRuns: 200 },
    );
  });

  it("result is ordered by updatedAt descending and capped at 50", () => {
    fc.assert(
      fc.property(fc.array(arbEntity, { maxLength: 100 }), arbQuery, (entities, q) => {
        const result = applySearch(entities, q);
        expect(result.length).toBeLessThanOrEqual(50);
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].updatedAt >= result[i].updatedAt).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("when match count > 50, returns top 50 by updatedAt desc (no excluded entity is newer than included)", () => {
    fc.assert(
      fc.property(fc.array(arbEntity, { minLength: 51, maxLength: 200 }), (entities) => {
        // Ensure every entity matches by using a query present in all text values
        const q = "X";
        const tagged = entities.map((e) => ({ ...e, text: `${e.text}X` }));
        const result = applySearch(tagged, q);
        expect(result.length).toBe(50);

        const includedIdx = new Set(result.map((r) => tagged.indexOf(r)));
        const excluded = tagged.filter((_, i) => !includedIdx.has(i));
        const minIncluded = result[result.length - 1].updatedAt;
        for (const e of excluded) {
          expect(e.updatedAt <= minIncluded).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
