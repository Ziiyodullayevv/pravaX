import React, { useCallback, useRef } from "react";
import {
	ActivityIndicator,
	AppState,
	Image as RNImage,
	Linking,
	Pressable,
	View,
	useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Handshake } from "lucide-react-native";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { AuthErrorModal } from "@/components/auth/AuthErrorModal";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import {
	useCompleteAuthSessionMutation,
	useCreateTelegramAuthSessionMutation,
	useTelegramAuthSessionStatusQuery,
	type BackendUser,
	type TelegramSessionStatusResponse,
} from "@/features/auth/api";
import { extractTokens, getErrorMessage } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

const AUTH_TIMEOUT_MS = 120_000;
const TG_SESSION_STORAGE_KEY = "telegram-auth-session-token";
const BRAND_GRADIENT: [string, string, string] = [
	"#ffbd57",
	"#ff9f2f",
	"#ff7a45",
];
const BRAND_ACCENT = "#ff7a45";
const PADDING_H = 44;

type TelegramAuthState =
	| "idle"
	| "creating"
	| "pending"
	| "success"
	| "error"
	| "expired";

function TelegramIcon({ color = "#FFFFFF", size = 24 }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<Path
				fill={color}
				d="M20.665 3.717 2.934 10.554c-1.21.486-1.203 1.161-.222 1.462l4.552 1.421 1.744 5.341c.226.625.115.873.77.873.506 0 .73-.232 1.014-.506l2.435-2.37 5.066 3.741c.934.514 1.607.25 1.84-.865l3.33-15.693c.34-1.366-.522-1.984-1.798-1.241ZM7.976 13.11l10.395-6.553c.519-.315.994-.146.604.2l-8.9 8.033-.347 3.705-1.752-5.385Z"
			/>
		</Svg>
	);
}

function buildTelegramDeepLink(botUrl: string): string | null {
	try {
		const url = new URL(botUrl);
		const domain = url.pathname.split("/").filter(Boolean)[0];
		const start = url.searchParams.get("start");
		if (domain) {
			return `tg://resolve?domain=${encodeURIComponent(domain)}${start ? `&start=${encodeURIComponent(start)}` : ""}`;
		}
	} catch {}
	return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;
}

function getSessionStatus(payload: TelegramSessionStatusResponse | undefined) {
	const record = asRecord(payload);
	const data = asRecord(record?.data);
	return String(
		record?.status ??
			record?.state ??
			record?.event ??
			data?.status ??
			data?.state ??
			"",
	).toLowerCase();
}

function getSessionUser(payload: TelegramSessionStatusResponse | undefined) {
	const record = asRecord(payload);
	const data = asRecord(record?.data);
	const user =
		asRecord(record?.user) ??
		asRecord(data?.user) ??
		asRecord(record?.telegram_user) ??
		asRecord(data?.telegram_user) ??
		asRecord(record?.telegram) ??
		asRecord(data?.telegram);
	return user ? ({ ...user, id: String(user.id) } as BackendUser) : null;
}

export default function LoginScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { isAuthenticated, completeTelegramAuth } = useAuth();
	const isDark = colorMode === "dark";
	const { height: windowHeight } = useWindowDimensions();

	const PADDING_TOP = Math.max(insets.top, 10) + 100;
	const PADDING_BOTTOM = Math.max(insets.bottom, 24);

	// ─── Auth state ───────────────────────────────────────────────────────────
	const createSessionMutation = useCreateTelegramAuthSessionMutation();
	const completeAuthMutation = useCompleteAuthSessionMutation();
	const [sessionToken, setSessionToken] = React.useState<string | null>(null);
	const [authState, setAuthState] = React.useState<TelegramAuthState>("idle");
	const authCompletedRef = React.useRef(false);
	const [errorModal, setErrorModal] = React.useState({
		isOpen: false,
		title: "",
		message: "",
	});

	const statusQuery = useTelegramAuthSessionStatusQuery(
		sessionToken,
		authState === "pending",
	);
	const isBusy =
		authState === "creating" ||
		authState === "pending" ||
		completeAuthMutation.isPending;

	React.useEffect(() => {
		if (isAuthenticated) router.replace("/tabs/home");
	}, [isAuthenticated, router]);

	// Ilova qayta ishga tushganda saqlangan sessiyani tiklash
	React.useEffect(() => {
		(async () => {
			try {
				const stored = await AsyncStorage.getItem(TG_SESSION_STORAGE_KEY);
				if (stored) {
					setSessionToken(stored);
					setAuthState("pending");
				}
			} catch {}
		})();
	}, []);

	React.useEffect(() => {
		if (authState !== "pending" || !sessionToken) return undefined;
		const timeout = setTimeout(() => {
			setAuthState("expired");
			setSessionToken(null);
		}, AUTH_TIMEOUT_MS);
		return () => clearTimeout(timeout);
	}, [authState, sessionToken]);

	// Bot tugmasi bosilib ilova ochilsa — darhol status refetch
	React.useEffect(() => {
		if (authState !== "pending") return undefined;
		const sub = ExpoLinking.addEventListener("url", ({ url }) => {
			if (url.includes("login-success")) statusQuery.refetch();
		});
		return () => sub.remove();
	}, [authState, statusQuery]);

	// Foydalanuvchi qo'lda ilovaga qaytganda ham status yangilansin
	React.useEffect(() => {
		if (authState !== "pending") return undefined;
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") statusQuery.refetch();
		});
		return () => sub.remove();
	}, [authState, statusQuery]);

	React.useEffect(() => {
		const payload = statusQuery.data;
		if (!payload || authState !== "pending") return;

		const status = getSessionStatus(payload);
		const tokens = extractTokens(payload);
		const hasSuccessPayload =
			Boolean(tokens.accessToken) ||
			status === "success" ||
			status === "auth_success" ||
			status === "authenticated";

		if (status === "expired") {
			setAuthState("expired");
			setSessionToken(null);
			AsyncStorage.removeItem(TG_SESSION_STORAGE_KEY).catch(() => {});
			return;
		}
		if (status === "error" || status === "failed") {
			setAuthState("error");
			setSessionToken(null);
			AsyncStorage.removeItem(TG_SESSION_STORAGE_KEY).catch(() => {});
			setErrorModal({
				isOpen: true,
				title: "Telegram login amalga oshmadi",
				message:
					(typeof payload.message === "string" && payload.message) ||
					"Qayta urinib ko'ring.",
			});
			return;
		}
		if (!hasSuccessPayload || authCompletedRef.current) return;
		if (!tokens.accessToken) {
			setAuthState("error");
			setSessionToken(null);
			AsyncStorage.removeItem(TG_SESSION_STORAGE_KEY).catch(() => {});
			setErrorModal({
				isOpen: true,
				title: "Telegram login amalga oshmadi",
				message: "Backend access token qaytarmadi.",
			});
			return;
		}

		const accessToken = tokens.accessToken;
		authCompletedRef.current = true;

		(async () => {
			try {
				setAuthState("success");
				const user = await completeAuthMutation.mutateAsync({
					accessToken,
					refreshToken: tokens.refreshToken,
					user: getSessionUser(payload),
				});
				await completeTelegramAuth({ accessToken, user });
				await AsyncStorage.removeItem(TG_SESSION_STORAGE_KEY).catch(
					() => {},
				);
				router.replace("/tabs/home");
			} catch (error) {
				authCompletedRef.current = false;
				setAuthState("error");
				setSessionToken(null);
				AsyncStorage.removeItem(TG_SESSION_STORAGE_KEY).catch(() => {});
				setErrorModal({
					isOpen: true,
					title: "Telegram login amalga oshmadi",
					message: getErrorMessage(error),
				});
			}
		})();
	}, [
		authState,
		completeAuthMutation,
		completeTelegramAuth,
		router,
		statusQuery.data,
	]);

	const handleTelegramLogin = async () => {
		if (isBusy) return;
		setAuthState("creating");
		setSessionToken(null);
		authCompletedRef.current = false;
		try {
			const redirectUrl = ExpoLinking.createURL("login-success");
			const session = await createSessionMutation.mutateAsync({ redirectUrl });
			if (!session.token || !session.bot_url)
				throw new Error(
					"Backend Telegram sessiya ma'lumotini to'liq qaytarmadi.",
				);
			setSessionToken(session.token);
			setAuthState("pending");
			await AsyncStorage.setItem(TG_SESSION_STORAGE_KEY, session.token).catch(
				() => {},
			);
			try {
				const tgDeepLink = buildTelegramDeepLink(session.bot_url);
				let opened = false;
				if (tgDeepLink) {
					try {
						const canOpen = await Linking.canOpenURL(tgDeepLink);
						if (canOpen) {
							await Linking.openURL(tgDeepLink);
							opened = true;
						}
					} catch {}
				}
				if (!opened) await Linking.openURL(session.bot_url);
			} catch (openError) {
				setAuthState("error");
				setSessionToken(null);
				throw openError;
			}
		} catch (error) {
			setAuthState("error");
			setErrorModal({
				isOpen: true,
				title: "Telegram ochilmadi",
				message: getErrorMessage(error),
			});
		}
	};

	const buttonLabel =
		authState === "creating"
			? "Yuklanmoqda..."
			: authState === "pending"
				? "Telegramda tasdiqlang"
				: authState === "expired" || authState === "error"
					? "Qayta urinish"
					: "Telegram orqali kirish";

	// ─── Animation ────────────────────────────────────────────────────────────
	const topTranslateY = useSharedValue(0);
	const topScale = useSharedValue(0.8);
	const topOpacity = useSharedValue(0);
	const bottomTranslateY = useSharedValue(300);
	const bottomOpacity = useSharedValue(0);
	const loadingOpacity = useSharedValue(0);
	const layoutDoneRef = useRef(false);

	const handleTopLayout = useCallback(
		(e: { nativeEvent: { layout: { height: number } } }) => {
			if (layoutDoneRef.current) return;
			layoutDoneRef.current = true;

			const h = e.nativeEvent.layout.height;
			const centerOffset = Math.max(0, (windowHeight - h) / 2 - PADDING_TOP);

			// Place top section at vertical center (invisible)
			topTranslateY.value = centerOffset;

			requestAnimationFrame(() => {
				// Phase 1: zoom in (0 → 900ms)
				topOpacity.value = withTiming(1, {
					duration: 700,
					easing: Easing.out(Easing.quad),
				});
				topScale.value = withTiming(1, {
					duration: 900,
					easing: Easing.out(Easing.cubic),
				});

				// Hold 3s at center, then phase 2 (3900ms → 4750ms)
				const PHASE2_DELAY = 900 + 1500;

				// Loading: fade in at 800ms, hold, fade out just before phase 2
				loadingOpacity.value = withDelay(
					800,
					withSequence(
						withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
						withDelay(
							1000,
							withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
						),
					),
				);

				const MOVE_DURATION = 750;
				const MOVE_EASING = Easing.out(Easing.cubic);

				topTranslateY.value = withDelay(
					PHASE2_DELAY,
					withTiming(0, { duration: MOVE_DURATION, easing: MOVE_EASING }),
				);
				bottomTranslateY.value = withDelay(
					PHASE2_DELAY,
					withTiming(0, { duration: MOVE_DURATION, easing: MOVE_EASING }),
				);
				bottomOpacity.value = withDelay(
					PHASE2_DELAY,
					withTiming(1, { duration: MOVE_DURATION, easing: MOVE_EASING }),
				);
			});
		},
		[windowHeight, PADDING_TOP],
	);

	const topAnimatedStyle = useAnimatedStyle(() => ({
		opacity: topOpacity.value,
		transform: [{ translateY: topTranslateY.value }, { scale: topScale.value }],
	}));

	const loadingAnimatedStyle = useAnimatedStyle(() => ({
		opacity: loadingOpacity.value,
	}));

	const bottomAnimatedStyle = useAnimatedStyle(() => ({
		opacity: bottomOpacity.value,
		transform: [{ translateY: bottomTranslateY.value }],
	}));

	// ─── Render ───────────────────────────────────────────────────────────────
	const bg = isDark ? "#000000" : "#ffffff";

	return (
		<View style={{ flex: 1, backgroundColor: bg }}>
			{/* Top section — starts centered, animates to top */}
			<Animated.View
				onLayout={handleTopLayout}
				style={[
					{
						position: "absolute",
						top: PADDING_TOP,
						left: PADDING_H,
						right: PADDING_H,
					},
					topAnimatedStyle,
				]}
			>
				<View
					style={{
						width: 70,
						height: 70,
						borderRadius: 16,
						boxShadow: "0px 2px 10px #3333",
						overflow: "hidden",
					}}
				>
					<RNImage
						source={
							isDark
								? require("../../assets/images/splash-icon-white.png")
								: require("../../assets/images/splash-icon-dark.png")
						}
						style={{ width: 70, height: 70 }}
						resizeMode="cover"
					/>
				</View>

				<Heading
					className="mt-8 text-[43px] shadow-sm leading-[50px] font-inter font-black"
					style={{ color: isDark ? "#FFFFFF" : "#111111" }}
				>
					Xush kelibsiz
				</Heading>
				<Heading
					className="text-[45px] font-inter shadow-sm leading-[50px] font-black"
					style={{ color: BRAND_ACCENT }}
				>
					Prava X
				</Heading>

				<Text
					className="mt-4 text-lg shadow-sm leading-7"
					style={{ color: isDark ? "rgba(255,255,255,0.65)" : "#3c3c43" }}
				>
					Nazariy va amaliy testlarga bitta ilovada tayyorlaning.
				</Text>
			</Animated.View>

			{/* Loading indicator — visible during hold phase */}
			<Animated.View
				style={[
					{
						position: "absolute",
						bottom: PADDING_BOTTOM + 12,
						left: 0,
						right: 0,
						alignItems: "center",
					},
					loadingAnimatedStyle,
				]}
			>
				<ActivityIndicator size="small" color={BRAND_ACCENT} />
			</Animated.View>

			{/* Bottom section — slides up from below */}
			<Animated.View
				style={[
					{
						position: "absolute",
						bottom: PADDING_BOTTOM,
						left: PADDING_H,
						right: PADDING_H,
					},
					bottomAnimatedStyle,
				]}
			>
				<Box className="mb-5">
					<Box className="mb-3">
						<Handshake size={28} color={BRAND_ACCENT} strokeWidth={1.8} />
					</Box>
					<Text
						className="text-[13px] leading-5"
						style={{
							color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.5)",
						}}
					>
						Prava X faqat Telegram orqali xavfsiz ro'yxatdan o'tishni taklif
						qiladi. Telegramda Start bosing va kontaktni yuboring — tasdiqlangan
						zahoti ilova avtomatik ochiladi.
					</Text>
				</Box>

				<Pressable
					onPress={handleTelegramLogin}
					disabled={isBusy}
					style={({ pressed }) => ({
						opacity: pressed || isBusy ? 0.92 : 1,
						transform: [{ scale: pressed ? 0.995 : 1 }],
					})}
				>
					<LinearGradient
						colors={BRAND_GRADIENT}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={{
							height: 52,
							borderRadius: 100,
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "center",
							gap: 10,
						}}
					>
						{isBusy ? (
							<ActivityIndicator color="#1B1203" />
						) : (
							<>
								<TelegramIcon size={20} color="#1B1203" />
								<Text
									className="text-lg font-bold"
									style={{ color: "#1B1203" }}
								>
									{buttonLabel}
								</Text>
							</>
						)}
					</LinearGradient>
				</Pressable>

				<Pressable
					onPress={() => router.push("/(auth)/phone-login")}
					style={({ pressed }) => ({
						alignItems: "center",
						opacity: pressed ? 0.6 : 1,
					})}
				>
					<Text
						style={{
							color: BRAND_ACCENT,
							textDecorationLine: "underline",
							textAlign: "center",
							height: 48,
							lineHeight: 48,
							fontSize: 14,
						}}
					>
						Botni qo'lda ochish
					</Text>
				</Pressable>
			</Animated.View>

			<AuthErrorModal
				isOpen={errorModal.isOpen}
				title={errorModal.title}
				message={errorModal.message}
				onClose={() => setErrorModal((prev) => ({ ...prev, isOpen: false }))}
			/>
		</View>
	);
}
