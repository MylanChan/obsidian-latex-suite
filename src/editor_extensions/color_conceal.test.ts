import { describe, expect, it } from "vitest";
import { appendColorTextConceal } from "./color_conceal";
import type { ConcealSpec } from "./conceal";

function conceal(source: string, original: ConcealSpec[] = [], bounds = [
	{ inner_start: 1, inner_end: source.length - 1 },
]) {
	return appendColorTextConceal(original, (a, b) => source.slice(a, b), bounds);
}

describe("unfocused LaTeX HEX text color", () => {
	it("hides textcolor syntax and colors the body instead of showing a circle", () => {
		const source = "$\\textcolor{#B2A2C7}{A}$";
		expect(conceal(source)).toEqual([
			[{ start: 1, end: 21, text: "", class: "cm-concealed-color-syntax" }],
			[{ start: 21, end: 22, text: "", class: "cm-concealed-text-color", marks: true, style: "color: #B2A2C7;" }],
			[{ start: 22, end: 23, text: "", class: "cm-concealed-color-syntax" }],
		]);
		expect(conceal(source).flat().some(spec => spec.class === "cm-concealed-color-swatch")).toBe(false);
	});

	it("retains nested overset widgets and covers their range with the colored mark", () => {
		const source = "$\\textcolor{#B2A2C7}{\\overset{\\text{Any square matrix}}{A}}$";
		const overset = source.indexOf("\\overset");
		const prior: ConcealSpec[] = [
			[{ start: 1, end: 11, text: "" }],
			[{ start: overset, end: source.lastIndexOf("}") , text: "A\u001fAny square matrix", class: "cm-concealed-overset" }],
		];
		const groups = conceal(source, prior);
		expect(groups.some(group => group[0]?.class === "cm-concealed-overset")).toBe(true);
		const mark = groups.flat().find(spec => spec.marks)!;
		expect(mark.start).toBe(overset);
		expect(mark.end).toBe(source.lastIndexOf("}"));
		expect(mark.style).toBe("color: #B2A2C7;");
		expect(groups.flat().filter(spec => spec.class === "cm-concealed-color-syntax")).toHaveLength(2);
	});

	it("hides both braces in \\color{#HEX}{body} without coloring the next token", () => {
		const source = "$\\color{#D99694}{v}=z$";
		const groups = conceal(source);
		const specs = groups.flat();
		const marks = specs.filter(spec => spec.marks);
		expect(marks).toHaveLength(1);
		expect(source.slice(marks[0]!.start, marks[0]!.end)).toBe("v");
		expect(marks[0]!.style).toBe("color: #D99694;");
		const hidden = specs.filter(spec => spec.class === "cm-concealed-color-syntax");
		expect(hidden.map(spec => source.slice(spec.start, spec.end))).toEqual([
			"\\color{#D99694}{", "}",
		]);
		expect(source.slice(hidden.at(-1)!.end)).toBe("=z$");
	});

	it("keeps nested math widgets intact in a local color wrapper", () => {
		const source = "$\\color{#548DD4}{\\overset{\\text{Eigenvalue}}{\\lambda}}$";
		const baseStart = source.indexOf("\\overset");
		const baseEnd = source.lastIndexOf("}");
		const original: ConcealSpec[] = [[{
			start: baseStart, end: baseEnd,
			text: "λ\u001fEigenvalue", class: "cm-concealed-overset",
		}]];
		const groups = conceal(source, original);
		expect(groups.some(g => g[0]?.class === "cm-concealed-overset")).toBe(true);
		expect(groups.flat().filter(x => x.class === "cm-concealed-color-syntax")).toHaveLength(2);
		expect(groups.flat().filter(x => x.marks)).toHaveLength(1);
		const mark = groups.flat().find(x => x.marks)!;
		expect(mark.start).toBe(baseStart);
		expect(mark.end).toBe(baseEnd);
	});

	it("styles the following math content for a color declaration", () => {
		const source = "$\\color{#548DD4}x+y$";
		expect(conceal(source)).toEqual([
			[{ start: 1, end: 16, text: "", class: "cm-concealed-color-syntax" }],
			[{ start: 16, end: 19, text: "", class: "cm-concealed-text-color", marks: true, style: "color: #548DD4;" }],
		]);
	});

	it("stops color at its scope boundary or at the next same-level color", () => {
		const source = "$\\color{#548DD4}a+\\color{#D99694}b$";
		const marks = conceal(source).flat().filter(spec => spec.marks);
		expect(source.slice(marks[0]!.start, marks[0]!.end)).toBe("a+");
		expect(source.slice(marks[1]!.start, marks[1]!.end)).toBe("b");
		const nested = "$" + "{\\color{#C3D69B}A}+B$";
		const scoped = conceal(nested).flat().find(spec => spec.marks)!;
		expect(nested.slice(scoped.start, scoped.end)).toBe("A");
	});

	it("supports multiple labeled terms in the same formula", () => {
		const source = "$\\textcolor{#B2A2C7}{\\overset{\\text{Any square matrix}}{A}}" +
			"=\\textcolor{#548DD4}{\\overset{\\text{Eigenvalue}}{\\lambda}}" +
			"\\textcolor{#D99694}{\\underset{\\text{Eigenvector}}{v}}$";
		const specs = conceal(source).flat();
		const marks = specs.filter(spec => spec.marks);
		expect(marks.map(spec => spec.style)).toEqual([
			"color: #B2A2C7;", "color: #548DD4;", "color: #D99694;",
		]);
		expect(specs.filter(spec => spec.class === "cm-concealed-color-syntax")).toHaveLength(6);
		expect(specs.some(spec => spec.class === "cm-concealed-color-swatch")).toBe(false);
	});

	it("does not reveal a color command when editing its styled expression", () => {
		const source = "$\\textcolor{#B2A2C7}{\\overset{\\text{Any square matrix}}{A}}$";
		const groups = conceal(source);
		const insideBody = source.indexOf("\\overset") + 5;
		const containsCaret = (group: ConcealSpec) =>
			group.some(spec => spec.start < insideBody && insideBody < spec.end);
		const prefix = groups.find(group => group[0]?.class === "cm-concealed-color-syntax" &&
			group[0].start === source.indexOf("\\textcolor"))!;
		const mark = groups.find(group => group[0]?.class === "cm-concealed-text-color")!;
		expect(containsCaret(prefix)).toBe(false);
		expect(containsCaret(mark)).toBe(true);
		expect(prefix).not.toBe(mark);
	});

	it("keeps every color command concealed while the caret is in another term", () => {
		const source = "$$\n" +
			"\\textcolor{#B2A2C7}{\\overset{\\text{Any square matrix}}{A}}" +
			"\\color{#D99694}{v}=\\color{#548DD4}{\\overset{\\text{Eigenvalue}}{\\lambda}} " +
			"\\color{#D99694}{\\underset{\\text{Eigenvector}}{v}}\\ne\\n$$";
		const groups = appendColorTextConceal([], (a, b) => source.slice(a, b), [
			{ inner_start: 3, inner_end: source.length - 3 },
		]);
		const syntaxes = groups.filter(group => group[0]?.class === "cm-concealed-color-syntax");
		const colorMarks = groups.filter(group => group[0]?.class === "cm-concealed-text-color");
		expect(syntaxes).toHaveLength(8);
		expect(colorMarks).toHaveLength(4);
		const caretOnFinalE = source.lastIndexOf("e\n");
		expect(syntaxes.every(group => group.every(spec =>
			!(spec.start < caretOnFinalE && caretOnFinalE < spec.end)))).toBe(true);
		expect(groups.every(group => group.length === 1)).toBe(true);
	});

	it("keeps incomplete, invalid, escaped and non-math commands editable", () => {
		expect(conceal("$\\textcolor{#548DD4}{unfinished$")).toEqual([]);
		expect(conceal("$\\color{red}$")).toEqual([]);
		expect(conceal("$\\\\color{#B2A2C7}$")).toEqual([]);
		const quote = String.fromCharCode(96);
		const source = quote + "\\color{#548DD4}" + quote + " and $\\color{#C3D69B}X$";
		const opening = source.indexOf("$");
		const closing = source.lastIndexOf("$");
		const groups = conceal(source, [], [{ inner_start: opening + 1, inner_end: closing }]);
		expect(groups).toHaveLength(2);
		expect(groups[0]![0]?.start).toBe(source.indexOf("\\color", opening));
	});
});
