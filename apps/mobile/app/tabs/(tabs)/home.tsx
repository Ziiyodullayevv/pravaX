import React from "react";
import { Image, Pressable, RefreshControl, ScrollView } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
	Bookmark,
	ChevronRight,
	CircleOff,
	Dices,
	MedalIcon,
	Signpost,
} from "lucide-react-native";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import HomeHeader from "@/components/home/HomeHeader";
import MetricCard from "@/components/home/MetricCard";
import { buildMetrics } from "@/components/home/constants";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import {
	getTodayMetricStatsFromSessions,
	EMPTY_TODAY_METRIC_STATS,
} from "@/components/home/today-stats";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import {
	getUserAvatarUri,
	getUserDisplayName,
	getUserInitials,
} from "@/lib/user";
import { useDailyPlanGoals } from "@/features/daily-plan/goals";
import { useTheoryOverview } from "@/features/theory/hooks";
import { useQuizSessionsQuery } from "@/features/quiz/api";
import { useTokenBalanceQuery } from "@/features/tokens/api";
import { useI18n } from "@/locales/i18n-provider";

type ExploreItem = {
	id: string;
	title: string;
	description: string;
	icon: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
};

type ExploreRowProps = {
	item: ExploreItem;
	isFirst: boolean;
	isLast: boolean;
	iconColor: string;
	onPress: (id: string) => void;
};

const ExploreRow = React.memo(function ExploreRow({
	item,
	isFirst,
	isLast,
	iconColor,
	onPress,
}: ExploreRowProps) {
	const Icon = item.icon;
	const handlePress = React.useCallback(() => onPress(item.id), [onPress, item.id]);
	return (
		<YandexRippleButton
			onPress={handlePress}
			borderRadius={isFirst || isLast ? 24 : 0}
			rippleOpacity={0.05}
		>
			<Box className="px-4 py-4 flex-row items-center">
				<GradientIconFrame>
					<Icon size={20} color={iconColor} />
				</GradientIconFrame>

				<Box className="flex-1 ml-4">
					<Heading className="text-sm font-semibold">{item.title}</Heading>
					<Text className="text-[12px] mt-1">{item.description}</Text>
				</Box>

				<ChevronRight size={22} color={iconColor} />
			</Box>
			{!isLast ? <Divider className="mx-4" /> : null}
		</YandexRippleButton>
	);
});

interface PracticeCardProps {
	title: string;
	leftLabel: string;
	rightValue: string;
	progress: number;
	image: ImageSourcePropType;
	badgeLabel?: string;
	onPress?: () => void;
}

const HOME_HEADER_PHRASE_COUNT = 12;

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}

const PracticeCard = React.memo(function PracticeCard({
	title,
	image,
	leftLabel,
	rightValue,
	progress,
	badgeLabel,
	onPress,
}: PracticeCardProps) {
	return (
		<YandexRippleButton
			className="flex-1"
			onPress={onPress}
			disabled={!onPress}
			disableFeedback={!onPress}
			borderRadius={24}
			rippleOpacity={0.06}
		>
			<Box className="flex-1 bg-card w-full rounded-3xl px-4 py-4">
				{badgeLabel ? (
					<Box className="absolute right-3 top-3 z-10 rounded-full bg-[#ff9f2f]/20 px-2.5 py-1">
						<Text className="text-[10px] font-semibold text-[#ff9f2f]">
							{badgeLabel}
						</Text>
					</Box>
				) : null}
				<Box className="flex-row -mt-1 mx-auto justify-center">
					<Image className="w-[80px] h-[80px]" source={image} />
				</Box>

				<Heading className="text-base text-center font-semibold">
					{title}
				</Heading>

				<Box className="mt-3 flex-row items-center justify-between">
					<Text className="text-[12px]">{leftLabel}</Text>
					<Text className="text-[12px] font-semibold">{rightValue}</Text>
				</Box>

				<Box className="mt-2 h-2 rounded-full bg-background overflow-hidden">
					<Box
						className="h-full rounded-full bg-teal-900"
						style={{ width: `${clamp01(progress) * 100}%` }}
					/>
				</Box>
			</Box>
		</YandexRippleButton>
	);
});

export default function HomeScreen() {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { user } = useAuth();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;

	const displayName = getUserDisplayName(
		user,
		t("home.userFallback", "Foydalanuvchi"),
	);

	const [now, setNow] = React.useState(() => new Date());
	const dayIndexRef = React.useRef(Math.floor(now.getTime() / 86_400_000));
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const { goals: dailyPlanGoals, reload: reloadDailyPlanGoals } =
		useDailyPlanGoals();
	const sessionsQuery = useQuizSessionsQuery(Boolean(user?.id));
	const tokenBalanceQuery = useTokenBalanceQuery(Boolean(user?.id));
	const { data: sessions = [], refetch: refetchSessions, isStale: isSessionsStale } = sessionsQuery;
	const { refetch: refetchTokenBalance, isStale: isTokenBalanceStale } = tokenBalanceQuery;
	const lastFocusReloadRef = React.useRef(0);
	const { summary, topics, reload: reloadTheoryOverview } = useTheoryOverview(
		user?.id,
		language,
	);
	React.useEffect(() => {
		const interval = setInterval(() => {
			const next = new Date();
			const nextDayIndex = Math.floor(next.getTime() / 86_400_000);
			if (nextDayIndex !== dayIndexRef.current) {
				dayIndexRef.current = nextDayIndex;
				setNow(next);
			}
		}, 60_000);
		return () => clearInterval(interval);
	}, []);

	useFocusEffect(
		React.useCallback(() => {
			const next = new Date();
			const nextDayIndex = Math.floor(next.getTime() / 86_400_000);
			if (nextDayIndex !== dayIndexRef.current) {
				dayIndexRef.current = nextDayIndex;
				setNow(next);
			}

			const sinceLastReload = next.getTime() - lastFocusReloadRef.current;
			if (sinceLastReload < 30_000) return;
			lastFocusReloadRef.current = next.getTime();

			reloadDailyPlanGoals().catch(() => {});
			reloadTheoryOverview().catch(() => {});

			if (user?.id) {
				if (isSessionsStale) refetchSessions().catch(() => {});
				if (isTokenBalanceStale) refetchTokenBalance().catch(() => {});
			}
		}, [
			isSessionsStale,
			isTokenBalanceStale,
			refetchSessions,
			refetchTokenBalance,
			reloadDailyPlanGoals,
			reloadTheoryOverview,
			user?.id,
		]),
	);

	const handleRefresh = React.useCallback(async () => {
		if (isRefreshing) return;
		setIsRefreshing(true);

		try {
			await Promise.all([
				reloadDailyPlanGoals(),
				reloadTheoryOverview(),
				...(user?.id
					? [refetchSessions(), refetchTokenBalance()]
					: []),
			]);
		} finally {
			setIsRefreshing(false);
		}
	}, [
		isRefreshing,
		refetchSessions,
		refetchTokenBalance,
		reloadDailyPlanGoals,
		reloadTheoryOverview,
		user?.id,
	]);

	const subtitle = React.useMemo(() => {
		const dayIndex = Math.floor(now.getTime() / 86_400_000);
		const phraseIndex = dayIndex % HOME_HEADER_PHRASE_COUNT;
		return t(`home.motivation.${phraseIndex}`, "Olg'a");
	}, [now, t]);

	const avatarUri = getUserAvatarUri(user);
	const avatarFallback = getUserInitials(user);

	const todayStats = React.useMemo(() => {
		if (sessions.length === 0) return EMPTY_TODAY_METRIC_STATS;
		return getTodayMetricStatsFromSessions(sessions, now);
	}, [now, sessions]);

	const metrics = React.useMemo(
		() => buildMetrics(todayStats, t, dailyPlanGoals),
		[dailyPlanGoals, t, todayStats],
	);
	const completedTopics = React.useMemo(
		() => topics.filter((topic) => topic.completed).length,
		[topics],
	);
	const totalTopics = summary.totalTopics;
	const theoryProgress = totalTopics > 0 ? completedTopics / totalTopics : 0;
	const exploreItems = React.useMemo<ExploreItem[]>(
		() => [
			{
				id: "random",
				title: t("practice.explore.random.title", "Tasodifiy savollar"),
				description: t(
					"practice.explore.random.description",
					"Aralash savollarni mashq qiling",
				),
				icon: Dices,
			},
			{
				id: "mistakes",
				title: t("practice.explore.mistakes.title", "Xatolar"),
				description: t(
					"practice.explore.mistakes.description",
					"Noto'g'ri ishlagan savollarni qayta yeching",
				),
				icon: CircleOff,
			},
			{
				id: "bookmarks",
				title: t("practice.explore.bookmarks.title", "Saqlanganlar"),
				description: t(
					"practice.explore.bookmarks.description",
					"Saqlangan savollarga qayting",
				),
				icon: Bookmark,
			},
			{
				id: "marathon",
				title: t("practice.explore.marathon.title", "Marafon"),
				description: t("practice.explore.marathon.description", "50-150 savol"),
				icon: MedalIcon,
			},
			{
				id: "signs",
				title: t("practice.explore.signs.title", "Belgilar"),
				description: t(
					"practice.explore.signs.description",
					"Yo'l belgilarini o'rganing",
				),
				icon: Signpost,
			},
		],
		[t],
	);
	const handleExplorePress = React.useCallback(
		(itemId: string) => {
			if (itemId === "random") {
				router.navigate({
					pathname: "/tabs/(questions)/marathon",
					params: { mode: "random", count: "10" },
				});
				return;
			}
			if (itemId === "bookmarks") {
				router.navigate("/tabs/(questions)/bookmarks");
				return;
			}
			if (itemId === "mistakes") {
				router.navigate("/tabs/(questions)/mistakes");
				return;
			}
			if (itemId === "marathon") {
				router.navigate("/tabs/(questions)/marathon");
				return;
			}
			if (itemId === "signs") {
				router.navigate("/tabs/(questions)/signs");
			}
		},
		[router],
	);

	const handleNotificationPress = React.useCallback(() => {
		router.push("/tabs/notifications");
	}, [router]);

	const handleTheoryPress = React.useCallback(() => {
		router.navigate("/tabs/(questions)/theory");
	}, [router]);

	const handleExamPress = React.useCallback(() => {
		router.navigate("/tabs/(questions)/exam");
	}, [router]);

	const handleDailyPlanPress = React.useCallback(() => {
		router.push("/tabs/(questions)/daily-plan");
	}, [router]);

	return (
		<Box className="pt-safe flex-1 bg-background">
			<ScrollView
				showsVerticalScrollIndicator={false}
				overScrollMode="never"
				decelerationRate="normal"
				contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={palette.tint}
						colors={[palette.tint]}
						progressBackgroundColor={colorMode === "dark" ? "#202020" : "#ffffff"}
					/>
				}
			>
				<HomeHeader
					avatarFallback={avatarFallback}
					displayName={displayName}
					subtitle={subtitle}
					avatarUri={avatarUri}
					palette={palette}
					tokenBalance={tokenBalanceQuery.data?.balance}
					isTokenBalanceLoading={tokenBalanceQuery.isLoading}
					onNotificationPress={handleNotificationPress}
				/>

				<Box className="mt-6 mx-4 flex-row items-center justify-between">
					<Text
						className="text-lg font-semibold"
						style={{ color: palette.text }}
					>
						{t("home.todayPlan", "Kunlik reja")}
					</Text>
					<Pressable
						className="flex-row items-center gap-1"
						hitSlop={10}
						onPress={handleDailyPlanPress}
					>
						<Text
							className="text-sm font-medium"
							style={{ color: palette.tint }}
						>
							{t("home.addPlan", "Reja qo'shish")}
						</Text>
						<ChevronRight size={18} color={palette.tint} />
					</Pressable>
				</Box>

				<Box className="mx-4 mt-3 flex-row items-stretch gap-2">
					{metrics.map((item) => (
						<MetricCard key={item.id} item={item} palette={palette} />
					))}
				</Box>

				<Text
					className="mx-4 mt-4 text-lg font-semibold"
					style={{ color: palette.text }}
				>
					{t("home.workoutPlans", "Mashg'ulotlar")}
				</Text>

				<Box className="mt-3 mx-4 flex-row gap-3">
					<PracticeCard
						title={t("theory.title", "Nazariya")}
						leftLabel={t("practice.completedShort", "Yechilgan")}
						rightValue={`${completedTopics}/${totalTopics}`}
						progress={theoryProgress}
						image={require("../../../assets/images/practice/books-ilustration.webp")}
						onPress={handleTheoryPress}
					/>
					<PracticeCard
						title={t("practice.hazardClips", "Kliplar")}
						leftLabel={t("practice.clips", "Kliplar")}
						rightValue="0/0"
						progress={0}
						image={require("../../../assets/images/practice/movies.webp")}
						badgeLabel={t("common.comingSoon", "Tez kunda")}
					/>
				</Box>

				<YandexRippleButton
					className="mx-4 mt-3"
					onPress={handleExamPress}
					borderRadius={24}
					rippleOpacity={0.06}
				>
					<Box className="rounded-3xl px-4 bg-card py-4 flex-row items-center">
						<Box className="items-center justify-center">
							<Image
								className="w-[60px] h-[60px]"
								source={require("../../../assets/images/practice/certificate.png")}
							/>
						</Box>

						<Box className="flex-1 ml-4 pr-2">
							<Heading className="text-base font-semibold">
								{t("practice.mockExam", "Sinov imtihoni")}
							</Heading>
							<Text className="text-[12px] leading-5 mt-1">
								{t(
									"practice.mockExamDescription",
									"Nazariya va xavfli holatlar bo'yicha bilimingizni tekshiring",
								)}
							</Text>
						</Box>

						<ChevronRight size={24} color={palette.tabIconDefault} />
					</Box>
				</YandexRippleButton>

				<Text className="text-lg mx-4 mt-4 font-semibold">
					{t("practice.moreToExplore", "Yana bo'limlar")}
				</Text>

				<Box className="mx-4 mt-3 rounded-3xl bg-card overflow-hidden">
					{exploreItems.map((item, index) => (
						<ExploreRow
							key={item.id}
							item={item}
							isFirst={index === 0}
							isLast={index === exploreItems.length - 1}
							iconColor={palette.text}
							onPress={handleExplorePress}
						/>
					))}
				</Box>
			</ScrollView>
		</Box>
	);
}
