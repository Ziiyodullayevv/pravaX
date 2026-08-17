import type { ImageSourcePropType } from "react-native";
import { Image } from "react-native";

// Question images are loaded remotely; local assets have been removed.
const QUESTION_IMAGE_BY_KEY: Record<string, ImageSourcePropType> = {};

const imageUriCache = new Map<string, string>();

export function resolveQuestionImageUri(imageKey?: string | null) {
	const normalized = (imageKey ?? "").trim();
	if (!normalized) return null;

	const cached = imageUriCache.get(normalized);
	if (cached) return cached;

	const source = QUESTION_IMAGE_BY_KEY[normalized];
	if (!source) return null;

	const resolved = Image.resolveAssetSource(source);
	if (!resolved?.uri) return null;

	imageUriCache.set(normalized, resolved.uri);
	return resolved.uri;
}

export function hasQuestionImage(imageKey?: string | null) {
	const normalized = (imageKey ?? "").trim();
	if (!normalized) return false;
	return Boolean(QUESTION_IMAGE_BY_KEY[normalized]);
}
