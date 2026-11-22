import { describe, expect, it } from "vitest";
import { chooseMathPreviewPlacement } from "./math_tooltip_placement";

const viewport = { top: 0, bottom: 800 };

describe("math preview popup placement", () => {
	it("anchors a multiline formula near the bottom to the space above it", () => {
		const placement = chooseMathPreviewPlacement({ top: 779, bottom: 795 }, viewport, true, true);
		expect(placement.above).toBe(true);
		expect(placement.maxHeight).toBe(560);
	});
	it("moves a multiline formula below a caret near the top", () => {
		const placement = chooseMathPreviewPlacement({ top: 30, bottom: 45 }, viewport, true, true);
		expect(placement.above).toBe(false);
		expect(placement.maxHeight).toBe(560);
	});
	it("caps the popup to the actual available space on its chosen side", () => {
		const placement = chooseMathPreviewPlacement({ top: 450, bottom: 466 }, viewport, true, true);
		expect(placement.above).toBe(true);
		expect(placement.maxHeight).toBe(432);
	});
	it("keeps the configured side for short equations when possible", () => {
		expect(chooseMathPreviewPlacement({ top: 450, bottom: 466 }, viewport, false, false).above).toBe(false);
		expect(chooseMathPreviewPlacement({ top: 450, bottom: 466 }, viewport, true, false).above).toBe(true);
	});
});
