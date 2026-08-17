import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, {
	type AxiosRequestConfig,
	type InternalAxiosRequestConfig,
} from "axios";

type TokenPair = {
	accessToken?: string | null;
	refreshToken?: string | null;
};

type RetryableAxiosRequestConfig = InternalAxiosRequestConfig & {
	_retry?: boolean;
};

type ApiRecord = Record<string, unknown>;

export const JWT_STORAGE_KEY = "jwt_access_token";
export const JWT_REFRESH_KEY = "jwt_refresh_token";

const DEFAULT_API_URL = "https://api.pravax.uz";

const asRecord = (value: unknown): ApiRecord | null =>
	typeof value === "object" && value !== null ? (value as ApiRecord) : null;

const pickString = (...values: unknown[]) =>
	values.find(
		(value): value is string => typeof value === "string" && value.length > 0,
	);

const normalizeServerUrl = (serverUrl: string) => serverUrl.replace(/\/+$/, "");

export const apiBaseUrl = normalizeServerUrl(
	process.env.EXPO_PUBLIC_API_BASE_URL ??
		process.env.EXPO_PUBLIC_API_URL ??
		DEFAULT_API_URL,
);

export const endpoints = {
	auth: {
		logout: "/api/auth/logout/",
		me: "/api/auth/me/",
		telegram: "/api/auth/telegram/",
		telegramSession: "/api/auth/telegram/session/",
		telegramSessionStatus: (token: string) =>
			`/api/auth/telegram/session/${encodeURIComponent(token)}/`,
		telegramVerify: "/api/auth/telegram/verify/",
		refresh: "/api/auth/token/refresh/",
	},
	contests: {
		details: (id: string | number) => `/api/contests/${id}/`,
		join: (id: string | number) => `/api/contests/${id}/join/`,
		list: "/api/contests/",
		my: "/api/contests/my/",
		questions: (id: string | number) => `/api/contests/${id}/questions/`,
		ranking: (id: string | number) => `/api/contests/${id}/ranking/`,
		submit: (id: string | number) => `/api/contests/${id}/submit/`,
		academy: "/api/contests/academy/",
		academyJoin: "/api/contests/academy/join/",
	},
	tokens: {
		balance: "/api/tokens/balance/",
		history: "/api/tokens/history/",
		subscription: "/api/tokens/subscription/",
	},
	payments: {
		initiate: "/api/payments/initiate/",
		detail: (id: number) => `/api/payments/${id}/`,
		my: "/api/payments/my/",
	},
	quiz: {
		categories: "/api/quiz/categories/",
		mistakes: "/api/quiz/mistakes/",
		practice: "/api/quiz/practice/",
		questions: "/api/quiz/questions/",
		questionDetail: (id: string | number) => `/api/quiz/questions/${id}/`,
		saved: "/api/quiz/saved/",
		savedDelete: (questionId: string | number) => `/api/quiz/saved/${questionId}/`,
		sessionAbandon: (id: string | number) => `/api/quiz/sessions/${id}/abandon/`,
		sessionDetail: (id: string | number) => `/api/quiz/sessions/${id}/`,
		sessionSubmit: (id: string | number) => `/api/quiz/sessions/${id}/submit/`,
		sessions: "/api/quiz/sessions/",
		test: "/api/quiz/test/",
	},
	signs: {
		detail: (id: string | number) => `/api/signs/${id}/`,
		sectionSigns: (sectionId: string | number) =>
			`/api/signs/sections/${sectionId}/signs/`,
		sections: "/api/signs/sections/",
	},
} as const;

export const getAccessToken = () => AsyncStorage.getItem(JWT_STORAGE_KEY);
export const getRefreshToken = () => AsyncStorage.getItem(JWT_REFRESH_KEY);

export const clearAuthTokens = async () => {
	await AsyncStorage.multiRemove([JWT_STORAGE_KEY, JWT_REFRESH_KEY]);
	delete axiosInstance.defaults.headers.common.Authorization;
};

export const setAuthTokens = async ({ accessToken, refreshToken }: TokenPair) => {
	const writes: [string, string][] = [];

	if (accessToken) {
		writes.push([JWT_STORAGE_KEY, accessToken]);
		axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
	}

	if (refreshToken) {
		writes.push([JWT_REFRESH_KEY, refreshToken]);
	}

	if (writes.length > 0) {
		await AsyncStorage.multiSet(writes);
	}
};

export const extractTokens = (payload: unknown): Required<TokenPair> => {
	const root = asRecord(payload);
	const data = asRecord(root?.data);
	const tokens = asRecord(root?.tokens);

	return {
		accessToken:
			pickString(
				data?.access_token,
				data?.access,
				tokens?.access_token,
				tokens?.access,
				root?.access_token,
				root?.access,
			) ?? null,
		refreshToken:
			pickString(
				data?.refresh_token,
				data?.refresh,
				tokens?.refresh_token,
				tokens?.refresh,
				root?.refresh_token,
				root?.refresh,
			) ?? null,
	};
};

export const getErrorMessage = (error: unknown) => {
	if (axios.isAxiosError(error)) {
		if (error.response) {
			const payload = asRecord(error.response.data);

			return (
				pickString(payload?.message, payload?.error, payload?.detail) ||
				`Server error (${error.response.status})`
			);
		}

		if (error.request) {
			if (error.code === "ECONNABORTED") {
				return "Request timed out. Please try again.";
			}

			if (error.message?.includes("Network Error")) {
				return "Network error - check your connection or server availability.";
			}

			return "No response from server. Please try again.";
		}
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong.";
};

export const axiosInstance = axios.create({
	baseURL: apiBaseUrl,
	timeout: 15_000,
	headers: {
		"Content-Type": "application/json",
	},
});

axiosInstance.interceptors.request.use(async (config) => {
	const token = await getAccessToken();

	if (token && !config.headers.Authorization) {
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});

let isRefreshing = false;
let failedQueue: {
	reject: (error: unknown) => void;
	resolve: (token: string) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
	failedQueue.forEach(({ reject, resolve }) => {
		if (error) {
			reject(error);
			return;
		}

		resolve(token ?? "");
	});

	failedQueue = [];
};

axiosInstance.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

		if (
			error?.response?.status === 401 &&
			originalRequest &&
			!originalRequest._retry &&
			originalRequest.url !== endpoints.auth.refresh
		) {
			if (isRefreshing) {
				return new Promise<string>((resolve, reject) => {
					failedQueue.push({ reject, resolve });
				}).then((token) => {
					originalRequest.headers.Authorization = `Bearer ${token}`;
					return axiosInstance(originalRequest);
				});
			}

			originalRequest._retry = true;
			isRefreshing = true;

			const refreshToken = await getRefreshToken();

			if (!refreshToken) {
				isRefreshing = false;
				await clearAuthTokens();
				return Promise.reject(new Error("Session expired. Please sign in again."));
			}

			try {
				const refreshResponse = await axios.post(
					`${apiBaseUrl}${endpoints.auth.refresh}`,
					{ refresh: refreshToken, refresh_token: refreshToken },
				);
				const { accessToken, refreshToken: nextRefreshToken } = extractTokens(
					refreshResponse.data,
				);

				if (!accessToken) {
					throw new Error("Refresh response did not include an access token.");
				}

				await setAuthTokens({
					accessToken,
					refreshToken: nextRefreshToken,
				});

				processQueue(null, accessToken);
				originalRequest.headers.Authorization = `Bearer ${accessToken}`;

				return axiosInstance(originalRequest);
			} catch (refreshError) {
				processQueue(refreshError, null);
				await clearAuthTokens();
				return Promise.reject(new Error(getErrorMessage(refreshError)));
			} finally {
				isRefreshing = false;
			}
		}

		return Promise.reject(new Error(getErrorMessage(error)));
	},
);

export const fetcher = async <T = unknown>(
	args: string | [string, AxiosRequestConfig],
): Promise<T> => {
	const [url, config] = Array.isArray(args) ? args : [args, {}];
	const response = await axiosInstance.get<T>(url, config);

	return response.data;
};
