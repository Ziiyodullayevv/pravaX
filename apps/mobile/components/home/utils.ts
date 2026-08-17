export function colorWithAlpha(color: string, alpha: number) {
	const normalized = color.trim();
	if (normalized.startsWith("rgb(")) {
		const values = normalized
			.replace("rgb(", "")
			.replace(")", "")
			.split(",")
			.map((item) => item.trim())
			.slice(0, 3);
		if (values.length === 3) {
			return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
		}
	}

	if (normalized.startsWith("#")) {
		const hex = normalized.slice(1);
		const fullHex =
			hex.length === 3
				? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
				: hex;
		if (fullHex.length === 6) {
			const r = Number.parseInt(fullHex.slice(0, 2), 16);
			const g = Number.parseInt(fullHex.slice(2, 4), 16);
			const b = Number.parseInt(fullHex.slice(4, 6), 16);
			return `rgba(${r}, ${g}, ${b}, ${alpha})`;
		}
	}

	return color;
}
