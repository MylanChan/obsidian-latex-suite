import type { ConcealSpec, Replacement } from "./conceal";

type MathRegion = { inner_start: number; inner_end: number };

function balancedEnd(source: string, start: number): number | null {
	if (source[start] !== "{") return null;
	let depth = 0;
	for (let index = start; index < source.length; index++) {
		if (source[index] === "\\" && (source[index + 1] === "{" || source[index + 1] === "}")) {
			index++;
			continue;
		}
		if (source[index] === "{") depth++;
		else if (source[index] === "}" && --depth === 0) return index;
	}
	return null;
}

/**
 * Replace the complete \color{#RRGGBB} / \textcolor{#RRGGBB} prefix.
 * This runs over original Markdown math bounds, not fragmented syntax overlays.
 * It removes old, intersecting \color macro decorations and leaves other
 * concealments (including \overset inside \textcolor) untouched.
 */
export function appendColorSwatches(
	specs: ConcealSpec[],
	sliceSource: (from: number, to: number) => string,
	bounds: readonly MathRegion[],
): ConcealSpec[] {
	const swatches: Replacement[] = [];
	const styledContents: Replacement[] = [];

	for (const bound of bounds) {
		if (bound.inner_end <= bound.inner_start) continue;
		const source = sliceSource(bound.inner_start, bound.inner_end);
		for (const match of source.matchAll(/\\(textcolor|color)\{(#[\da-fA-F]{6})\}/g)) {
			let preceding = 0;
			for (let i = match.index - 1; i >= 0 && source[i] === "\\"; i--) preceding++;
			if (preceding % 2) continue;
			const start = bound.inner_start + match.index;
			const end = start + match[0].length;
			const hex = match[2]!.toUpperCase();
			swatches.push({ start, end, text: hex, class: "cm-concealed-color-swatch" });

			if (match[1] === "textcolor") {
				const opening = match.index + match[0].length;
				const closing = balancedEnd(source, opening);
				if (closing !== null && closing > opening + 1) {
					styledContents.push({
						start: bound.inner_start + opening + 1,
						end: bound.inner_start + closing,
						text: "",
						class: "cm-concealed-text-color",
						marks: true,
						style: "color: " + hex + ";",
					});
				}
			}
		}
	}
	if (!swatches.length) return specs;

	swatches.sort((a, b) => a.start - b.start);
	const unique = swatches.filter((swatch, i) =>
		!i || swatch.start !== swatches[i - 1]!.start || swatch.end !== swatches[i - 1]!.end
	);
	const cleaned = specs.map(group => group.filter(spec => !unique.some(color =>
		(spec.start < color.end && spec.end > color.start) ||
		(spec.start === spec.end && spec.start >= color.start && spec.start <= color.end),
	))).filter(group => group.length > 0);
	return [
		...cleaned,
		...unique.map(swatch => [swatch]),
		...styledContents.map(mark => [mark]),
	];
}
