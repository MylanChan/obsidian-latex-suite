import { describe, expect, it } from "vitest";
import { parseBraceConceal, parseStackedConceal } from "./stacked_conceal";

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

describe("decorated braces", () => {
	it("renders overbrace and underbrace without annotations", () => {
		expect(parseBraceConceal("\\overbrace{a+b}", "overbrace", maps))
			.toEqual({ length: "\\overbrace{a+b}".length, body: "a+b", annotation: "" });
		expect(parseBraceConceal("\\underbrace{a+b}", "underbrace", maps)?.body).toBe("a+b");
	});
	it("supports text labels and Greek symbols", () => {
		expect(parseBraceConceal("\\overbrace{a+b}^{\\text{Sum}}", "overbrace", maps))
			.toEqual({ length: "\\overbrace{a+b}^{\\text{Sum}}".length, body: "a+b", annotation: "Sum" });
		expect(parseBraceConceal("\\underbrace{\\lambda+\\mu}_{\\text{terms}}", "underbrace", maps)?.body)
			.toBe("λ+μ");
	});
	it("leaves unsupported fraction and incomplete groups visible", () => {
		expect(parseBraceConceal("\\overbrace{\\frac{a}{b}}", "overbrace", maps)).toBeNull();
		expect(parseBraceConceal("\\underbrace{a+b}_{", "underbrace", maps)).toBeNull();
	});
});

