import { describe, expect, it } from "vitest";
import { evalInObsidian } from "obsidian-integration-testing";
import { getTemporaryVault } from "obsidian-integration-testing/vitest-global-setup-plugin";
import type { MarkdownView } from "obsidian";

type TestLatexSuitePlugin = {
	settings: {
		concealEnabled: boolean;
		concealLinewise: boolean;
		concealRevealTimeout: number;
		mathPreviewEnabled: boolean;
		mathPreviewLivePreviewDisplay: boolean;
	};
	saveSettings(): Promise<void>;
};


const formula = [
	"$$",
	"\\textcolor{#B2A2C7}{\\overset{\\text{Any square matrix}}{A}}" +
	"\\color{#D99694}{v}=\\color{#548DD4}{\\overset{\\text{Eigenvalue}}{\\lambda}} " +
	"\\color{#D99694}{\\underset{\\text{Eigenvector}}{v}}",
	"e",
	"$$",
].join("\n");

describe("Live Preview color conceal in real Obsidian", () => {
	it("does not leak color commands or wrapper braces away from the cursor", async () => {
		const vault = getTemporaryVault();
		const result = await evalInObsidian({
			vaultPath: vault.path,
			input: { formula },
			callback: async ({ app, formula }) => {
				const plugin = (app as unknown as { plugins: { plugins: Record<string, TestLatexSuitePlugin | undefined> } })
					.plugins.plugins["obsidian-latex-suite"];
				if (!plugin) return { error: "plugin not loaded" };
				plugin.settings.concealEnabled = true;
				plugin.settings.concealLinewise = false;
				plugin.settings.concealRevealTimeout = 300;
				plugin.settings.mathPreviewEnabled = true;
				plugin.settings.mathPreviewLivePreviewDisplay = true;
				await plugin.saveSettings();
				(app.vault as unknown as { setConfig?(name: string, enabled: boolean): void }).setConfig?.("livePreview", true);
				const file = await app.vault.create("Color Regression.md", formula);
				const leaf = app.workspace.getLeaf(true);
				await leaf.openFile(file);
				const view = leaf.view as MarkdownView;
				const editor = view.editor;
				const snapshot = () => {
					const root = view.contentEl.querySelector<HTMLElement>(".cm-editor");
					const sourceLines = Array.from(root?.querySelectorAll<HTMLElement>(".cm-line.HyperMD-math") ?? [])
						.map(el => el.innerText);
					const widgets = Array.from(root?.querySelectorAll<HTMLElement>(".cm-concealed-overset, .cm-concealed-underset") ?? [])
						.map(el => ({
							text: el.textContent,
							style: el.getAttribute("style"),
							color: window.getComputedStyle(el).color,
						}));
					const plainColor = Array.from(root?.querySelectorAll<HTMLElement>(".cm-concealed-text-color") ?? [])
						.map(el => ({
							text: el.textContent,
							color: window.getComputedStyle(el).color,
						}));
					return {
						sourceLines, widgets, plainColor,
						oversets: root?.querySelectorAll(".cm-concealed-overset").length ?? -1,
						undersets: root?.querySelectorAll(".cm-concealed-underset").length ?? -1,
						syntaxReplacements: root?.querySelectorAll(".cm-concealed-color-syntax").length ?? -1,
					};
				};
				editor.setCursor({ line: 2, ch: 1 });
				editor.focus();
				await new Promise(resolve => window.setTimeout(resolve, 380));
				const away = snapshot();
				editor.setCursor({ line: 1, ch: 12 });
				await new Promise(resolve => window.setTimeout(resolve, 380));
				const inside = snapshot();
				editor.setCursor({ line: 2, ch: 1 });
				await new Promise(resolve => window.setTimeout(resolve, 380));
				const awayAgain = snapshot();
				return { away, inside, awayAgain };
			},
		});
		expect("error" in result).toBe(false);
		if ("away" in result && result.away && result.inside && result.awayAgain) {
			expect(result.away.oversets).toBe(2);
			expect(result.away.undersets).toBe(1);
			expect(result.away.syntaxReplacements).toBe(8);
			expect(result.away.sourceLines.join(" ")).not.toMatch(/\\(?:textcolor|color)\{|#B2A2C7|\{v\}/);
			expect(result.away.widgets.map(widget => widget.color)).toEqual([
				"rgb(178, 162, 199)",
				"rgb(84, 141, 212)",
				"rgb(217, 150, 148)",
			]);
			expect(result.away.plainColor.some(el => el.text === "v" && el.color === "rgb(217, 150, 148)")).toBe(true);
			expect(result.inside.sourceLines.join(" ")).toContain("\\textcolor{");
			expect(result.awayAgain.sourceLines).toEqual(result.away.sourceLines);
			expect(result.awayAgain.widgets.map(widget => widget.color))
				.toEqual(result.away.widgets.map(widget => widget.color));
		}
	}, 30_000);
});
