import { describe, expect, it } from "vitest";
import { parseStackedConceal } from "./stacked_conceal";

const maps = {
	greek: { lambda: "λ", mu: "μ" },
	ALL_SYMBOLS: { infty: "∞" },
};

describe("stacked LaTeX concealment", () => {
	it("renders an annotated matrix symbol", () => {
		expect(parseStackedConceal("\\overset{\\text{Any square matrix}}{A}", "overset", maps))
			.toEqual({ length: 37, base: "A", annotation: "Any square matrix" });
	});
	it("supports Greek bases and underset", () => {
		expect(parseStackedConceal("\\overset{\\text{Eigenvalue}}{\\lambda}", "overset", maps)?.base).toBe("λ");
		expect(parseStackedConceal("\\underset{\\text{Eigenvector}}{v}", "underset", maps)?.annotation).toBe("Eigenvector");
	});
	it("leaves unsupported nested expressions untouched", () => {
		expect(parseStackedConceal("\\overset{\\frac{a}{b}}{A}", "overset", maps)).toBeNull();
		expect(parseStackedConceal("\\underset{label}{", "underset", maps)).toBeNull();
	});
});
