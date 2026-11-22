import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestContext, type EditorSuggestTriggerInfo, type TFile } from "obsidian";
import { type ColorChoice, findColorArgument, LATEX_COLOR_CHOICES, resolveColorHex } from "./color_palette_model";

/** Native suggestions are used for unfinished \color{ and \textcolor{ commands. */
export class LatexColorSuggest extends EditorSuggest<ColorChoice> {
	constructor(app: App) { super(app); }

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const group = findColorArgument(editor.getLine(cursor.line), cursor.ch);
		if (!group || group.closed) return null;
		return {
			start: { line: cursor.line, ch: group.from },
			end: { line: cursor.line, ch: cursor.ch },
			query: group.value,
		};
	}

	getSuggestions(_context: EditorSuggestContext): ColorChoice[] {
		return [...LATEX_COLOR_CHOICES];
	}

	renderSuggestion(choice: ColorChoice, el: HTMLElement): void {
		el.classList.add("latex-suite-color-suggestion");
		const swatch = el.createSpan({ cls: "latex-suite-color-suggestion-swatch" });
		swatch.style.backgroundColor = choice.value;
		el.createSpan({ text: choice.name, cls: "latex-suite-color-suggestion-name" });
		el.createEl("code", { text: choice.value, cls: "latex-suite-color-suggestion-hex" });
	}

	selectSuggestion(choice: ColorChoice): void {
		const context = this.context;
		if (!context) return;
		const editor = context.editor;
		const lineIndex = context.start.line;
		const group = findColorArgument(editor.getLine(lineIndex), context.end.ch);
		if (!group || group.closed || group.from !== context.start.ch) return;
		const hex = resolveColorHex(choice.value);
		if (!hex) return;
		editor.replaceRange(hex + "}", { line: lineIndex, ch: group.from }, { line: lineIndex, ch: group.to });
		editor.setCursor({ line: lineIndex, ch: group.from + hex.length + 1 });
		this.close();
	}
}
