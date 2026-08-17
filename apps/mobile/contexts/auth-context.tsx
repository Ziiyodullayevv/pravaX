import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
	authQueryKeys,
	getCurrentUser,
	logoutCurrentUser,
	type BackendUser,
} from "@/features/auth/api";
import { clearAuthTokens, getAccessToken } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

type AuthContextValue = {
	session: null;
	user: BackendUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	accessToken: string | null;
	completeTelegramAuth: (input: {
		accessToken: string;
		user: BackendUser;
	}) => Promise<void>;
	refreshSession: () => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_USER_STORAGE_KEY = "auth_user";

const readStoredUser = async () => {
	try {
		const raw = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as BackendUser;
	} catch {
		return null;
	}
};

const writeStoredUser = async (user: BackendUser | null) => {
	try {
		if (!user) {
			await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
			return;
		}

		await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
	} catch {
		// User profile cache is a convenience only; auth tokens remain the source of truth.
	}
};

const pickProfileValue = <T,>(currentValue: T | null | undefined, storedValue: T | null | undefined) =>
	currentValue ?? storedValue ?? null;

const mergeUserProfile = (
	currentUser: BackendUser,
	storedUser: BackendUser | null,
): BackendUser => {
	if (!storedUser) return currentUser;

	return {
		...storedUser,
		...currentUser,
		first_name: pickProfileValue(currentUser.first_name, storedUser.first_name),
		last_name: pickProfileValue(currentUser.last_name, storedUser.last_name),
		username: pickProfileValue(currentUser.username, storedUser.username),
		telegram_username: pickProfileValue(
			currentUser.telegram_username,
			storedUser.telegram_username,
		),
		photo_url: pickProfileValue(currentUser.photo_url, storedUser.photo_url),
		avatar_url: pickProfileValue(currentUser.avatar_url, storedUser.avatar_url),
		profile_photo_url: pickProfileValue(
			currentUser.profile_photo_url,
			storedUser.profile_photo_url,
		),
		telegram_photo_url: pickProfileValue(
			currentUser.telegram_photo_url,
			storedUser.telegram_photo_url,
		),
		phone_number: pickProfileValue(currentUser.phone_number, storedUser.phone_number),
		phone: pickProfileValue(currentUser.phone, storedUser.phone),
		user_metadata: {
			...(storedUser.user_metadata ?? {}),
			...(currentUser.user_metadata ?? {}),
		},
	};
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<BackendUser | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const isMountedRef = useRef(false);

	const refreshSession = async () => {
		const token = await getAccessToken();
		if (!isMountedRef.current) return;
		setAccessToken(token);

		if (!token) {
			setUser(null);
			queryClient.setQueryData(authQueryKeys.me, null);
			await writeStoredUser(null);
			return;
		}

		const storedUser = await readStoredUser();
		if (storedUser && isMountedRef.current) {
			setUser(storedUser);
			queryClient.setQueryData(authQueryKeys.me, storedUser);
		}

		const currentUser = await getCurrentUser();
		if (!isMountedRef.current) return;
		const nextUser = mergeUserProfile(currentUser, storedUser);
		setUser(nextUser);
		queryClient.setQueryData(authQueryKeys.me, nextUser);
		await writeStoredUser(nextUser);
	};

	const signOut = async () => {
		try {
			await logoutCurrentUser();
		} finally {
			setAccessToken(null);
			setUser(null);
			await writeStoredUser(null);
			queryClient.setQueryData(authQueryKeys.me, null);
			queryClient.removeQueries({ queryKey: authQueryKeys.me });
		}
	};

	const completeTelegramAuth: AuthContextValue["completeTelegramAuth"] = async ({
		accessToken: nextAccessToken,
		user: nextUser,
	}) => {
		setAccessToken(nextAccessToken);
		setUser(nextUser);
		await writeStoredUser(nextUser);
		queryClient.setQueryData(authQueryKeys.me, nextUser);
	};

	useEffect(() => {
		isMountedRef.current = true;

		const init = async () => {
			try {
				if (!isMountedRef.current) return;
				await refreshSession();
			} catch {
				if (isMountedRef.current) {
					await clearAuthTokens();
					if (!isMountedRef.current) return;
					setAccessToken(null);
					setUser(null);
					await writeStoredUser(null);
				}
			} finally {
				if (isMountedRef.current) setIsLoading(false);
			}
		};

		init().catch(() => {
			if (isMountedRef.current) {
				setUser(null);
				setIsLoading(false);
			}
		});

		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({
			session: null,
			user,
			isLoading,
			isAuthenticated: Boolean(user && accessToken),
			accessToken,
			completeTelegramAuth,
			refreshSession,
			signOut,
		}),
		[user, isLoading, accessToken],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within AuthProvider");
	return context;
}
