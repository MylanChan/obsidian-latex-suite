import { type Editor, MarkdownView, Plugin } from "obsidian";
import { type ColorArgument, findClosedColorArgument, LATEX_COLOR_CHOICES, resolveColorHex } from "./color_palette_model";
import { LatexColorSuggest } from "./color_palette";

type ColorTarget = { editor: Editor; line: number; group: ColorArgument };

/**
 * Native EditorSuggest opens as users type \color{, while this small palette
 * also opens when the cursor returns to an already auto-paired { } group.
 */
export class ClosedLatexColorPicker {
	private menu: HTMLDivElement | null = null;
	private target: ColorTarget | null = null;
	private buttons: HTMLButtonElement[] = [];
	private index = 0;
	private nativeIndex = 0;
	private timer: number | null = null;

	constructor(private readonly plugin: Plugin, private readonly native: LatexColorSuggest) {
		plugin.registerEvent(plugin.app.workspace.on("editor-change", () => this.schedule()));
		plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", () => this.schedule()));
		for (const type of ["mouseup", "keyup", "selectionchange", "focusin"] as const) {
			plugin.registerDomEvent(document, type, () => this.schedule());
		}
		plugin.registerDomEvent(document, "mousedown", event => {
			if (this.menu && !this.menu.contains(event.target as Node) &&
				!(event.target as Element).closest?.(".cm-content")) this.hide();
		});
		window.addEventListener("keydown", this.onKey, true);
		plugin.register(() => this.destroy());
	}

	private readonly onKey = (event: KeyboardEvent) => {
		if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
		const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
		const amount = delta[event.key];
		if (amount === undefined && event.key !== "Enter" && event.key !== "Escape") return;
		if (this.menu) {
			if (this.menu.contains(document.activeElement)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			if (amount !== undefined) {
				this.index = (this.index + amount + LATEX_COLOR_CHOICES.length) % LATEX_COLOR_CHOICES.length;
				this.highlight();
			} else if (event.key === "Enter") this.apply(LATEX_COLOR_CHOICES[this.index]!.value);
			else this.hide();
			return;
		}
		const rows = [...document.querySelectorAll<HTMLElement>(".latex-suite-color-suggestion")]
			.filter(row => row.isConnected && row.getClientRects().length > 0);
		if (!rows.length || !document.activeElement?.closest(".cm-editor")) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (amount !== undefined) {
			this.nativeIndex = (this.nativeIndex + amount + rows.length) % rows.length;
			rows.forEach((row, i) => {
				row.classList.toggle("is-selected", i === this.nativeIndex);
				row.setAttribute("aria-selected", i === this.nativeIndex ? "true" : "false");
			});
		} else if (event.key === "Enter") {
			this.native.selectSuggestion(LATEX_COLOR_CHOICES[this.nativeIndex]!);
		} else this.native.close();
	};

	private schedule() {
		if (this.timer !== null) return;
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.refresh();
		}, 0);
	}

	private locate(): ColorTarget | null {
		const active = document.activeElement;
		if (!active?.closest(".cm-editor")) return null;
		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.editor || !view.contentEl.contains(active)) return null;
		const editor = view.editor;
		if (editor.somethingSelected()) return null;
		const position = editor.getCursor();
		const group = findClosedColorArgument(editor.getLine(position.line), position.ch);
		return group ? { editor, line: position.line, group } : null;
	}

	private refresh() {
		if (this.menu?.contains(document.activeElement)) return;
		const next = this.locate();
		if (!next) { this.hide(); return; }
		if (this.menu && this.target && this.target.editor === next.editor &&
			this.target.line === next.line && this.target.group.from === next.group.from) {
			this.target = next;
			this.position();
			return;
		}
		this.hide();
		this.target = next;
		this.show();
	}

	private show() {
		const root = createDiv();
		root.className = "latex-suite-color-menu";
		root.setAttribute("role", "dialog");
		root.setAttribute("aria-label", "LaTeX color");
		root.addEventListener("mousedown", event => event.preventDefault());
		const title = createDiv();
		title.className = "latex-suite-color-title";
		title.textContent = "LaTeX color";
		root.appendChild(title);
		const grid = createDiv();
		grid.className = "latex-suite-color-grid";
		const initial = this.target!.editor.getLine(this.target!.line)
			.slice(this.target!.group.from, this.target!.group.to).toUpperCase();
		this.index = Math.max(0, LATEX_COLOR_CHOICES.findIndex(c => resolveColorHex(c.value) === initial));
		this.buttons = LATEX_COLOR_CHOICES.map(choice => {
			const button = createEl("button");
			button.type = "button";
			button.className = "latex-suite-color-swatch";
			button.style.backgroundColor = choice.value;
			button.title = choice.name + " · " + choice.value;
			button.setAttribute("aria-label", choice.name);
			button.addEventListener("click", () => this.apply(choice.value));
			grid.appendChild(button);
			return button;
		});
		root.appendChild(grid);
		document.body.appendChild(root);
		this.menu = root;
		this.highlight();
		this.position();
	}

	private highlight() {
		this.buttons.forEach((button, i) => button.classList.toggle("is-selected", i === this.index));
	}

	private position() {
		if (!this.menu) return;
		const selection = document.getSelection();
		let rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
		if (!rect || (!rect.width && !rect.height)) {
			rect = document.querySelector(".markdown-source-view.mod-active .cm-cursor-primary")?.getBoundingClientRect() ?? null;
		}
		const bounds = rect ?? { left: window.innerWidth / 2, top: 80, bottom: 98 };
		const width = this.menu.offsetWidth || 184, height = this.menu.offsetHeight || 118;
		this.menu.style.left = Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)) + "px";
		this.menu.style.top = (bounds.bottom + 8 + height <= window.innerHeight
			? bounds.bottom + 8 : Math.max(8, bounds.top - height - 8)) + "px";
	}

	private apply(value: string) {
		if (!this.target) return;
		const hex = resolveColorHex(value);
		if (!hex) return;
		const { editor, line, group } = this.target;
		const current = findClosedColorArgument(editor.getLine(line), group.from);
		if (!current || current.from !== group.from || current.to !== group.to) { this.hide(); return; }
		this.hide();
		editor.replaceRange(hex, { line, ch: group.from }, { line, ch: group.to });
		editor.setCursor({ line, ch: group.from + hex.length + 1 });
		editor.focus();
	}

	private hide() {
		this.menu?.remove();
		this.menu = null;
		this.target = null;
		this.buttons = [];
	}

	private destroy() {
		if (this.timer !== null) window.clearTimeout(this.timer);
		window.removeEventListener("keydown", this.onKey, true);
		this.hide();
	}
}
