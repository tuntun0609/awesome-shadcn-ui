import { describe, expect, test } from "bun:test";
import { applyAutofillBatch } from "@/lib/ai/autofill-client";
import {
  type AutofillFieldName,
  type FillFieldInput,
  fillFieldsInputSchema,
  needsAutofillReview,
} from "@/lib/ai/autofill-schema";

function entry(
  field: AutofillFieldName,
  value: string | string[]
): FillFieldInput {
  return { confidence: 0.9, field, source: "https://example.com", value };
}

describe("batch autofill", () => {
  test("fills all eleven fields in one batch", () => {
    const fields = [
      entry("name", "Example"),
      entry("slug", "example"),
      entry("description", "Example components."),
      entry("website", "https://example.com"),
      entry("github", ""),
      entry("source", "open-source"),
      entry("pricing", "free"),
      entry("access", "direct"),
      entry("deliveries", ["components"]),
      entry("useCases", ["ai"]),
      entry("tags", ["react"]),
    ];
    const written = new Map();
    const input = fillFieldsInputSchema.parse({ fields });
    const output = applyAutofillBatch(input, (field, value) => {
      written.set(field, value);
      return "filled";
    });
    expect(output.ok).toBe(true);
    expect(written.size).toBe(11);
  });

  test("an invalid field does not block valid fields and is not written", () => {
    const written = new Map();
    const output = applyAutofillBatch(
      {
        fields: [
          entry("slug", "Invalid Slug"),
          entry("name", "  Example  "),
          entry("pricing", "unknown"),
        ],
      },
      (field, value) => {
        written.set(field, value);
        return "filled";
      }
    );
    expect(output.ok).toBe(false);
    expect([...written.entries()]).toEqual([["name", "Example"]]);
    expect(output.results.map((result) => result.status)).toEqual([
      "invalid",
      "filled",
      "invalid",
    ]);
    expect(output.results[0]?.error).toBeTruthy();
  });

  test("preserves a protected result without asking the agent to retry", () => {
    const output = applyAutofillBatch(
      {
        fields: [
          entry("name", "AI candidate"),
          entry("description", "Description"),
        ],
      },
      (field) => (field === "name" ? "protected" : "review")
    );
    expect(output.ok).toBe(true);
    expect(output.results.map((result) => result.status)).toEqual([
      "protected",
      "review",
    ]);
  });

  test("does not overwrite a field twice in the same batch", () => {
    const values: (string | string[])[] = [];
    const output = applyAutofillBatch(
      { fields: [entry("name", "First"), entry("name", "Second")] },
      (_field, value) => {
        values.push(value);
        return "filled";
      }
    );
    expect(values).toEqual(["First"]);
    expect(output.results[1]?.status).toBe("invalid");
  });

  test("normalizes recoverable arrays and rejects invalid choices", () => {
    const values: (string | string[])[] = [];
    const output = applyAutofillBatch(
      {
        fields: [
          entry("tags", "react、ui"),
          entry("deliveries", '["components","blocks"]'),
          entry("useCases", ["unsupported"]),
        ],
      },
      (_field, value) => {
        values.push(value);
        return "filled";
      }
    );
    expect(values).toEqual([
      ["react", "ui"],
      ["components", "blocks"],
    ]);
    expect(output.results[2]?.status).toBe("invalid");
  });

  test("rejects empty batches and fields outside the allowlist", () => {
    expect(fillFieldsInputSchema.safeParse({ fields: [] }).success).toBe(false);
    expect(
      fillFieldsInputSchema.safeParse({
        fields: [{ ...entry("name", "x"), field: "featuredRank" }],
      }).success
    ).toBe(false);
  });
});

describe("review metadata", () => {
  test("requires review for missing sources even when confidence is high", () => {
    for (const source of [undefined, "", "  ", "n/a", " N/A "]) {
      expect(needsAutofillReview({ confidence: 0.99, source })).toBe(true);
    }
  });
  test("uses the 70% boundary and treats missing confidence as uncertain", () => {
    expect(needsAutofillReview({ confidence: 0.69, source: "README" })).toBe(
      true
    );
    expect(needsAutofillReview({ confidence: 0.7, source: "README" })).toBe(
      false
    );
    expect(needsAutofillReview({ source: "README" })).toBe(true);
  });
});
