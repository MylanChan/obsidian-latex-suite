import { describe, expect, it } from "vitest";
import { cssColorToHex, findClosedColorArgument, findColorArgument, LATEX_COLOR_CHOICES } from "./color_palette_model";

describe("LaTeX palette", () => {
	it("keeps the eight requested presets", () => {
		expect(LATEX_COLOR_CHOICES.map(c => c.value)).toEqual([
			"#548DD4", "#B2A2C7", "#FAC08F", "#C3D69B",
			"#D99694", "#646A73", "#B7DDE8", "var(--text-normal)",
		]);
	});
	it("finds incomplete and paired color groups", () => {
		expect(findColorArgument("\\color{", 7)).toEqual({
			command: "color", from: 7, to: 7, closed: false, value: "",
		});
		expect(findColorArgument("\\textcolor{}", 11)?.closed).toBe(true);
		expect(findColorArgument("\\textcolor{#B2A2C7}{A}", 13)?.value).toBe("#B2A2C7");
	});
	it("ignores escaped commands and outside caret", () => {
		expect(findColorArgument("\\\\color{}", 9)).toBeNull();
		expect(findColorArgument("\\color{red}", 11)).toBeNull();
	});

	it("opens for completed paired braces without moving the cursor", () => {
		expect(findClosedColorArgument("\\color{}", 7)?.from).toBe(7);
		expect(findClosedColorArgument("\\color{}", 8)?.to).toBe(7);
		expect(findClosedColorArgument("\\textcolor{}", 11)?.command).toBe("textcolor");
		expect(findClosedColorArgument("\\textcolor{}", 12)?.closed).toBe(true);
		expect(findClosedColorArgument("\\color{red}", 11)).toBeNull();
	});
	it("converts RGB and HEX values", () => {
		expect(cssColorToHex("rgb(17, 34, 51)")).toBe("#112233");
		expect(cssColorToHex("#b7dde8")).toBe("#B7DDE8");
		expect(cssColorToHex("invalid")).toBeNull();
	});
});
