type VerticalRect = { top: number; bottom: number };

export function chooseMathPreviewPlacement(
	caret: VerticalRect,
	viewport: VerticalRect,
	preferAbove: boolean,
	multiline: boolean,
): { above: boolean; maxHeight: number } {
	const gap = 10;
	const roomAbove = Math.max(0, caret.top - viewport.top - gap);
	const roomBelow = Math.max(0, viewport.bottom - caret.bottom - gap);
	const above = multiline
		? (Math.abs(roomAbove - roomBelow) < 20 ? preferAbove : roomAbove > roomBelow)
		: (preferAbove ? roomAbove >= 100 || roomAbove >= roomBelow : roomBelow < 100 && roomAbove > roomBelow);
	const room = above ? roomAbove : roomBelow;
	const heightLimit = Math.max(1, (viewport.bottom - viewport.top) * 0.7);
	return {
		above,
		maxHeight: Math.floor(Math.max(1, Math.min(heightLimit, room - 8))),
	};
}
