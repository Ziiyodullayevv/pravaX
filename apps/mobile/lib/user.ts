import type { BackendUser } from "@/features/auth/api";
import { apiBaseUrl } from "@/lib/api";

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

const pickString = (...values: unknown[]) =>
	values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();

const pickPhotoString = (...values: unknown[]) => {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}

		const record = asRecord(value);
		const fromRecord = pickString(
			record?.url,
			record?.file_url,
			record?.file,
			record?.path,
			record?.photo_url,
			record?.avatar_url,
			record?.image_url,
		);
		if (fromRecord) return fromRecord;
	}

	return undefined;
};

function resolveImageUrl(value: string) {
	if (/^https?:\/\//i.test(value)) return value;
	if (value.startsWith("//")) return `https:${value}`;
	if (value.startsWith("/")) return `${apiBaseUrl}${value}`;
	return value;
}

function getTelegramMeta(user: BackendUser | null | undefined) {
	const meta = asRecord(user?.user_metadata) ?? {};

	return (
		asRecord(user?.telegram) ??
		asRecord(user?.telegram_user) ??
		asRecord(user?.telegram_data) ??
		asRecord(meta.telegram) ??
		asRecord(meta.telegram_user) ??
		{}
	);
}

/**
 * Returns the best available display name for a user.
 * Prefers given_name → full_name → name from user_metadata, then email prefix.
 */
export function getUserDisplayName(
	user: BackendUser | null | undefined,
	fallback = "Foydalanuvchi",
): string {
	const meta = asRecord(user?.user_metadata) ?? {};
	const telegram = getTelegramMeta(user);
	const fullName = [
		pickString(user?.first_name, telegram.first_name, meta.first_name, meta.given_name),
		pickString(user?.last_name, telegram.last_name, meta.last_name, meta.family_name),
	]
		.filter(Boolean)
		.join(" ")
		.trim();

	const rawName =
		fullName ||
		pickString(
			user?.full_name,
			user?.name,
			meta.full_name,
			meta.name,
			telegram.full_name,
			telegram.name,
			user?.username,
			user?.telegram_username,
			meta.username,
			telegram.username,
		) ||
		"";

	if (rawName.length > 0) {
		return rawName;
	}

	const fromEmail = (user?.email?.split("@")[0] ?? "")
		.split(/[._-]/)[0]
		.trim();

	const fromPhone = (user?.phone_number ?? user?.phone ?? "").trim();

	return fromEmail.length > 0 ? fromEmail : fromPhone || fallback;
}

/**
 * Returns a valid avatar URI for the user. Empty string means fallback text should be used.
 */
export function getUserAvatarUri(user: BackendUser | null | undefined): string {
	const meta = asRecord(user?.user_metadata) ?? {};
	const telegram = getTelegramMeta(user);
	const raw = pickString(
		user?.photo_url,
		user?.avatar_url,
		user?.profile_photo_url,
		user?.telegram_photo_url,
		user?.image_url,
		user?.picture,
		user?.photo,
		telegram.photo_url,
		telegram.avatar_url,
		telegram.profile_photo_url,
		telegram.telegram_photo_url,
		telegram.image_url,
		telegram.picture,
		telegram.photo,
		telegram.profile_photo,
		meta.photo_url,
		meta.avatar_url,
		meta.profile_photo_url,
		meta.telegram_photo_url,
		meta.image_url,
		meta.picture,
		meta.profile_photo,
	) ??
		pickPhotoString(
			user?.photo,
			user?.avatar,
			user?.profile_photo,
			telegram.photo,
			telegram.avatar,
			telegram.profile_photo,
			meta.photo,
			meta.avatar,
			meta.profile_photo,
		);
	if (typeof raw === "string" && raw.trim().length > 0) {
		return resolveImageUrl(raw.trim());
	}
	return "";
}

export function getUserInitials(
	user: BackendUser | null | undefined,
	fallback = "PG",
): string {
	const displayName = getUserDisplayName(user, fallback).trim();
	const parts = displayName.split(/\s+/).filter(Boolean);

	if (parts.length >= 2) {
		return `${Array.from(parts[0])[0] ?? ""}${Array.from(parts[1])[0] ?? ""}`.toUpperCase();
	}

	const firstPart = parts[0] ?? fallback;
	return Array.from(firstPart).slice(0, 2).join("").toUpperCase();
}

export function getUserUsername(user: BackendUser | null | undefined): string {
	const username = getUserRawUsername(user);

	if (!username) return "";
	return username.startsWith("@") ? username : `@${username}`;
}

function getUserRawUsername(user: BackendUser | null | undefined): string {
	const meta = asRecord(user?.user_metadata) ?? {};
	const telegram = getTelegramMeta(user);
	const username = pickString(
		user?.username,
		user?.telegram_username,
		telegram.username,
		meta.username,
		meta.preferred_username,
	);

	return username?.replace(/^@/, "") ?? "";
}

export function getUserProfileMeta(user: BackendUser | null | undefined): string {
	const meta = asRecord(user?.user_metadata) ?? {};
	const telegram = getTelegramMeta(user);
	const phone = pickString(
		user?.phone_number,
		user?.phone,
		telegram.phone_number,
		telegram.phone,
		meta.phone_number,
		meta.phone,
	);
	const username = getUserRawUsername(user);

	return [phone, username].filter(Boolean).join(" · ");
}
