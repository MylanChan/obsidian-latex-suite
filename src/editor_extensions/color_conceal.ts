import type { ConcealSpec, Replacement } from "./conceal";

type MathRegion = { inner_start: number; inner_end: number };
type ColorCommand = { index: number; length: number; macro: "color" | "textcolor"; hex: string };

function matchingBrace(source: string, opening: number): number | null {
	if (source[opening] !== "{") return null;
	let depth = 0;
	for (let i = opening; i < source.length; i++) {
		if (source[i] === "\\" && (source[i + 1] === "{" || source[i + 1] === "}")) {
			i++;
			continue;
		}
		if (source[i] === "{") depth++;
		else if (source[i] === "}" && --depth === 0) return i;
	}
	return null;
}

function braceDepth(source: string, end: number): number {
	let depth = 0;
	for (let i = 0; i < end; i++) {
		if (source[i] === "\\" && (source[i + 1] === "{" || source[i + 1] === "}")) {
			i++;
			continue;
		}
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth = Math.max(0, depth - 1);
	}
	return depth;
}

function scopeEnd(source: string, start: number, afterCommand: number): number {
	const parentDepth = braceDepth(source, start);
	let depth = parentDepth;
	for (let i = afterCommand; i < source.length; i++) {
		if (source[i] === "\\" && (source[i + 1] === "{" || source[i + 1] === "}")) {
			i++;
			continue;
		}
		if (source[i] === "{") depth++;
		else if (source[i] === "}") {
			if (depth === parentDepth) return i;
			depth--;
		}
	}
	return source.length;
}

function colorCommands(source: string): ColorCommand[] {
	const found: ColorCommand[] = [];
	for (const match of source.matchAll(/\\(textcolor|color)\{(#[\da-fA-F]{6})\}/g)) {
		let precedingSlashes = 0;
		for (let i = match.index - 1; i >= 0 && source[i] === "\\"; i--) precedingSlashes++;
		if (precedingSlashes % 2) continue;
		found.push({
			index: match.index,
			length: match[0].length,
			macro: match[1] as ColorCommand["macro"],
			hex: match[2]!.toUpperCase(),
		});
	}
	return found;
}

function coloredText(start: number, end: number, hex: string): Replacement | null {
	if (end <= start) return null;
	return {
		start, end, text: "",
		class: "cm-concealed-text-color",
		marks: true,
		style: "color: " + hex + ";",
	};
}

function hiddenSyntax(start: number, end: number): Replacement {
	return { start, end, text: "", class: "cm-concealed-color-syntax" };
}

/**
 * Hide LaTeX color syntax when unfocused and style the actual math content.
 * Hide tokens separately from their color marks. Otherwise entering the
 * styled expression reveals the unrelated color command and nested macros.
 */
export function appendColorTextConceal(
	specs: ConcealSpec[],
	sliceSource: (from: number, to: number) => string,
	bounds: readonly MathRegion[],
): ConcealSpec[] {
	const colorGroups: ConcealSpec[] = [];
	const hiddenRanges: Replacement[] = [];
	for (const bound of bounds) {
		if (bound.inner_end <= bound.inner_start) continue;
		const source = sliceSource(bound.inner_start, bound.inner_end);
		const commands = colorCommands(source);
		for (const command of commands) {
			const start = bound.inner_start + command.index;
			const afterArgument = command.index + command.length;
			const prefixEnd = bound.inner_start + afterArgument;

			if (command.macro === "textcolor") {
				let bodyOpening = afterArgument;
				while (source[bodyOpening] === " " || source[bodyOpening] === "\t") bodyOpening++;
				const bodyClosing = matchingBrace(source, bodyOpening);
				if (bodyClosing === null) continue;

				const bodyStart = bound.inner_start + bodyOpening + 1;
				const bodyEnd = bound.inner_start + bodyClosing;
				const prefix = hiddenSyntax(start, bodyStart);
				const suffix = hiddenSyntax(bodyEnd, bodyEnd + 1);
				const mark = coloredText(bodyStart, bodyEnd, command.hex);
				colorGroups.push([prefix]);
				if (mark) colorGroups.push([mark]);
				colorGroups.push([suffix]);
				hiddenRanges.push(prefix, suffix);
			} else {
				// \color{#HEX}{body} is frequently used as a local color wrapper.
				// Preserve the body and conceal both wrapper braces, just like \textcolor.
				let bodyOpening = afterArgument;
				while (source[bodyOpening] === " " || source[bodyOpening] === "\t") bodyOpening++;
				const bodyClosing = matchingBrace(source, bodyOpening);
				if (bodyClosing !== null) {
					const bodyStart = bound.inner_start + bodyOpening + 1;
					const bodyEnd = bound.inner_start + bodyClosing;
					const prefix = hiddenSyntax(start, bodyStart);
					const suffix = hiddenSyntax(bodyEnd, bodyEnd + 1);
					colorGroups.push([prefix]);
					const mark = coloredText(bodyStart, bodyEnd, command.hex);
					if (mark) colorGroups.push([mark]);
					colorGroups.push([suffix]);
					hiddenRanges.push(prefix, suffix);
					continue;
				}

				// Plain \color{#HEX} declarations affect subsequent math tokens
				// until the next command at the same nesting level.
				let styleEnd = scopeEnd(source, command.index, afterArgument);
				const commandDepth = braceDepth(source, command.index);
				for (const later of commands) {
					if (later.index <= command.index || later.index >= styleEnd || later.macro !== "color") continue;
					if (braceDepth(source, later.index) === commandDepth) {
						styleEnd = later.index;
						break;
					}
				}
				const prefix = hiddenSyntax(start, prefixEnd);
				const mark = coloredText(prefixEnd, bound.inner_start + styleEnd, command.hex);
				colorGroups.push([prefix]);
				if (mark) colorGroups.push([mark]);
				hiddenRanges.push(prefix);
			}
		}
	}
	if (!colorGroups.length) return specs;
	const retained = specs
		.map(group => group.filter(spec => !hiddenRanges.some(hidden =>
			(spec.start < hidden.end && spec.end > hidden.start) ||
			(spec.start === spec.end && spec.start >= hidden.start && spec.start <= hidden.end),
		)))
		.filter(group => group.length > 0);
	return [...retained, ...colorGroups];
}
