/** Small, conservative parser for readable annotations in stacked LaTeX macros. */
export type StackedMacro = "overset" | "underset";

type GlyphMap = {
	greek: Record<string, string | undefined>;
	ALL_SYMBOLS: Record<string, string | undefined>;
};

type Group = { text: string; end: number };

function readGroup(source: string, start: number): Group | null {
	let index = start;
	while (source[index] === " " || source[index] === "\t") index++;
	if (source[index] !== "{") return null;
	let depth = 0;
	for (let i = index; i < source.length; i++) {
		if (source[i] === "\\" && (source[i + 1] === "{" || source[i + 1] === "}")) {
			i++;
			continue;
		}
		if (source[i] === "{") depth++;
		if (source[i] === "}" && --depth === 0) {
			return { text: source.slice(index + 1, i), end: i + 1 };
		}
	}
	return null;
}

export function readableMathToken(text: string, maps: GlyphMap): string | null {
	const value = text.trim();
	const label = /^\\(?:text|mathrm|textrm)\{([^{}]*)\}$/.exec(value);
	if (label) return label[1] || null;
	if (/^\\[A-Za-z]+$/.test(value)) {
		const macro = value.slice(1);
		return maps.greek[macro] ?? maps.ALL_SYMBOLS[macro] ?? null;
	}
	if (/^[\p{L}\p{N}+=.,()!?:;/* _-]+$/u.test(value)) return value;
	return null;
}

export function parseStackedConceal(
	source: string,
	macro: StackedMacro,
	maps: GlyphMap,
): { length: number; base: string; annotation: string } | null {
	const command = "\\" + macro;
	if (!source.startsWith(command)) return null;
	const annotationGroup = readGroup(source, command.length);
	const baseGroup = annotationGroup && readGroup(source, annotationGroup.end);
	if (!annotationGroup || !baseGroup) return null;
	const annotation = readableMathToken(annotationGroup.text, maps);
	const base = readableMathToken(baseGroup.text, maps);
	if (!annotation || !base) return null;
	return { length: baseGroup.end, base, annotation };
}
