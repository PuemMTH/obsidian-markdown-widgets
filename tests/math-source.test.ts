import { describe, expect, it } from "vitest";
import { findMathSpans, spanAt } from "../src/widgets/math/math-source";

describe("findMathSpans", () => {
  it("reads a display block as one display span, not two empty inline ones", () => {
    const spans = findMathSpans("$$H_v = W_2 \\cdot \\sigma(W_1 \\cdot Z_v)$$");
    expect(spans).toHaveLength(1);
    expect(spans[0].display).toBe(true);
    expect(spans[0].tex).toBe("H_v = W_2 \\cdot \\sigma(W_1 \\cdot Z_v)");
  });

  it("keeps inline and display spans in document order", () => {
    const spans = findMathSpans("ค่า $Z_v$ ผ่าน\n\n$$H_v = W Z_v$$\n\nได้ $H_v$");
    expect(spans.map((s) => s.tex)).toEqual(["Z_v", "H_v = W Z_v", "H_v"]);
    expect(spans.map((s) => s.display)).toEqual([false, true, false]);
  });

  it("ignores escaped dollar signs", () => {
    expect(findMathSpans("ราคา \\$5 ถึง \\$10")).toEqual([]);
  });

  it("allows an escaped dollar inside an inline span", () => {
    expect(findMathSpans("$a \\$ b$")[0].tex).toBe("a \\$ b");
  });

  it("reports offsets that slice the original delimiters back out", () => {
    const text = "ก่อน $$x^2$$ หลัง";
    const [span] = findMathSpans(text);
    expect(text.slice(span.from, span.to)).toBe("$$x^2$$");
  });
});

describe("spanAt", () => {
  const spans = findMathSpans("$a$ กลาง $$b$$");

  it("returns the span containing the position", () => {
    expect(spanAt(spans, 1)?.tex).toBe("a");
  });

  it("falls back to the next span when the position sits between them", () => {
    expect(spanAt(spans, 5)?.tex).toBe("b");
  });

  it("returns null past the last span", () => {
    expect(spanAt(spans, 999)).toBeNull();
  });
});
