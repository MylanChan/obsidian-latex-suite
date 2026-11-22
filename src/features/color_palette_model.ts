/** Built-in LaTeX colors (the final entry follows the current Obsidian theme). */
export const LATEX_COLOR_CHOICES = [
	{ name: "Blue", value: "#548DD4" },
	{ name: "Lavender", value: "#B2A2C7" },
	{ name: "Peach", value: "#FAC08F" },
	{ name: "Green", value: "#C3D69B" },
	{ name: "Rose", value: "#D99694" },
	{ name: "Charcoal", value: "#646A73" },
	{ name: "Pale blue", value: "#B7DDE8" },
	{ name: "Theme text", value: "var(--text-normal)" },
] as const;

export type ColorChoice = typeof LATEX_COLOR_CHOICES[number];
export type ColorArgument = {
	command: "color" | "textcolor";
	from: number;
	to: number;
	closed: boolean;
	value: string;
};

/** Converts a literal or CSS-computed RGB to a MathJax-compatible six-digit HEX. */
export function cssColorToHex(value: string): string | null {
	const text = value.trim();
	if (/^#[\da-f]{6}$/i.test(text)) return text.toUpperCase();
	const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text);
	if (!match) return null;
	const channels = match.slice(1, 4).map(c => Math.max(0, Math.min(255, Math.round(Number(c)))));
	return "#" + channels.map(c => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function resolveColorHex(value: string, doc: Document = document): string | null {
	if (value !== "var(--text-normal)") return cssColorToHex(value);
	const computed = doc.defaultView?.getComputedStyle(doc.documentElement);
	if (!computed) return "#646A73";
	return cssColorToHex(computed.getPropertyValue("--text-normal"))
		?? cssColorToHex(computed.color)
		?? "#646A73";
}

/** Works with incomplete \color{ and completed \textcolor{...} groups. */
export function findColorArgument(line: string, caret: number): ColorArgument | null {
	let found: ColorArgument | null = null;
	for (const match of line.matchAll(/\\(textcolor|color)[ \t]*\{/g)) {
		let preceding = 0;
		for (let i = match.index - 1; i >= 0 && line[i] === "\\"; i--) preceding++;
		if (preceding % 2) continue;
		const from = match.index + match[0].length;
		if (caret < from) continue;
		const close = line.indexOf("}", from);
		const nestedOpen = line.indexOf("{", from);
		const closed = close >= 0 && (nestedOpen < 0 || nestedOpen > close);
		const to = closed ? close : caret;
		if (caret > to) continue;
		const value = line.slice(from, to);
		if (!/^[#.A-Za-z0-9-]*$/.test(value)) continue;
		found = { command: match[1] as ColorArgument["command"], from, to, closed, value };
	}
	return found;
}
