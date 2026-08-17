import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Alert,
	Animated,
	AppState,
	type AppStateStatus,
	Linking,
	Platform,
	Pressable,
	RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
	ChevronRight,
	CircleHelp,
	Crown,
	Instagram,
	Languages,
	LogOut,
	Send,
	Sparkles,
	Youtube,
} from "lucide-react-native";

import {
	Avatar,
	AvatarFallbackText,
	AvatarImage,
} from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import {
	BottomSheet,
	BottomSheetBackdrop,
	type BottomSheetController,
	BottomSheetContent,
	BottomSheetDragIndicator,
	BottomSheetPortal,
	BottomSheetScrollView,
} from "@/components/ui/bottomsheet";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";

import { SettingsRowsCard } from "@/features/settings/components/SettingsRowsCard";
import { SettingsIconFrame } from "@/features/settings/components/SettingsIconFrame";
import type { RowItem, ThemeColors } from "@/features/settings/types";
import {
	clearPendingPaymentId,
	getPendingPaymentId,
	getPaymentStatus,
	getSubscription,
	initiatePayment,
	savePendingPaymentId,
	type Payment,
	type PaymentPlan,
	type PaymentStatus,
} from "@/features/payments/api";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { SUPPORTED_LANGUAGES, useI18n } from "@/locales/i18n-provider";
import {
	getUserAvatarUri,
	getUserDisplayName,
	getUserInitials,
	getUserProfileMeta,
} from "@/lib/user";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SettingsSheetType = "language" | "premium" | null;
type PremiumPlanId = "free" | "pro";
type PremiumBillingPeriod = "monthly" | "yearly";

type PremiumPlan = {
	id: PremiumPlanId;
	tabLabel: string;
	upgradeLine: string;
	creditsLine: string;
	priceLine: string;
	description: string;
	yearlyLine: string;
	features: string[];
};

type PremiumPlanVisual = {
	accent: string;
	cardGradient: [string, string, string];
	cardBorderGradient: [string, string, string];
	creditPanelGradient: [string, string];
	tabActiveGradient: [string, string, string];
	ctaGradient: [string, string, string];
	cardText: string;
	cardMutedText: string;
	dividerColor: string;
};

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 30 * 60 * 1_000;


export default function SettingsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const sheetRef = useRef<BottomSheetController | null>(null);
	const scrollY = useRef(new Animated.Value(0)).current;
	const [pushEnabled, setPushEnabled] = useState(true);
	const [logoutLoading, setLogoutLoading] = useState(false);
	const [logoutError, setLogoutError] = useState("");
	const [activeSheet, setActiveSheet] = useState<SettingsSheetType>(null);
	const [premiumBillingPeriod, setPremiumBillingPeriod] =
		useState<PremiumBillingPeriod>("monthly");
	const premiumBillingX = useRef(new Animated.Value(0)).current;
	const [premiumBillingWidth, setPremiumBillingWidth] = useState(0);

	const [paymentLoading, setPaymentLoading] = useState(false);
	const [activePayment, setActivePayment] = useState<Payment | null>(null);
	const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pollingStartRef = useRef<number>(0);
	const appStateRef = useRef<AppStateStatus>(AppState.currentState);

	const { colorMode, themePreference, setThemePreference } = useAppTheme();
	const { signOut, user, refreshSession } = useAuth();
	const { language, setLanguage, t } = useI18n();
	const isPro = user?.is_premium === true;
	const isDarkMode = colorMode === "dark";
	const [refreshing, setRefreshing] = useState(false);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await refreshSession();
			// Re-check pending payment status on refresh
			const pendingId = await getPendingPaymentId();
			if (pendingId !== null) {
				const payment = await getPaymentStatus(pendingId);
				setActivePayment(payment);
				if (
					payment.status === "approved" ||
					payment.status === "rejected"
				) {
					await clearPendingPaymentId();
				}
			}
		} catch {
			// silent — user can pull again
		} finally {
			setRefreshing(false);
		}
	}, [refreshSession]);
	const headerTitleOpacity = scrollY.interpolate({
		inputRange: [92, 120],
		outputRange: [0, 1],
		extrapolate: "clamp",
	});

	const displayName =
		(typeof user?.first_name === "string" && user.first_name.trim()) ||
		getUserDisplayName(user);
	const avatarUri = getUserAvatarUri(user);
	const avatarFallback = getUserInitials(user);
	const profileMeta = getUserProfileMeta(user);

	const footerPlatformText = t(
		Platform.OS === "android"
			? "settings.footer.platform.android"
			: Platform.OS === "ios"
				? "settings.footer.platform.ios"
				: "settings.footer.platform",
		Platform.OS === "android"
			? "Prava X v1.0.0 · Android uchun"
			: Platform.OS === "ios"
				? "Prava X v1.0.0 · iOS uchun"
				: "Prava X v1.0.0",
	);

	const stopPolling = useCallback(() => {
		if (pollingTimerRef.current !== null) {
			clearInterval(pollingTimerRef.current);
			pollingTimerRef.current = null;
		}
	}, []);

	const startPolling = useCallback(
		(paymentId: number) => {
			stopPolling();
			pollingStartRef.current = Date.now();

			pollingTimerRef.current = setInterval(async () => {
				if (Date.now() - pollingStartRef.current >= POLL_MAX_MS) {
					stopPolling();
					return;
				}

				try {
					const payment = await getPaymentStatus(paymentId);
					setActivePayment(payment);

					if (payment.status === "approved" || payment.status === "rejected") {
						stopPolling();
						await clearPendingPaymentId();

						if (payment.status === "approved") {
							// Refresh subscription info silently — ignore errors
							getSubscription().catch(() => {});
						}
					}
				} catch {
					// Network errors during polling — keep trying
				}
			}, POLL_INTERVAL_MS);
		},
		[stopPolling],
	);

	// Resume polling when app comes to foreground with a pending payment
	useEffect(() => {
		const subscription = AppState.addEventListener(
			"change",
			(nextState: AppStateStatus) => {
				const wasBackground =
					appStateRef.current === "background" ||
					appStateRef.current === "inactive";
				const isNowActive = nextState === "active";

				appStateRef.current = nextState;

				if (wasBackground && isNowActive) {
					getPendingPaymentId().then((id) => {
						if (id !== null && pollingTimerRef.current === null) {
							getPaymentStatus(id)
								.then((payment) => {
									setActivePayment(payment);
									if (
										payment.status !== "approved" &&
										payment.status !== "rejected"
									) {
										startPolling(id);
									} else {
										clearPendingPaymentId().catch(() => {});
									}
								})
								.catch(() => {});
						}
					});
				}
			},
		);

		return () => {
			subscription.remove();
		};
	}, [startPolling]);

	// On mount: check if there's a pending payment from a previous session
	useEffect(() => {
		getPendingPaymentId().then((id) => {
			if (id === null) return;
			getPaymentStatus(id)
				.then((payment) => {
					setActivePayment(payment);
					if (
						payment.status !== "approved" &&
						payment.status !== "rejected"
					) {
						startPolling(id);
					} else {
						clearPendingPaymentId().catch(() => {});
					}
				})
				.catch(() => {
					clearPendingPaymentId().catch(() => {});
				});
		});
	}, [startPolling]);

	// Cleanup polling on unmount
	useEffect(() => {
		return () => {
			stopPolling();
		};
	}, [stopPolling]);

	// Try tg:// first — opens Telegram app directly without browser intermediary.
	// If Telegram is not installed, openURL throws, and we fall back to the https
	// link which routes to the browser (Open in Telegram page).
	const openTelegramDeepLink = useCallback(async (httpsUrl: string) => {
		const match = httpsUrl.match(/t\.me\/([^/?#\s]+)[^?]*\?.*?start=([^&\s]+)/);
		if (match) {
			try {
				await Linking.openURL(`tg://resolve?domain=${match[1]}&start=${match[2]}`);
				return;
			} catch {
				// Telegram app not installed — fall back to https
			}
		}
		await Linking.openURL(httpsUrl);
	}, []);

	const handleInitiatePayment = useCallback(async () => {
		if (paymentLoading) return;

		const plan: PaymentPlan =
			premiumBillingPeriod === "yearly" ? "pro_yearly" : "pro_monthly";

		setPaymentLoading(true);
		try {
			const result = await initiatePayment(plan);

			await savePendingPaymentId(result.payment_id);
			setActivePayment({
				id: result.payment_id,
				plan: result.plan,
				amount_som: String(result.amount_som),
				status: "initiated",
				created_at: new Date().toISOString(),
				processed_at: null,
				rejection_reason: "",
			});
			startPolling(result.payment_id);

			await openTelegramDeepLink(result.deep_link);
		} catch {
			Alert.alert(
				t("common.error", "Xatolik"),
				t(
					"settings.premium.alert.paymentError",
					"To'lov yaratishda xatolik. Internet ulanishini tekshiring.",
				),
			);
		} finally {
			setPaymentLoading(false);
		}
	}, [paymentLoading, premiumBillingPeriod, openTelegramDeepLink, startPolling, t]);

	const handleRetryPayment = useCallback(async () => {
		await clearPendingPaymentId();
		setActivePayment(null);
		stopPolling();
	}, [stopPolling]);

	const openSheet = useCallback((sheet: Exclude<SettingsSheetType, null>) => {
		setActiveSheet(sheet);
		requestAnimationFrame(() => {
			sheetRef.current?.open();
		});
	}, []);

	const openLanguageSheet = useCallback(() => {
		openSheet("language");
	}, [openSheet]);

	const openPremiumSheet = useCallback(() => {
		openSheet("premium");
	}, [openSheet]);

	const selectLanguage = (
		nextLanguage: (typeof SUPPORTED_LANGUAGES)[number],
	) => {
		setLanguage(nextLanguage);
		sheetRef.current?.close();
	};

	const handleOpenSocialLink = async (url: string) => {
		if (!url || url === "#") return;
		const canOpen = await Linking.canOpenURL(url);
		if (!canOpen) return;
		await Linking.openURL(url);
	};

	const currentLanguageLabel = t(`settings.language.${language}`, language);

	const handleLogout = async () => {
		if (logoutLoading) return;

		setLogoutError("");
		setLogoutLoading(true);
		try {
			await signOut();
			router.replace("/(auth)/login");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: t(
							"settings.logoutError",
							"Something went wrong while signing out.",
						);
			setLogoutError(message);
		} finally {
			setLogoutLoading(false);
		}
	};

	const colors: ThemeColors = {
		iconColor: isDarkMode ? Colors.dark.text : Colors.light.text,
		activeColor: isDarkMode ? Colors.dark.tint : Colors.light.tint,
		inactiveColor: isDarkMode
			? Colors.dark.tabIconDefault
			: Colors.light.tabIconDefault,
		switchThumbColor: isDarkMode ? Colors.dark.text : Colors.light.background,
		pressedRowBg: isDarkMode
			? Colors.dark.tabsBackground
			: Colors.light.tabsBackground,
	};

	const premiumPromoTextShadow = {
		textShadowColor: "rgba(0,0,0,0.22)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	};

	const rows = useMemo<RowItem[]>(
		() => [
			{
				id: "language",
				title: t("settings.language", "Language"),
				subtitle: currentLanguageLabel,
				icon: Languages,
				onPress: openLanguageSheet,
			},
			{
				id: "faq",
				title: t("settings.faq", "FAQs"),
				subtitle: t("settings.faqDescription", "Frequently asked questions"),
				icon: CircleHelp,
				onPress: () => {},
			},
		],
		[currentLanguageLabel, openLanguageSheet, t],
	);

	const themeOptions = useMemo<
		Array<{
			id: "system" | "dark" | "light";
			title: string;
			description: string;
		}>
	>(
		() => [
			{
				id: "system",
				title: t("settings.theme.system", "Automatic"),
				description: t(
					"settings.theme.systemDescription",
					"Follow your device theme",
				),
			},
			{
				id: "dark",
				title: t("settings.theme.dark", "Dark"),
				description: t(
					"settings.theme.darkDescription",
					"Always use dark mode",
				),
			},
			{
				id: "light",
				title: t("settings.theme.light", "Light"),
				description: t(
					"settings.theme.lightDescription",
					"Always use light mode",
				),
			},
		],
		[t],
	);

	const socialItems = useMemo<
		Array<{
			id: string;
			title: string;
			description: string;
			url: string;
			icon: React.ComponentType<{
				size?: number;
				color?: string;
				strokeWidth?: number;
			}>;
		}>
	>(
		() => [
			{
				id: "youtube",
				title: t("settings.social.youtube.title", "YouTube"),
				description: t(
					"settings.social.youtube.description",
					"Video guides and product updates",
				),
				url: "#",
				icon: Youtube,
			},
			{
				id: "instagram",
				title: t("settings.social.instagram.title", "Instagram"),
				description: t(
					"settings.social.instagram.description",
					"Latest updates and short content",
				),
				url: "#",
				icon: Instagram,
			},
			{
				id: "telegram",
				title: t("settings.social.telegram.title", "Telegram"),
				description: t(
					"settings.social.telegram.description",
					"Announcements and direct communication",
				),
				url: "https://t.me/pravaextra",
				icon: Send,
			},
		],
		[t],
	);

	const premiumPlans = useMemo<PremiumPlan[]>(
		() => [
			{
				id: "free",
				tabLabel: t("settings.premium.plan.free", "Free"),
				upgradeLine: t("settings.premium.upgradeFree", "Boshlang'ich paket"),
				creditsLine: t(
					"settings.premium.credits.free",
					"120 token boshlanishiga",
				),
				priceLine: t("settings.premium.price.free", "0 so'm"),
				description: t(
					"settings.premium.description.free",
					"Yangi foydalanuvchilar uchun",
				),
				yearlyLine: t(
					"settings.premium.yearly.free",
					"Oyiga taxminan: 120 token",
				),
				features: [
					t(
						"settings.premium.feature.freeStart",
						"Boshlanishiga 120 token",
					),
					t(
						"settings.premium.feature.freeMarathonLimit",
						"Marathon limit",
					),
					t(
						"settings.premium.feature.freeMockLimit",
						"Mock exam limitlangan",
					),
				],
			},
			{
				id: "pro",
				tabLabel: t("settings.premium.plan.pro", "Pro"),
				upgradeLine: t("settings.premium.upgradePro", "Eng optimal paket"),
				creditsLine: t("settings.premium.credits.pro", "3000 token / oy"),
				priceLine: t("settings.premium.price.pro", "24 900 so'm / oy"),
				description: t(
					"settings.premium.description.pro",
					"Eng optimal paket.",
				),
				yearlyLine: t(
					"settings.premium.yearly.pro",
					"Yillik: 89 900 so'm · 36 000 token",
				),
				features: [
					t("settings.premium.feature.proTokens", "3000 token / oy"),
					t("settings.premium.feature.proAnalytics", "Xatolar analytics"),
					t("settings.premium.feature.proMarathon", "Unlimited marathon"),
					t("settings.premium.feature.proQuiz", "Premium quiz mode"),
					t("settings.premium.feature.proContest", "Contest access"),
				],
			},
		],
		[t],
	);

	const premiumVisualMap = useMemo<Record<PremiumPlanId, PremiumPlanVisual>>(
		() => ({
			free: isDarkMode
				? {
						accent: "#94A3B8",
						cardGradient: ["#303236", "#27282c", "#34363a"],
						cardBorderGradient: [
							"rgba(203,213,225,0.52)",
							"rgba(148,163,184,0.14)",
							"rgba(255,255,255,0.08)",
						],
						creditPanelGradient: ["rgba(148,163,184,0.18)", "rgba(148,163,184,0.1)"],
						tabActiveGradient: ["#CBD5E1", "#AEBBCB", "#94A3B8"],
						ctaGradient: ["#E2E8F0", "#CBD5E1", "#94A3B8"],
						cardText: "#FFFFFF",
						cardMutedText: "rgba(255,255,255,0.6)",
						dividerColor: "rgba(255,255,255,0.1)",
					}
				: {
						accent: "#64748b",
						cardGradient: ["#f0f4f8", "#eaeff5", "#f1f5f9"],
						cardBorderGradient: [
							"rgba(100,116,139,0.28)",
							"rgba(148,163,184,0.14)",
							"rgba(0,0,0,0.05)",
						],
						creditPanelGradient: ["rgba(100,116,139,0.1)", "rgba(148,163,184,0.06)"],
						tabActiveGradient: ["#CBD5E1", "#AEBBCB", "#94A3B8"],
						ctaGradient: ["#E2E8F0", "#CBD5E1", "#94A3B8"],
						cardText: "#1e293b",
						cardMutedText: "rgba(30,41,59,0.6)",
						dividerColor: "rgba(30,41,59,0.1)",
					},
			pro: isDarkMode
				? {
						accent: "#F8E8AE",
						cardGradient: ["#343026", "#292824", "#373226"],
						cardBorderGradient: [
							"rgba(248,232,174,0.72)",
							"rgba(199,170,103,0.22)",
							"rgba(255,255,255,0.08)",
						],
						creditPanelGradient: [
							"rgba(248,232,174,0.24)",
							"rgba(199,170,103,0.12)",
						],
						tabActiveGradient: ["#ffc85a", "#ff9f2f", "#ff784b"],
						ctaGradient: ["#FFF4C2", "#E9C979", "#C6A45C"],
						cardText: "#FFFFFF",
						cardMutedText: "rgba(255,255,255,0.6)",
						dividerColor: "rgba(255,255,255,0.1)",
					}
				: {
						accent: "#92680a",
						cardGradient: ["#fefce8", "#fef8e1", "#fffcf0"],
						cardBorderGradient: [
							"rgba(180,130,40,0.45)",
							"rgba(199,170,103,0.22)",
							"rgba(0,0,0,0.04)",
						],
						creditPanelGradient: [
							"rgba(180,130,40,0.13)",
							"rgba(199,170,103,0.07)",
						],
						tabActiveGradient: ["#ffc85a", "#ff9f2f", "#ff784b"],
						ctaGradient: ["#FFF4C2", "#E9C979", "#C6A45C"],
						cardText: "#1c1203",
						cardMutedText: "rgba(28,18,3,0.6)",
						dividerColor: "rgba(28,18,3,0.1)",
					},
		}),
		[isDarkMode],
	);

	const premiumBillingOptions = useMemo(
		() => [
			{
				id: "monthly" as const,
				label: t("settings.premium.billing.monthly", "Oylik"),
				sublabel: t("settings.premium.billing.monthlyPrice", "24 900 so'm"),
			},
			{
				id: "yearly" as const,
				label: t("settings.premium.billing.yearly", "Yillik"),
				sublabel: t(
					"settings.premium.billing.yearlyPrice",
					"89 900 so'm · 25% chegirma",
				),
			},
		],
		[t],
	);

	const premiumBillingInset = 4;
	const premiumBillingButtonWidth = Math.max(
		0,
		(premiumBillingWidth - premiumBillingInset * 2) / 2,
	);

	useEffect(() => {
		Animated.spring(premiumBillingX, {
			toValue:
				premiumBillingPeriod === "yearly" ? premiumBillingButtonWidth : 0,
			useNativeDriver: true,
			tension: 210,
			friction: 24,
		}).start();
	}, [premiumBillingButtonWidth, premiumBillingPeriod, premiumBillingX]);

	const handleSelectPremiumBillingPeriod = useCallback(
		(nextPeriod: PremiumBillingPeriod) => {
			setPremiumBillingPeriod(nextPeriod);
		},
		[],
	);

	const getPremiumPlanPrice = useCallback(
		(plan: PremiumPlan) => {
			if (plan.id === "free") return plan.priceLine;
			if (premiumBillingPeriod === "yearly") {
				return t("settings.premium.price.proYearly", "89 900 so'm / yil");
			}
			return plan.priceLine;
		},
		[premiumBillingPeriod, t],
	);

	const getPremiumPlanTokenLine = useCallback(
		(plan: PremiumPlan) => {
			if (plan.id === "free" || premiumBillingPeriod === "monthly") {
				return plan.creditsLine;
			}
			return t("settings.premium.credits.proYearly", "36 000 token / yil");
		},
		[premiumBillingPeriod, t],
	);

	const paymentStatusLabels = useMemo<Record<PaymentStatus, string>>(
		() => ({
			initiated: t("settings.premium.status.initiated", "Telegram'ni oching va botga o'ting"),
			awaiting: t("settings.premium.status.awaiting", "Botda to'lov chekini yuboring"),
			pending: t("settings.premium.status.pending", "⏳ Admin tasdiqlashini kuting..."),
			approved: t("settings.premium.status.approved", "🎉 Pro tarif muvaffaqiyatli aktivlashtirildi!"),
			rejected: t("settings.premium.status.rejected", "❌ To'lov tasdiqlanmadi"),
		}),
		[t],
	);

	const isPremiumSheet = activeSheet === "premium";

	const isPaymentActive =
		activePayment !== null &&
		activePayment.status !== "approved" &&
		activePayment.status !== "rejected";

	const pendingColor = isDarkMode ? "#F8E8AE" : "#b08d2e";
	const paymentStatusColor = activePayment
		? activePayment.status === "approved"
			? "#4CAF50"
			: activePayment.status === "rejected"
				? "#F44336"
				: pendingColor
		: pendingColor;

	return (
		<BottomSheet
			ref={sheetRef}
			snapToIndex={0}
			onClose={() => setActiveSheet(null)}
		>
			<Box className="flex-1 bg-background">
				<Animated.View
					pointerEvents="none"
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						zIndex: 20,
						opacity: headerTitleOpacity,
					}}
				>
					<Box
						className="border-b border-border bg-card"
						style={{ paddingTop: insets.top }}
					>
						<Box className="h-12 items-center justify-center">
							<Heading className="text-lg font-semibold">
								{t("settings.title", "Settings")}
							</Heading>
						</Box>
					</Box>
				</Animated.View>

				<Animated.ScrollView
					showsVerticalScrollIndicator={false}
					scrollEventThrottle={16}
					onScroll={Animated.event(
						[{ nativeEvent: { contentOffset: { y: scrollY } } }],
						{ useNativeDriver: true },
					)}
					contentContainerStyle={{
						paddingTop: insets.top + 8,
						paddingHorizontal: 16,
						paddingBottom: Math.max(insets.bottom, 20) + 64,
					}}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={handleRefresh}
							progressViewOffset={insets.top}
							tintColor={isDarkMode ? "#ECEDEE" : "#111111"}
							colors={["#ff9f2f"]}
						/>
					}
				>
					<Box className="items-center pt-3">
						<Box style={{ position: "relative" }}>
							<Avatar className="h-[108px] w-[108px]">
								<AvatarFallbackText className="text-[34px] leading-[40px]">
									{avatarFallback}
								</AvatarFallbackText>
								{avatarUri ? (
									<AvatarImage source={{ uri: avatarUri }} />
								) : null}
							</Avatar>

							{isPro ? (
								<Box
									style={{
										position: "absolute",
										bottom: 0,
										right: 0,
										width: 32,
										height: 32,
										borderRadius: 16,
										alignItems: "center",
										justifyContent: "center",
										borderWidth: 2,
										borderColor: isDarkMode ? "#1a1a1a" : "#ffffff",
									}}
								>
									<LinearGradient
										colors={["#ffc85a", "#ff9f2f", "#ff784b"]}
										start={{ x: 0, y: 0 }}
										end={{ x: 1, y: 1 }}
										style={{
											position: "absolute",
											inset: 0,
											borderRadius: 14,
										}}
									/>
									<Crown size={15} color="#ffffff" strokeWidth={2.2} />
								</Box>
							) : null}
						</Box>

						<Box className="mt-3 flex-row items-center gap-2">
							<Heading className="text-[30px] leading-[34px] font-semibold">
								{displayName}
							</Heading>
							{isPro ? (
								<Box
									style={{
										paddingHorizontal: 8,
										paddingVertical: 3,
										borderRadius: 999,
										overflow: "hidden",
									}}
								>
									<LinearGradient
										colors={["#ffc85a", "#ff9f2f", "#ff784b"]}
										start={{ x: 0, y: 0 }}
										end={{ x: 1, y: 1 }}
										style={{
											position: "absolute",
											inset: 0,
											borderRadius: 999,
										}}
									/>
									<Text
										style={{
											fontSize: 11,
											fontWeight: "700",
											color: "#ffffff",
											letterSpacing: 0.5,
										}}
									>
										PRO
									</Text>
								</Box>
							) : null}
						</Box>
						{profileMeta ? (
							<Text className="mt-1 text-base text-muted-foreground text-center">
								{profileMeta}
							</Text>
						) : null}
					</Box>

					{logoutError ? (
						<Heading className="mt-2 text-sm text-destructive font-normal">
							{logoutError}
						</Heading>
					) : null}

					<YandexRippleButton
						onPress={openPremiumSheet}
						className="mt-4 rounded-3xl overflow-hidden"
						borderRadius={24}
						rippleOpacity={0.08}
					>
						<LinearGradient
							colors={["#ffc85a", "#ff9f2f", "#ff784b"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={{ padding: 16 }}
						>
							<Box className="flex-row items-center justify-between">
								<Box className="h-10 w-10 rounded-xl items-center justify-center bg-white/35">
									<Crown size={20} color="#ffffff" />
								</Box>
								<ChevronRight size={20} color="#ffffff" />
							</Box>
							<Heading
								className="mt-3 text-base font-semibold text-white"
								style={premiumPromoTextShadow}
							>
								{t("settings.premium.buttonTitle", "Pro tarif")}
							</Heading>
							<Text
								className="mt-1 text-sm text-white"
								style={{ opacity: 0.88, ...premiumPromoTextShadow }}
							>
								{isPaymentActive
									? t(
											"settings.premium.buttonSubtitlePending",
											"To'lov jarayonida — holati ko'rish",
										)
									: t(
											"settings.premium.buttonSubtitle",
											"Pro funksiyalarni oching",
										)}
							</Text>
						</LinearGradient>
					</YandexRippleButton>

					<SettingsRowsCard
						rows={rows}
						colors={colors}
						pushEnabled={pushEnabled}
						onTogglePush={() => setPushEnabled((prev) => !prev)}
						onSetPushEnabled={setPushEnabled}
						pushTitle={t("settings.pushTitle", "Push Notifications")}
						pushSubtitle={t(
							"settings.pushSubtitle",
							"Receive important app alerts",
						)}
					/>

					<Heading className="text-base mt-4 font-semibold">
						{t("settings.theme.title", "Theme")}
					</Heading>

					<Box className="mt-3 rounded-3xl bg-card overflow-hidden">
						{themeOptions.map((item, index) => {
							const isSelected = themePreference === item.id;
							const isLast = index === themeOptions.length - 1;

							return (
								<YandexRippleButton
									key={item.id}
									onPress={() => setThemePreference(item.id)}
									borderRadius={0}
									rippleOpacity={0.05}
								>
									<Box className="px-4 py-4 flex-row items-center">
										<Box className="flex-1 pr-3" style={{ minWidth: 0 }}>
											<Heading
												className="text-sm font-semibold"
												style={{ flexShrink: 1 }}
											>
												{item.title}
											</Heading>
											<Text
												className="mt-1 text-[12px] leading-5 text-muted-foreground"
												style={{ flexShrink: 1 }}
											>
												{item.description}
											</Text>
										</Box>

										<Box
											className="h-6 w-6 rounded-full border-2 items-center justify-center"
											style={{
												borderColor: isSelected
													? colors.activeColor
													: colors.inactiveColor,
											}}
										>
											{isSelected ? (
												<Box
													className="h-3 w-3 rounded-full"
													style={{ backgroundColor: colors.activeColor }}
												/>
											) : null}
										</Box>
									</Box>
									{!isLast ? <Divider className="mx-4" /> : null}
								</YandexRippleButton>
							);
						})}
					</Box>

					<Heading className="text-base mt-4 font-semibold">
						{t("settings.social.title", "Social Media")}
					</Heading>

					<Box className="mt-3 rounded-3xl bg-card overflow-hidden">
						{socialItems.map((item, index) => {
							const Icon = item.icon;
							const isLast = index === socialItems.length - 1;

							return (
								<YandexRippleButton
									key={item.id}
									onPress={() => {
										handleOpenSocialLink(item.url).catch(() => {});
									}}
									borderRadius={0}
									rippleOpacity={0.05}
								>
									<Box className="px-4 py-4 flex-row items-center">
										<SettingsIconFrame>
											<Icon
												size={20}
												color={colors.iconColor}
												strokeWidth={1.9}
											/>
										</SettingsIconFrame>

										<Box
											className="ml-4 flex-1 pr-2"
											style={{ minWidth: 0 }}
										>
											<Heading
												className="text-sm font-semibold"
												style={{ flexShrink: 1 }}
											>
												{item.title}
											</Heading>
											<Text
												className="mt-1 text-[12px] leading-5 text-muted-foreground"
												style={{ flexShrink: 1 }}
											>
												{item.description}
											</Text>
										</Box>

										<ChevronRight size={22} color={colors.iconColor} />
									</Box>
									{!isLast ? <Divider className="mx-4" /> : null}
								</YandexRippleButton>
							);
						})}
					</Box>

					<Box className="mt-4 rounded-3xl bg-card overflow-hidden">
						<YandexRippleButton
							onPress={handleLogout}
							disabled={logoutLoading}
							borderRadius={0}
							rippleOpacity={0.05}
							style={{ opacity: logoutLoading ? 0.7 : 1 }}
						>
							<Box className="px-4 py-4 flex-row items-center">
								<SettingsIconFrame>
									<LogOut
										size={20}
										color={colors.iconColor}
										strokeWidth={1.9}
									/>
								</SettingsIconFrame>

								<Box className="ml-4 flex-1 pr-2" style={{ minWidth: 0 }}>
									<Heading
										className="text-sm font-semibold"
										style={{ flexShrink: 1 }}
									>
										{logoutLoading
											? t("settings.loggingOut", "Logging out...")
											: t("settings.logout", "Log out")}
									</Heading>
									<Text
										className="mt-1 text-[12px] leading-5 text-muted-foreground"
										style={{ flexShrink: 1 }}
									>
										{t(
											"settings.logoutSubtitle",
											"Sign out from your account",
										)}
									</Text>
								</Box>

								<ChevronRight size={22} color={colors.iconColor} />
							</Box>
						</YandexRippleButton>
					</Box>

					<Box className="mt-10 mb-3 items-center">
						<Text className="text-sm text-muted-foreground text-center">
							{footerPlatformText}
						</Text>
					</Box>
				</Animated.ScrollView>
			</Box>

			<BottomSheetPortal
				backgroundStyle={{
					borderTopLeftRadius: 30,
					borderTopRightRadius: 30,
					opacity: 0,
				}}
				snapPoints={isPremiumSheet ? ["90%"] : ["60%", "100%"]}
				enableDynamicSizing={false}
				enableHandlePanningGesture
				enableContentPanningGesture
				enableOverDrag={false}
				topInset={insets.top}
				backdropComponent={(props) => (
					<BottomSheetBackdrop
						{...props}
						appearsOnIndex={0}
						disappearsOnIndex={-1}
					/>
				)}
				handleComponent={(props) => (
					<BottomSheetDragIndicator
						{...props}
						className="rounded-t-[30px] bg-card border-b border-border"
					>
						<Text className="text-xl mt-4 font-semibold">
							{isPremiumSheet
								? t("settings.premium.sheetTitle", "Pro tarif")
								: t("settings.languageSheetTitle", "Select language")}
						</Text>
					</BottomSheetDragIndicator>
				)}
			>
				{isPremiumSheet ? (
					<BottomSheetContent className="pb-0 bg-card h-full">
						<BottomSheetScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingTop: 12,
								paddingBottom: Math.max(insets.bottom, 20) + 110,
							}}
						>
							{/* Payment status banner */}
							{activePayment ? (
								<Box className="px-5 mb-4">
									<Box
										style={{
											borderRadius: 18,
											borderWidth: 1,
											borderColor:
												activePayment.status === "approved"
													? "rgba(76,175,80,0.4)"
													: activePayment.status === "rejected"
														? "rgba(244,67,54,0.4)"
														: isDarkMode ? "rgba(248,232,174,0.3)" : "rgba(176,141,46,0.45)",
											backgroundColor:
												activePayment.status === "approved"
													? "rgba(76,175,80,0.12)"
													: activePayment.status === "rejected"
														? "rgba(244,67,54,0.12)"
														: isDarkMode ? "rgba(248,232,174,0.08)" : "rgba(176,141,46,0.07)",
											padding: 16,
										}}
									>
										<Text
											className="text-sm font-semibold"
											style={{ color: paymentStatusColor }}
										>
											{paymentStatusLabels[activePayment.status]}
										</Text>

										{activePayment.status === "rejected" &&
										activePayment.rejection_reason ? (
											<Text
												className="mt-1 text-xs"
												style={{ color: "rgba(244,67,54,0.8)" }}
											>
												{activePayment.rejection_reason}
											</Text>
										) : null}

										{activePayment.status !== "approved" ? (
											<Box className="mt-3 flex-row gap-2 items-center">
												<Text
													className="text-xs"
													style={{ color: isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
												>
													{activePayment.plan === "pro_yearly"
														? t(
																"settings.premium.planLabel.yearly",
																"Pro Yillik",
															)
														: t(
																"settings.premium.planLabel.monthly",
																"Pro Oylik",
															)}
													{" · "}
													{activePayment.amount_som} so'm
												</Text>
											</Box>
										) : null}

										{activePayment.status === "rejected" ? (
											<YandexRippleButton
												className="mt-3 rounded-full overflow-hidden"
												onPress={() => {
													handleRetryPayment().catch(() => {});
												}}
												borderRadius={999}
												rippleOpacity={0.1}
											>
												<Box
													style={{
														borderRadius: 999,
														borderWidth: 1,
														borderColor: "rgba(244,67,54,0.5)",
														paddingVertical: 8,
														paddingHorizontal: 16,
														alignItems: "center",
													}}
												>
													<Text
														className="text-xs font-semibold"
														style={{ color: "#F44336" }}
													>
														{t(
															"settings.premium.retryPayment",
															"Yangi to'lov yaratish",
														)}
													</Text>
												</Box>
											</YandexRippleButton>
										) : null}
									</Box>
								</Box>
							) : null}

							{/* Billing period toggle — hidden when user is already Pro */}
							{!isPro && activePayment?.status !== "approved" ? (
								<Box className="px-5">
									<Box
										className="rounded-full p-1 flex-row items-center overflow-hidden"
										onLayout={(event) => {
											setPremiumBillingWidth(
												event.nativeEvent.layout.width,
											);
										}}
										style={{
											height: 54,
											backgroundColor: isDarkMode
												? "rgba(17,17,17,0.34)"
												: "rgba(0,0,0,0.06)",
										}}
									>
										{premiumBillingButtonWidth > 0 ? (
											<Animated.View
												pointerEvents="none"
												style={{
													position: "absolute",
													left: premiumBillingInset,
													top: premiumBillingInset,
													width: premiumBillingButtonWidth,
													bottom: premiumBillingInset,
													borderRadius: 999,
													borderWidth: 1,
													borderColor: "#ffb347",
													overflow: "hidden",
													transform: [{ translateX: premiumBillingX }],
												}}
											>
												<LinearGradient
													colors={premiumVisualMap.pro.tabActiveGradient}
													start={{ x: 0, y: 0 }}
													end={{ x: 1, y: 1 }}
													style={{ flex: 1 }}
												/>
											</Animated.View>
										) : null}
										{premiumBillingOptions.map((option) => {
											const isSelected = premiumBillingPeriod === option.id;
											return (
												<YandexRippleButton
													key={option.id}
													onPress={() =>
														handleSelectPremiumBillingPeriod(option.id)
													}
													className="flex-1 rounded-full overflow-hidden"
													borderRadius={999}
													disableFeedback
												>
													<Box className="h-full items-center justify-center px-2">
														<Text
															className="text-sm font-semibold"
															style={{
																color: isSelected
																	? isDarkMode
																		? "#FFFFFF"
																		: "#1B1203"
																	: isDarkMode
																		? "rgba(255,255,255,0.72)"
																		: "rgba(17,24,28,0.66)",
															}}
														>
															{option.label}
														</Text>
														{option.sublabel ? (
															<Text
																className="text-[10px]"
																style={{
																	color: isSelected
																		? isDarkMode
																			? "rgba(255,255,255,0.72)"
																			: "rgba(27,18,3,0.7)"
																		: isDarkMode
																			? "rgba(255,255,255,0.4)"
																			: "rgba(27,18,3,0.38)",
																}}
															>
																{option.sublabel}
															</Text>
														) : null}
													</Box>
												</YandexRippleButton>
											);
										})}
									</Box>
								</Box>
							) : null}

							{/* Plan cards */}
							<Box className="mt-4 px-4">
								{premiumPlans.map((plan) => {
									const visual = premiumVisualMap[plan.id];
									const isFreePlan = plan.id === "free";
									// Pro is active when:
									//  - server says user is premium (persists across launches), OR
									//  - polling just observed the payment turn "approved" this session
									const isApproved =
										isPro || activePayment?.status === "approved";

									return (
										<Box
											key={plan.id}
											className="pb-5"
											style={{
												borderRadius: 28,
												backgroundColor: "transparent",
												...(plan.id === "pro" && !isFreePlan && Platform.OS !== "android"
													? {
															shadowColor: visual.accent,
															shadowOpacity: 0.34,
															shadowRadius: 24,
															shadowOffset: { width: 0, height: 8 },
														}
													: {}),
											}}
										>
											<LinearGradient
												colors={visual.cardBorderGradient}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 1 }}
												style={{
													borderRadius: 28,
													padding: 1,
													overflow: "hidden",
												}}
											>
												<LinearGradient
													colors={visual.cardGradient}
													start={{ x: 0, y: 0 }}
													end={{ x: 1, y: 1 }}
													style={{
														borderRadius: 27,
														padding: 18,
														overflow: "hidden",
													}}
												>
													<Box className="flex-row items-start justify-between gap-3">
														<Box className="flex-1" style={{ minWidth: 0 }}>
															<Box className="flex-row items-center gap-2">
																<Heading
																	className="text-lg font-semibold"
																	style={{ color: visual.accent }}
																>
																	{plan.tabLabel}
																</Heading>
															</Box>
															<Text
																className="mt-1 text-sm"
																style={{ color: visual.cardMutedText }}
															>
																{plan.description}
															</Text>
														</Box>
														<Heading
															className="text-base font-semibold text-right"
															style={{ color: visual.cardText }}
														>
															{getPremiumPlanPrice(plan)}
														</Heading>
													</Box>

													<Box className="my-4 h-[1px]" style={{ backgroundColor: visual.dividerColor }} />

													<LinearGradient
														colors={visual.creditPanelGradient}
														start={{ x: 0, y: 0 }}
														end={{ x: 1, y: 1 }}
														style={{
															borderRadius: 18,
															paddingHorizontal: 14,
															paddingVertical: 12,
															overflow: "hidden",
														}}
													>
														<Text
															className="text-sm font-semibold"
															style={{ color: visual.accent }}
														>
															{getPremiumPlanTokenLine(plan)}
														</Text>
													</LinearGradient>

													<Box className="mt-4 gap-2">
														{plan.features.map((feature, index) => (
															<Box
																key={`${plan.id}-${index}`}
																className="flex-row items-start gap-2"
															>
																<Sparkles
																	size={14}
																	color={visual.accent}
																	strokeWidth={2.2}
																/>
																<Text
																	className="flex-1 text-sm"
																	style={{
																		color: visual.cardMutedText,
																	}}
																>
																	{feature}
																</Text>
															</Box>
														))}
													</Box>

													{isFreePlan ? (
														<Box
															className="mt-4 rounded-full border py-3 items-center justify-center"
															style={{
																borderColor: visual.dividerColor,
															}}
														>
															<Text
																className="text-sm font-semibold"
																style={{
																	color: visual.cardMutedText,
																}}
															>
																{t(
																	"settings.premium.currentPlan",
																	"Joriy reja",
																)}
															</Text>
														</Box>
													) : isApproved ? (
														<Box
															className="mt-4 rounded-full py-3 items-center justify-center"
															style={{
																backgroundColor: "rgba(76,175,80,0.18)",
																borderWidth: 1,
																borderColor: "rgba(76,175,80,0.4)",
															}}
														>
															<Text
																className="text-sm font-semibold"
																style={{ color: "#4CAF50" }}
															>
																{t(
																	"settings.premium.activePlan",
																	"✓ Faol",
																)}
															</Text>
														</Box>
													) : isPaymentActive ? (
														<Box
															className="mt-4 rounded-full py-3 items-center justify-center"
															style={{
																borderWidth: 1,
																borderColor: visual.dividerColor,
															}}
														>
															<Text
																className="text-sm font-semibold"
																style={{
																	color: visual.cardMutedText,
																}}
															>
																{t(
																	"settings.premium.paymentPending",
																	"To'lov jarayonida...",
																)}
															</Text>
														</Box>
													) : (
														<YandexRippleButton
															className="mt-4 rounded-full overflow-hidden"
															onPress={() => {
																handleInitiatePayment().catch(() => {});
															}}
															disabled={paymentLoading}
															borderRadius={999}
															rippleOpacity={0.08}
															style={{ opacity: paymentLoading ? 0.7 : 1 }}
														>
															<LinearGradient
																colors={visual.ctaGradient}
																start={{ x: 0, y: 0 }}
																end={{ x: 1, y: 1 }}
																style={{
																	paddingHorizontal: 16,
																	paddingVertical: 12,
																	alignItems: "center",
																	justifyContent: "center",
																}}
															>
																<Text className="text-base font-semibold text-[#1B1203]">
																	{paymentLoading
																		? t(
																				"settings.premium.ctaLoading",
																				"Yuklanmoqda...",
																			)
																		: t(
																				"settings.premium.ctaBuy",
																				"Pro tarif sotib olish",
																			)}
																</Text>
															</LinearGradient>
														</YandexRippleButton>
													)}
												</LinearGradient>
											</LinearGradient>
										</Box>
									);
								})}
							</Box>
						</BottomSheetScrollView>
					</BottomSheetContent>
				) : (
					<BottomSheetContent className="px-5 pb-0 bg-card h-full">
						<BottomSheetScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingTop: 12,
								paddingBottom: Math.max(insets.bottom, 20),
							}}
						>
							<Text className="text-sm text-muted-foreground">
								{t("settings.languageSheetSubtitle", "Choose app language")}
							</Text>

							<Box className="mt-4 rounded-2xl bg-card-custom overflow-hidden">
								{SUPPORTED_LANGUAGES.map((code, index) => {
									const isSelected = language === code;
									const isLast = index === SUPPORTED_LANGUAGES.length - 1;

									return (
										<Pressable
											key={code}
											onPress={() => selectLanguage(code)}
											style={({ pressed }) => ({
												opacity: pressed ? 0.72 : 1,
											})}
										>
											<Box className="h-[74px] px-4 flex-row items-center">
												<Text className="flex-1 text-sm font-semibold">
													{t(`settings.language.${code}`, code)}
												</Text>
												<Box
													className="h-6 w-6 rounded-full border-2 items-center justify-center"
													style={{
														borderColor: isSelected
															? colors.activeColor
															: colors.inactiveColor,
													}}
												>
													{isSelected ? (
														<Box
															className="h-3 w-3 rounded-full"
															style={{
																backgroundColor: colors.activeColor,
															}}
														/>
													) : null}
												</Box>
											</Box>
											{!isLast ? <Divider className="mx-4" /> : null}
										</Pressable>
									);
								})}
							</Box>
						</BottomSheetScrollView>
					</BottomSheetContent>
				)}
			</BottomSheetPortal>
		</BottomSheet>
	);
}
