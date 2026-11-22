import { describe, expect, it } from "vitest";
import { evalInObsidian } from "obsidian-integration-testing";
import { getTemporaryVault } from "obsidian-integration-testing/vitest-global-setup-plugin";
import type { MarkdownView } from "obsidian";

type PreviewSettings = {
	mathPreviewEnabled: boolean;
	mathPreviewPositionIsAbove: boolean;
	mathPreviewLivePreviewDisplay: boolean;
};
type LatexSuiteTestPlugin = {
	settings: PreviewSettings;
	saveSettings(): Promise<void>;
};

const formula = [
	"$$",
	"\\begin{aligned}",
	...Array.from({ length: 26 }, (_, i) => "a_{" + i + "} &= b_{" + i + "} + c_{" + i + "} \\\\"),
	"\\end{aligned}",
	"$$",
].join("\n");

describe("math preview popup positioning", () => {
	it("keeps tall multiline previews near the caret, inside the viewport, and scrollable", async () => {
		const vault = getTemporaryVault();
		const result = await evalInObsidian({
			vaultPath: vault.path,
			input: { formula },
			callback: async ({ app, formula }) => {
				const plugin = (app as unknown as {
					plugins: { plugins: Record<string, LatexSuiteTestPlugin | undefined> };
				}).plugins.plugins["obsidian-latex-suite"];
				if (!plugin) return { error: "plugin not loaded" };
				plugin.settings.mathPreviewEnabled = true;
				plugin.settings.mathPreviewPositionIsAbove = true;
				plugin.settings.mathPreviewLivePreviewDisplay = true;
				await plugin.saveSettings();
				const file = await app.vault.create("Long Preview.md", formula);
				const leaf = app.workspace.getLeaf(true);
				await leaf.openFile(file);
				const view = leaf.view as MarkdownView;
				const editor = view.editor;
				const getPosition = () => {
					const popup = document.querySelector<HTMLElement>(".cm-tooltip-cursor");
					const math = popup?.querySelector<HTMLElement>(".MathJax") ?? null;
					const cm = (editor as unknown as {
						cm?: {
							coordsAtPos(pos: number): { top: number; bottom: number } | null;
							state: { selection: { main: { head: number } } };
						};
					}).cm;
					const rect = popup?.getBoundingClientRect();
					const caret = cm?.coordsAtPos(cm.state.selection.main.head);
					return {
						viewport: { width: window.innerWidth, height: window.innerHeight },
						popup: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height } : null,
						caret,
						math: math ? {
							clientHeight: math.clientHeight,
							scrollHeight: math.scrollHeight,
							overflowY: window.getComputedStyle(math).overflowY,
							error: !!math.querySelector("mjx-merror"),
						} : null,
					};
				};
				editor.setCursor({ line: 26, ch: 10 });
				editor.focus();
				await new Promise(resolve => window.setTimeout(resolve, 500));
				const nearBottom = getPosition();
				editor.setCursor({ line: 4, ch: 10 });
				await new Promise(resolve => window.setTimeout(resolve, 500));
				const nearTop = getPosition();
				return { nearBottom, nearTop };
			},
		});
		expect("error" in result).toBe(false);
		if ("nearBottom" in result && result.nearBottom && result.nearTop) {
			for (const sample of [result.nearBottom, result.nearTop]) {
				if (!sample.popup || !sample.caret || !sample.math)
					throw new Error("No anchored math preview in the test vault");
				expect(sample.popup.top).toBeGreaterThanOrEqual(0);
				expect(sample.popup.bottom).toBeLessThanOrEqual(sample.viewport.height + 2);
				expect(sample.popup.left).toBeGreaterThanOrEqual(0);
				expect(sample.popup.right).toBeLessThanOrEqual(sample.viewport.width + 2);
				expect(sample.popup.height).toBeLessThanOrEqual(sample.viewport.height * 0.75);
				expect(sample.math.overflowY).toBe("auto");
				expect(sample.math.error).toBe(false);
				expect(Math.min(
					Math.abs(sample.popup.top - sample.caret.bottom),
					Math.abs(sample.popup.bottom - sample.caret.top),
				)).toBeLessThan(100);
			}
			expect(result.nearBottom.math?.scrollHeight)
				.toBeGreaterThan(result.nearBottom.math?.clientHeight ?? Infinity);
		} else {
			throw new Error("No math preview data in test vault");
		}
	}, 30_000);
});
