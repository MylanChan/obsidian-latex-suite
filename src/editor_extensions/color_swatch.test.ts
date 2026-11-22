import { describe, expect, it } from "vitest";
import { appendColorSwatches } from "./color_swatch";
import type { ConcealSpec } from "./conceal";

function processMath(source: string, originals: ConcealSpec[] = []) {
	return appendColorSwatches(originals, (a, b) => source.slice(a, b), [{
		inner_start: 1, inner_end: source.length - 1,
	}]).flat();
}

describe("dynamic HEX swatch concealment", () => {
	it("replaces a complete color command and drops old zero-width conceal", () => {
		const source = "$\\color{#FDBA74}$";
		const specs = processMath(source, [[{ start: 1, end: 7, text: "" }]]);
		expect(specs).toEqual([{
			start: 1, end: 16, text: "#FDBA74", class: "cm-concealed-color-swatch",
		}]);
	});
	it("keeps content and nested overset while styling textcolor's body", () => {
		const source = "$\\textcolor{#B2A2C7}{\\overset{\\text{Any square matrix}}{A}}$";
		const from = source.indexOf("\\textcolor");
		const overset = source.indexOf("\\overset");
		const specs = processMath(source, [
			[{ start: from, end: from + 10, text: "" }],
			[{ start: overset, end: overset + 8, text: "A", class: "cm-concealed-overset" }],
		]);
		const swatch = specs.find(s => s.class === "cm-concealed-color-swatch")!;
		expect(source.slice(swatch.start, swatch.end)).toBe("\\textcolor{#B2A2C7}");
		expect(specs.some(s => s.class === "cm-concealed-overset")).toBe(true);
		expect(specs.some(s => s.marks && s.style === "color: #B2A2C7;")).toBe(true);
		expect(specs.filter(s => s.start < swatch.end && s.end > swatch.start).length).toBe(1);
	});
	it("handles multiple color commands", () => {
		const specs = processMath("$\\color{#000000}+\\color{#FFFFFF}$");
		expect(specs.filter(s => s.class === "cm-concealed-color-swatch").map(s => s.text))
			.toEqual(["#000000", "#FFFFFF"]);
	});
	it("ignores invalid/escaped/non-math colors", () => {
		expect(processMath("$\\color{red}+\\color{#ABCD}$")).toEqual([]);
		expect(processMath("$\\\\color{#D1D5DB}$")).toEqual([]);
		const source = "\`\\color{#548DD4}\` and $\\color{#C3D69B}$";
		const left = source.lastIndexOf("$"), right = source.indexOf("$", left + 1);
		const specs = appendColorSwatches([], (a, b) => source.slice(a, b), [
			{ inner_start: source.indexOf("$") + 1, inner_end: source.lastIndexOf("$") },
		]).flat();
		expect(specs.filter(s => s.class === "cm-concealed-color-swatch")).toHaveLength(1);
	});
});
