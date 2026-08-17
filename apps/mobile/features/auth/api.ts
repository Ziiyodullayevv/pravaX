import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	axiosInstance,
	clearAuthTokens,
	endpoints,
	extractTokens,
	getRefreshToken,
	setAuthTokens,
} from "@/lib/api";

export type BackendUser = {
	id: string;
	phone_number?: string | null;
	phone?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	full_name?: string | null;
	name?: string | null;
	username?: string | null;
	telegram_id?: string | number | null;
	telegram_username?: string | null;
	email?: string | null;
	avatar_url?: string | null;
	image_url?: string | null;
	photo_url?: string | null;
	profile_photo_url?: string | null;
	telegram_photo_url?: string | null;
	is_premium?: boolean | null;
	role?: string | null;
	status?: string | null;
	auth_source?: string | null;
	user_metadata?: Record<string, unknown>;
	academy?: {
		id: number;
		name: string;
		invite_code?: string | null;
		joined_at?: string | null;
		[key: string]: unknown;
	} | null;
	[key: string]: unknown;
};

export type TelegramVerifyInput = {
	phoneNumber: string;
	code: string;
};


export type TelegramSession = {
	token: string;
	bot_url: string;
	expires_at?: string | null;
	[key: string]: unknown;
};

export type TelegramSessionStatus =
	| "pending"
	| "success"
	| "auth_success"
	| "expired"
	| "error";

export type TelegramSessionStatusResponse = {
	status?: TelegramSessionStatus | string;
	state?: TelegramSessionStatus | string;
	event?: string;
	user?: BackendUser | null;
	access_token?: string | null;
	access?: string | null;
	refresh_token?: string | null;
	refresh?: string | null;
	message?: string | null;
	[key: string]: unknown;
};

export type CompleteAuthInput = {
	accessToken: string;
	refreshToken?: string | null;
	user?: BackendUser | null;
};

export type UpdateProfileInput = Partial<
	Pick<
		BackendUser,
		| "first_name"
		| "last_name"
		| "username"
		| "email"
		| "phone"
		| "phone_number"
		| "photo_url"
	>
>;

export const authQueryKeys = {
	me: ["auth", "me"] as const,
};

const unwrapData = <T,>(payload: T | { data?: T }) => {
	if (
		payload &&
		typeof payload === "object" &&
		"data" in payload &&
		(payload as { data?: T }).data
	) {
		return (payload as { data: T }).data;
	}

	return payload as T;
};

const unwrapUserPayload = (
	payload: BackendUser | { data?: BackendUser } | { user?: BackendUser },
) => {
	const data = unwrapData(payload as BackendUser | { data?: BackendUser });
	const record = asRecord(data);
	const user = asRecord(record?.user);

	return (user ? user : data) as BackendUser;
};

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

export async function getCurrentUser() {
	const response = await axiosInstance.get<
		BackendUser | { data: BackendUser } | { user: BackendUser }
	>(endpoints.auth.me);

	return normalizeUser(unwrapUserPayload(response.data));
}

export async function updateCurrentUser(input: UpdateProfileInput) {
	const response = await axiosInstance.patch<
		BackendUser | { data: BackendUser } | { user: BackendUser }
	>(endpoints.auth.me, input);

	return normalizeUser(unwrapUserPayload(response.data));
}

function normalizeUser(user: BackendUser): BackendUser {
	const meta = asRecord(user.user_metadata) ?? {};
	const telegram =
		asRecord(user.telegram) ??
		asRecord(user.telegram_user) ??
		asRecord(user.telegram_data) ??
		asRecord(meta.telegram) ??
		asRecord(meta.telegram_user) ??
		{};
	const firstName = pickString(
		user.first_name,
		user.firstName,
		telegram.first_name,
		telegram.firstName,
		meta.first_name,
		meta.given_name,
	);
	const lastName = pickString(
		user.last_name,
		user.lastName,
		telegram.last_name,
		telegram.lastName,
		meta.last_name,
		meta.family_name,
	);
	const username = pickString(
		user.username,
		user.telegram_username,
		telegram.username,
		telegram.telegram_username,
		meta.username,
		meta.preferred_username,
	);
	const photoUrl = pickString(
		user.photo_url,
		user.profile_photo_url,
		user.telegram_photo_url,
		user.image_url,
		user.picture,
		user.photo,
		user.profile_photo,
		telegram.photo_url,
		telegram.profile_photo_url,
		telegram.telegram_photo_url,
		telegram.image_url,
		telegram.picture,
		telegram.photo,
		telegram.profile_photo,
		telegram.avatar_url,
		meta.photo_url,
		meta.profile_photo_url,
		meta.telegram_photo_url,
		meta.image_url,
		meta.picture,
		meta.profile_photo,
		meta.avatar_url,
	);
	const normalizedPhotoUrl =
		photoUrl ??
		pickPhotoString(
			user.photo,
			user.profile_photo,
			telegram.photo,
			telegram.profile_photo,
			meta.photo,
			meta.profile_photo,
		);
	const avatarUrl = pickString(
		user.avatar_url,
		user.avatar,
		user.profile_photo_url,
		user.telegram_photo_url,
		user.image_url,
		telegram.avatar_url,
		telegram.photo_url,
		telegram.profile_photo_url,
		telegram.telegram_photo_url,
		telegram.image_url,
		meta.avatar_url,
		meta.picture,
		normalizedPhotoUrl,
	);
	const normalizedAvatarUrl =
		avatarUrl ??
		pickPhotoString(user.avatar, telegram.avatar, meta.avatar, normalizedPhotoUrl);
	const phoneNumber = pickString(
		user.phone_number,
		user.phone,
		telegram.phone_number,
		telegram.phone,
		meta.phone_number,
		meta.phone,
	);

	return {
		...user,
		id: String(user.id),
		first_name: firstName ?? user.first_name ?? null,
		last_name: lastName ?? user.last_name ?? null,
		username: username ?? user.username ?? null,
		telegram_username:
			pickString(user.telegram_username, telegram.username, username) ??
			user.telegram_username ??
			null,
		phone_number: phoneNumber ?? user.phone_number ?? null,
		phone: pickString(user.phone, phoneNumber) ?? user.phone ?? null,
		photo_url: normalizedPhotoUrl ?? user.photo_url ?? null,
		avatar_url: normalizedAvatarUrl ?? user.avatar_url ?? null,
	};
}

export async function verifyTelegramLogin(input: TelegramVerifyInput) {
	const response = await axiosInstance.post(endpoints.auth.telegramVerify, {
		phone_number: input.phoneNumber,
		phone: input.phoneNumber,
		code: input.code,
	});
	const tokens = extractTokens(response.data);

	if (!tokens.accessToken) {
		throw new Error("Backend access token qaytarmadi.");
	}

	await setAuthTokens(tokens);

	return tokens;
}

export type CreateTelegramSessionInput = {
	redirectUrl?: string | null;
};

export async function createTelegramAuthSession(
	input: CreateTelegramSessionInput = {},
) {
	const body = input.redirectUrl ? { redirect_url: input.redirectUrl } : {};
	const response = await axiosInstance.post<
		TelegramSession | { data: TelegramSession }
	>(endpoints.auth.telegramSession, body);
	return unwrapData(response.data);
}

export async function getTelegramAuthSessionStatus(token: string) {
	const response = await axiosInstance.get<
		TelegramSessionStatusResponse | { data: TelegramSessionStatusResponse }
	>(endpoints.auth.telegramSessionStatus(token));
	return unwrapData(response.data);
}

export async function completeAuthSession(input: CompleteAuthInput) {
	await setAuthTokens({
		accessToken: input.accessToken,
		refreshToken: input.refreshToken,
	});

	if (!input.user) return getCurrentUser();

	try {
		const currentUser = await getCurrentUser();
		return normalizeUser({
			...currentUser,
			...input.user,
			user_metadata: {
				...(currentUser.user_metadata ?? {}),
				...(input.user.user_metadata ?? {}),
			},
		});
	} catch {
		return normalizeUser(input.user);
	}
}

export async function logoutCurrentUser() {
	const refresh = await getRefreshToken();

	try {
		if (refresh) {
			await axiosInstance.post(endpoints.auth.logout, { refresh });
		}
	} finally {
		await clearAuthTokens();
	}
}

export function useCurrentUserQuery(enabled = true) {
	return useQuery({
		queryKey: authQueryKeys.me,
		queryFn: getCurrentUser,
		enabled,
	});
}

export function useUpdateCurrentUserMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: updateCurrentUser,
		onSuccess: (user) => {
			queryClient.setQueryData(authQueryKeys.me, user);
		},
	});
}

export function useTelegramVerifyMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: verifyTelegramLogin,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
		},
	});
}

export function useCreateTelegramAuthSessionMutation() {
	return useMutation({
		mutationFn: createTelegramAuthSession,
	});
}

export function useTelegramAuthSessionStatusQuery(
	token?: string | null,
	enabled = true,
) {
	return useQuery({
		queryKey: ["auth", "telegram-session", token ?? ""],
		queryFn: () => getTelegramAuthSessionStatus(token as string),
		enabled: enabled && Boolean(token),
		refetchInterval: (query) => {
			const data = query.state.data;
			const status = data?.status ?? data?.state ?? data?.event;
			if (
				status === "success" ||
				status === "auth_success" ||
				status === "expired" ||
				status === "error"
			) {
				return false;
			}

			return 2000;
		},
		refetchIntervalInBackground: true,
		retry: 2,
	});
}

export function useCompleteAuthSessionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: completeAuthSession,
		onSuccess: (user) => {
			queryClient.setQueryData(authQueryKeys.me, user);
		},
	});
}

export function useSignOutMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: logoutCurrentUser,
		onSuccess: () => {
			queryClient.setQueryData(authQueryKeys.me, null);
			queryClient.removeQueries({ queryKey: authQueryKeys.me });
		},
	});
}
