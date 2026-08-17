import React from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Share as NativeShare,
	StyleSheet,
	TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Crown, Hand, Share2, Sparkles, Trophy, X } from "lucide-react-native";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Image } from "@/components/ui/image";
import {
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalContent,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import {
	useContestDetailsQuery,
	useJoinContestMutation,
	useJoinAcademyMutation,
	type Contest,
} from "@/features/contests/api";
import { getErrorMessage } from "@/lib/api";
import { useTokenBalanceQuery } from "@/features/tokens/api";
import { scheduleContestReminderNotifications } from "@/lib/contest-notifications";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

const pickString = (...values: unknown[]) =>
	values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();

const pickBoolean = (value: unknown) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value !== "string") return false;

	return ["1", "true", "yes", "joined", "qo'shilgan", "qoshilgan"].includes(
		value.trim().toLowerCase(),
	);
};

const pickNumber = (...values: unknown[]) => {
	for (const value of values) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim().length > 0) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}

	return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

const getContestTokenCost = (contest?: Contest | null) =>
	pickNumber(
		contest?.token_cost,
		contest?.tokens_required,
		contest?.required_tokens,
		contest?.entry_token,
		contest?.entry_tokens,
		contest?.entry_fee,
		contest?.price,
		contest?.cost,
		contest?.fee,
	) ?? 5;

const coinImage = require("../../../../../assets/images/coin.webp");

const getLocaleCode = (language: string) => {
	if (language.startsWith("ru")) return "ru-RU";
	if (language.includes("Cyrl")) return "uz-Cyrl-UZ";
	return "uz-Latn-UZ";
};

const formatContestDate = (
	value: string | null | undefined,
	language: string,
	t: (key: string, fallback?: string) => string,
) => {
	if (!value) return t("contest.status.soon", "Tez orada");

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const now = new Date();
	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	const time = new Intl.DateTimeFormat(getLocaleCode(language), {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);

	if (isToday) return `${t("common.today", "Bugun")}, ${time}`;

	return new Intl.DateTimeFormat(getLocaleCode(language), {
		hour: "2-digit",
		minute: "2-digit",
		weekday: "long",
	}).format(date);
};

const padTimePart = (value: number) => String(value).padStart(2, "0");

const getContestStartTime = (contest?: Contest | null) => {
	const startsAt = pickString(
		contest?.starts_at,
		contest?.start_time,
		contest?.started_at,
	);
	if (!startsAt) return null;

	const startTime = new Date(startsAt).getTime();
	return Number.isNaN(startTime) ? null : startTime;
};

const isContestLive = (contest?: Contest | null, now = Date.now()) => {
	const status = pickString(contest?.status)?.toLowerCase();
	if (status === "active" || status === "live" || status === "in_progress") return true;
	if (status === "finished" || status === "completed") return false;

	const startTime = getContestStartTime(contest);
	return startTime !== null && startTime <= now;
};

const getContestCountdown = (
	contest: Contest | null | undefined,
	now: number,
	t: (key: string, fallback?: string) => string,
) => {
	const status = pickString(contest?.status)?.toLowerCase();
	if (status === "finished" || status === "completed") {
		return t("contest.status.finished", "Yakunlangan");
	}
	if (isContestLive(contest, now)) return t("contest.status.started", "Boshlangan");

	const startTime = getContestStartTime(contest);
	if (startTime === null) return t("contest.status.soon", "Tez orada");

	const diffSeconds = Math.max(0, Math.floor((startTime - now) / 1000));
	const days = Math.floor(diffSeconds / 86400);
	const hours = Math.floor((diffSeconds % 86400) / 3600);
	const minutes = Math.floor((diffSeconds % 3600) / 60);
	const seconds = diffSeconds % 60;
	const time = `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}`;

	const prefix = t("contest.countdown.startsIn", "Boshlanishiga");
	return days > 0 ? `${prefix} ${days}d ${time}` : `${prefix} ${time}`;
};

function ContestRegisterHeader({ subtitle }: { subtitle: string }) {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";

	return (
		<Box className="px-4 my-2 flex-row items-center justify-between">
			<Box>
				<YandexRippleButton onPress={() => router.back()} borderRadius={9999}>
					<GradientIconFrame
						size={48}
						borderRadius={999}
						innerBorderRadius={999}
					>
						<ChevronLeft size={24} color={palette.text} />
					</GradientIconFrame>
				</YandexRippleButton>
			</Box>

			<Box className="items-center">
				<Heading className="text-lg font-semibold" style={{ color: palette.text }}>
					{t("contest.title", "Contest")}
				</Heading>
				<Text className="max-w-56 text-sm" style={{ color: muted }} numberOfLines={1}>
					{subtitle}
				</Text>
			</Box>

			<GradientIconFrame
				size={48}
				borderRadius={999}
				innerBorderRadius={999}
			>
				<Trophy size={22} color={palette.text} />
			</GradientIconFrame>
		</Box>
	);
}

function ContestTokenModal({
	balance,
	cost,
	isJoining,
	isOpen,
	onClose,
	onConfirm,
}: {
	balance: number | null;
	cost: number;
	isJoining: boolean;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const { t } = useI18n();

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="mt-0 mb-0 pt-8 pb-0">
					<Box className="items-center">
						<Box className="h-20 w-20 rounded-full items-center justify-center overflow-hidden">
							<Image
								alt="Token"
								className="h-full w-full"
								resizeMode="contain"
								source={coinImage}
							/>
						</Box>

						<Heading className="mt-8 text-center text-2xl font-bold">
							{t("contest.register.title", "Ro'yxatdan o'tish")}
						</Heading>
						<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
							{t("contest.register.tokenCostPrefix", "Musobaqaga qo'shilish uchun hisobingizdan")} {cost} token {t("contest.register.tokenCostSuffix", "yechiladi")}.
						</Text>
						{balance !== null ? (
							<Text className="mt-2 text-center text-sm text-muted-foreground">
								{t("tokens.currentBalance", "Hozirgi balans")}: {balance} token
							</Text>
						) : null}

						<Box className="mt-6 w-full flex-row gap-3">
							<Pressable className="flex-1" onPress={onClose}>
								<Box className="h-12 rounded-2xl bg-card items-center justify-center">
									<Text className="text-base font-semibold">
										{t("common.cancel", "Bekor qilish")}
									</Text>
								</Box>
							</Pressable>
							<Pressable className="flex-1" disabled={isJoining} onPress={onConfirm}>
								<Box
									className="h-12 rounded-2xl items-center justify-center"
									style={{ backgroundColor: "#ff9f2f", opacity: isJoining ? 0.7 : 1 }}
								>
									{isJoining ? (
										<ActivityIndicator color="#1B1203" />
									) : (
										<Text className="text-base font-bold text-[#1B1203]">
											{t("common.confirm", "Tasdiqlash")}
										</Text>
									)}
								</Box>
							</Pressable>
						</Box>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}

function AcademyRequiredModal({
	detail,
	isOpen,
	onClose,
	onJoined,
}: {
	detail: string;
	isOpen: boolean;
	onClose: () => void;
	onJoined: () => void;
}) {
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const [inviteCode, setInviteCode] = React.useState("");
	const [inviteError, setInviteError] = React.useState("");
	const joinAcademyMutation = useJoinAcademyMutation();
	const mutedColor = isDark ? "#8f8f8f" : "#8a8a8a";
	const inputBg = isDark ? "#1a1a1a" : "#f5f5f5";
	const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
	const textColor = isDark ? "#f5f5f5" : "#141414";

	const handleJoinAcademy = async () => {
		const code = inviteCode.trim().toUpperCase();
		if (!code) {
			setInviteError(t("contest.register.inviteCodeRequired", "Invite kodni kiriting"));
			return;
		}
		setInviteError("");
		try {
			await joinAcademyMutation.mutateAsync({ inviteCode: code });
			setInviteCode("");
			onJoined();
		} catch (err) {
			const msg = getErrorMessage(err);
			const lower = msg.toLowerCase();
			if (
				lower.includes("allaqachon") ||
				lower.includes("already") ||
				lower.includes("a'zo") ||
				lower.includes("member")
			) {
				setInviteCode("");
				onJoined();
			} else {
				setInviteError(msg);
			}
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="mt-0 mb-0 pt-8 pb-0">
					<Box className="items-center">
						<Box className="h-20 w-20 rounded-full border-2 border-amber-300 bg-amber-100/70 items-center justify-center">
							<Crown size={34} color="#d97706" strokeWidth={2.4} />
						</Box>

						<Heading className="mt-6 text-center text-xl font-bold">
							{t("contest.register.academyRequired", "Akademiyaga qo'shilish kerak")}
						</Heading>
						<Text className="mt-3 text-center text-sm leading-5 text-muted-foreground">
							{detail || t(
								"contest.register.academyRequiredDesc",
								"Bu contestga qo'shilish uchun avval akademiyaga qo'shiling.",
							)}
						</Text>

						<TextInput
							value={inviteCode}
							onChangeText={(v) => {
								setInviteCode(v.toUpperCase());
								if (inviteError) setInviteError("");
							}}
							placeholder={t("contest.register.inviteCodePlaceholder", "Akademiya invite kodi")}
							placeholderTextColor={mutedColor}
							autoCapitalize="characters"
							autoCorrect={false}
							style={{
								marginTop: 20,
								width: "100%",
								height: 52,
								borderRadius: 16,
								backgroundColor: inputBg,
								borderWidth: 1,
								borderColor: inputBorder,
								paddingHorizontal: 16,
								fontSize: 16,
								fontWeight: "600",
								color: textColor,
								letterSpacing: 0.5,
							}}
						/>

						{inviteError ? (
							<Text className="mt-2 self-start text-xs text-destructive">
								{inviteError}
							</Text>
						) : null}

						<Pressable
							className="mt-5 w-full"
							disabled={joinAcademyMutation.isPending}
							onPress={handleJoinAcademy}
						>
							<Box
								className="h-12 rounded-2xl flex-row items-center justify-center gap-2"
								style={{
									backgroundColor: "#ff9f2f",
									opacity: joinAcademyMutation.isPending ? 0.7 : 1,
								}}
							>
								{joinAcademyMutation.isPending ? (
									<ActivityIndicator color="#1B1203" />
								) : (
									<Text className="text-base font-bold text-[#1B1203]">
										{t("contest.register.joinAcademy", "Akademiyaga qo'shilish")}
									</Text>
								)}
							</Box>
						</Pressable>

						<Pressable className="mt-3 w-full" onPress={onClose}>
							<Box className="h-12 rounded-2xl bg-card items-center justify-center">
								<Text className="text-base font-semibold">
									{t("common.cancel", "Bekor qilish")}
								</Text>
							</Box>
						</Pressable>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}

function PremiumRequiredModal({
	balance,
	cost,
	isOpen,
	onClose,
}: {
	balance: number | null;
	cost: number;
	isOpen: boolean;
	onClose: () => void;
}) {
	const { t } = useI18n();
	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 py-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="pt-8 pb-1">
					<Box className="items-center">
						<Box className="h-20 w-20 rounded-full border-2 border-amber-300 bg-amber-100/70 items-center justify-center">
							<Sparkles size={34} color="#d97706" strokeWidth={2.4} />
						</Box>

						<Heading className="mt-8 text-center text-2xl font-bold">
							{t("tokens.insufficientTitle", "Token yetarli emas")}
						</Heading>
						<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
							{t("contest.register.needTokenPrefix", "Ro'yxatdan o'tish uchun")} {cost} token {t("contest.register.needTokenSuffix", "kerak")}.
							{balance !== null
								? ` ${t("tokens.youHave", "Sizda")} ${balance} token ${t("tokens.available", "bor")}.`
								: ""}
						</Text>

						<Box className="mt-7 w-full rounded-3xl bg-card-custom px-4 py-4">
							<Text className="text-sm text-muted-foreground">
								Premium plans
							</Text>
							<Heading className="mt-1 text-base font-semibold">
								25000 tanga per month
							</Heading>
							<Box className="mt-4 gap-3">
								{[
									"Contest va testlar uchun ko'proq tanga",
									"Pro funksiyalarni ochish",
									"Premium tariflar orqali balansni to'ldirish",
								].map((feature) => (
									<Box key={feature} className="flex-row items-start gap-2">
										<Sparkles size={14} color="#f59e0b" strokeWidth={2.2} />
										<Text className="flex-1 text-sm text-muted-foreground">
											{feature}
										</Text>
									</Box>
								))}
							</Box>
						</Box>

						<Pressable className="mt-5 w-full" onPress={onClose}>
							<Box className="h-12 rounded-2xl bg-[#ff9f2f] items-center justify-center">
								<Text className="text-base font-bold text-[#1B1203]">
									{t("common.understood", "Tushunarli")}
								</Text>
							</Box>
						</Pressable>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}

export default function ContestRegisterScreen() {
	const router = useRouter();
	const [now, setNow] = React.useState(() => Date.now());
	const [isTokenModalOpen, setIsTokenModalOpen] = React.useState(false);
	const [isPremiumModalOpen, setIsPremiumModalOpen] = React.useState(false);
	const [academyError, setAcademyError] = React.useState<{
		detail: string;
		academyId: number;
	} | null>(null);
	const params = useLocalSearchParams<{ contestId?: string; title?: string }>();
	const { colorMode } = useAppTheme();
	const { user } = useAuth();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const contestId = typeof params.contestId === "string" ? params.contestId : "";
	const mountReady = useDeferredMount();
	const detailsQuery = useContestDetailsQuery(contestId, mountReady && contestId.length > 0);
	const tokenBalanceQuery = useTokenBalanceQuery(mountReady && Boolean(user?.id));
	const joinContestMutation = useJoinContestMutation();
	const contest = detailsQuery.data;
	const title =
		pickString(contest?.title, contest?.name, params.title) ??
		`${t("contest.title", "Contest")} ${contestId}`;
	const startsAt = pickString(
		contest?.starts_at,
		contest?.start_time,
		contest?.started_at,
	);
	const startLabel = formatContestDate(startsAt, language, t);
	const countdown = getContestCountdown(contest, now, t);
	const isJoined = pickBoolean(contest?.is_joined);
	const canStart = isJoined && isContestLive(contest, now);
	const tokenCost = getContestTokenCost(contest);
	const tokenBalance = tokenBalanceQuery.data?.balance ?? null;
	const hasEnoughTokens = tokenBalance === null || tokenBalance >= tokenCost;
	const accent = "#ff9f2f";
	const mutedText = isDark ? "#a3a3a3" : "#666666";
	const actionBg = isDark ? "#202020" : "#f5f5f5";
	const tableBorder = isDark ? "rgba(255,255,255,0.24)" : "rgba(17,17,17,0.18)";
	const errorMessage =
		joinContestMutation.error instanceof Error
			? joinContestMutation.error.message
			: detailsQuery.error instanceof Error
				? detailsQuery.error.message
				: "";

	React.useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	React.useEffect(() => {
		if (!contest) return;

		void scheduleContestReminderNotifications({
			contest,
			isJoined,
			language,
			title,
		});
	}, [contest, isJoined, language, title]);

	const handleJoin = async () => {
		if (!contestId || isJoined || joinContestMutation.isPending) return;
		try {
			const joinedContest = await joinContestMutation.mutateAsync({ contestId });
			await scheduleContestReminderNotifications({
				contest: { ...(contest ?? {}), ...(joinedContest ?? {}) } as Contest,
				isJoined: true,
				language,
				title,
			});
		} catch (err) {
			const axiosErr = err as {
				response?: { status?: number; data?: { detail?: string; academy_id?: number } };
			};
			if (
				axiosErr.response?.status === 403 &&
				axiosErr.response.data?.academy_id
			) {
				setAcademyError({
					detail: axiosErr.response.data.detail ?? "",
					academyId: axiosErr.response.data.academy_id,
				});
			}
		}
	};

	const handleJoinPress = () => {
		if (canStart) {
			handleStart();
			return;
		}
		if (isJoined || joinContestMutation.isPending) return;

		if (!hasEnoughTokens) {
			setIsPremiumModalOpen(true);
			return;
		}

		setIsTokenModalOpen(true);
	};

	const handleConfirmJoin = () => {
		setIsTokenModalOpen(false);
		void handleJoin();
	};

	const handleStart = () => {
		if (!canStart) return;
		router.replace({
			pathname: "/tabs/(questions)/contest/[contestId]",
			params: { contestId, title },
		});
	};

	const handleShareContest = async () => {
		const message = `${title}\n${startLabel}\n${t(
			"contest.register.shareMessage",
			"Musobaqada qatnashish uchun Prava X ilovasini oching.",
		)}`;

		await NativeShare.share({
			title,
			message,
		}).catch(() => {});
	};

	return (
		<Box className="flex-1 pt-safe bg-background">
			<ContestRegisterHeader subtitle={t("contest.register.subtitle", "Ro'yxatdan o'tish")} />
			<ContestTokenModal
				balance={tokenBalance}
				cost={tokenCost}
				isJoining={joinContestMutation.isPending}
				isOpen={isTokenModalOpen}
				onClose={() => setIsTokenModalOpen(false)}
				onConfirm={handleConfirmJoin}
			/>
			<AcademyRequiredModal
				detail={academyError?.detail ?? ""}
				isOpen={academyError !== null}
				onClose={() => setAcademyError(null)}
				onJoined={() => {
					setAcademyError(null);
					void handleJoin();
				}}
			/>
			<PremiumRequiredModal
				balance={tokenBalance}
				cost={tokenCost}
				isOpen={isPremiumModalOpen}
				onClose={() => setIsPremiumModalOpen(false)}
			/>

			{detailsQuery.isLoading ? (
				<Box className="flex-1 items-center justify-center px-6">
					<ActivityIndicator />
					<Text className="mt-3 text-center text-muted-foreground">
						{t("contest.register.loading", "Musobaqa ma'lumotlari yuklanmoqda")}
					</Text>
				</Box>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					overScrollMode="never"
					decelerationRate="normal"
					contentContainerStyle={{ paddingBottom: 32 }}
				>
					<Box className="mx-4 mt-5">
						<Text
							className="text-3xl font-bold"
							style={{ color: accent }}
							numberOfLines={2}
						>
							{title}
						</Text>
						<Box className="mt-3 flex-row items-center gap-2">
							<Text className="text-sm font-medium" style={{ color: mutedText }}>
								{startLabel}
							</Text>
							<Box className="h-1 w-1 rounded-full bg-muted-foreground" />
							<Text className="text-sm font-medium" style={{ color: mutedText }}>
								{countdown}
							</Text>
						</Box>

						<Box className="mt-6 flex-row items-center gap-2">
							<YandexRippleButton
								borderRadius={999}
								disabled={joinContestMutation.isPending || (isJoined && !canStart)}
								onPress={handleJoinPress}
								rippleOpacity={0.05}
							>
								<LinearGradient
									colors={
										isDark
											? [
													"rgba(92,92,92,0.56)",
													"rgba(37,37,37,0.72)",
													"rgba(82,82,82,0.5)",
												]
											: [
													"rgba(205,205,205,0.82)",
													"rgba(245,245,245,1)",
													"rgba(210,210,210,0.72)",
											]
									}
									start={{ x: 1, y: 1 }}
									end={{ x: 0, y: 0 }}
									style={{
										borderRadius: 999,
										padding: 0.5,
									}}
								>
									<Box
										className="h-10 flex-row items-center justify-center gap-1.5 rounded-full px-4"
										style={{ backgroundColor: actionBg }}
									>
										{joinContestMutation.isPending ? (
											<ActivityIndicator color={accent} />
										) : (
											<>
												<Hand size={18} color={accent} />
												<Text className="text-sm font-bold" style={{ color: accent }}>
													{canStart
														? t("exam.startTest", "Testni boshlash")
														: isJoined
															? t("contest.register.joined", "Ro'yxatdan o'tilgan")
															: t("contest.register.title", "Ro'yxatdan o'tish")}
												</Text>
											</>
										)}
									</Box>
								</LinearGradient>
							</YandexRippleButton>

							<Pressable onPress={handleShareContest}>
								<GradientIconFrame
									size={40}
									borderRadius={999}
									innerBorderRadius={999}
								>
									<Share2 size={18} color={isDark ? "#ffffff" : "#111111"} />
								</GradientIconFrame>
							</Pressable>
						</Box>

							{errorMessage ? (
								<Box className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
									<Text className="text-sm text-destructive">{errorMessage}</Text>
									{detailsQuery.isError ? (
										<Pressable className="mt-3" onPress={() => detailsQuery.refetch()}>
											<Text className="text-sm font-semibold text-destructive">
												{t("common.retry", "Qayta urinish")}
											</Text>
										</Pressable>
									) : null}
								</Box>
							) : null}
	
						<Box className="mt-8">
							<Text className="text-xl font-bold">
								{language.startsWith("ru")
									? `Добро пожаловать в ${title}`
									: language.includes("Cyrl")
										? `${title}га хуш келибсиз`
										: `${title}ga xush kelibsiz`}
							</Text>
							<Text className="mt-3 text-base leading-7" style={{ color: mutedText }}>
								{t(
									"contest.register.description",
									"Musobaqada qatnashish uchun ro'yxatdan o'ting. Ro'yxatdan o'tgandan keyin musobaqa boshlanganda testni yechishingiz mumkin.",
								)}
							</Text>
						</Box>

						<Box className="mt-7">
							<Box className="flex-row items-center gap-2">
								<Trophy size={22} color={accent} />
								<Text className="text-xl font-bold">
									{t("contest.prizes.title", "Sovrinlar")}
								</Text>
							</Box>
							<Box className="mt-4 overflow-hidden rounded-2xl border border-border">
								{[
									[t("contest.prizes.first", "1-o'rin"), "200"],
									[t("contest.prizes.second", "2-o'rin"), "150"],
									[t("contest.prizes.third", "3-o'rin"), "100"],
									[t("contest.prizes.topTen", "4-10 o'rin"), "30"],
								].map(([place, prize], index, list) => (
									<Box
										key={place}
										className="flex-row"
										style={{
											borderBottomColor:
												index === list.length - 1
													? "transparent"
													: tableBorder,
											borderBottomWidth:
												index === list.length - 1
													? 0
													: StyleSheet.hairlineWidth,
										}}
									>
										<Box className="flex-1 px-3 py-3">
											<Text className="text-sm font-bold">{place}</Text>
										</Box>
										<Box
											className="w-24 flex-row items-center justify-end gap-1 px-3 py-3"
											style={{
												borderLeftColor: tableBorder,
												borderLeftWidth: StyleSheet.hairlineWidth,
											}}
										>
											<Text className="text-sm font-semibold">{prize}</Text>
											<Text>🪙</Text>
										</Box>
									</Box>
								))}
							</Box>
						</Box>
					</Box>
				</ScrollView>
			)}
		</Box>
	);
}
