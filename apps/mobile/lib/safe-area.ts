export function getFloatingActionBottomOffset(
	bottomInset: number,
	defaultOffset = 20,
) {
	return bottomInset >= 16 ? bottomInset + 10 : defaultOffset;
}

export function getFloatingActionContentPadding(
	bottomInset: number,
	extraPadding = 112,
) {
	return getFloatingActionBottomOffset(bottomInset) + extraPadding;
}
