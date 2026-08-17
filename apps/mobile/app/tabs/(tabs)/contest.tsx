import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	ActivityIndicator,
	Image,
	type ImageSourcePropType,
	LayoutChangeEvent,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	type View,
	useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarX, Check, ChevronLeft, Crown, Hourglass, Trophy, X } from "lucide-react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { AcademyJoinPanel } from "@/components/contest/AcademyJoinPanel";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { NetworkErrorState } from "@/components/NetworkErrorState";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
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
	useAcademyMembershipQuery,
	useContestRankingQuery,
	useContestsQuery,
	useMyContestsQuery,
	contestQueryKeys,
	type Contest,
	type ContestRankingEntry,
	type MyContest,
} from "@/features/contests/api";
import { useQueryClient } from "@tanstack/react-query";
import { apiBaseUrl } from "@/lib/api";
import { scheduleContestReminderNotifications } from "@/lib/contest-notifications";
import { useI18n } from "@/locales/i18n-provider";

type ContestItem = {
	id: string | number;
	title: string;
	startLabel: string;
	startTimeLabel: string;
	countdown: string;
	isStarted?: boolean;
	imageSource: ImageSourcePropType;
	gradient: [string, string];
	isCompleted?: boolean;
	isFallback?: boolean;
	isJoined?: boolean;
	showReminder?: boolean;
	scope: ContestScope;
	startsAt?: string | null;
	contestStatus?: string | null;
};

type ContestScope = "academy" | "global";
type ContestRankingPeriod = "daily" | "weekly";

type RankingUser = {
	avatarUrl: string;
	countryFlag?: string;
	displayName: string;
	isCurrentUser?: boolean;
	medal?: "gold" | "silver" | "bronze";
	metrics: { label: string; value: number | string }[];
	primaryMetric?: number | string;
	rank: number;
	userId?: string;
};

type JoinedContestModalState = {
	startLabel: string;
	startTimeLabel: string;
	title: string;
} | null;

type ContestResultModalState = {
	contestTitle: string;
	rank: number;
	reward: number;
} | null;

const CONTEST_GRADIENTS: [string, string][] = [
	["#F6D36F", "#D26F3A"],
	["#937FE1", "#251B80"],
	["#56CCF2", "#2F80ED"],
];

const FALLBACK_CONTEST_IMAGES = [
	require("../../../assets/images/contest/wc_card_img_mobile.png"),
	require("../../../assets/images/contest/bc_card_img_mobile.png"),
] as const;
const coinImage = require("../../../assets/images/coin.webp");
const CONTEST_RESULT_MODAL_STORAGE_PREFIX = "contest-result-modal-seen:";
const ACADEMY_JOINED_STORAGE_KEY = "academy-joined";

const FALLBACK_CONTESTS: ContestItem[] = [
	{
		id: "fallback-academy-contest",
		title: "Academy Contest",
		startLabel: "Har hafta",
		startTimeLabel: "belgilangan vaqtda",
		countdown: "Tez orada",
		imageSource: FALLBACK_CONTEST_IMAGES[0],
		gradient: CONTEST_GRADIENTS[0],
		isCompleted: false,
		isFallback: true,
		scope: "academy",
		showReminder: true,
	},
	{
		id: "fallback-global-contest",
		title: "Global Contest",
		startLabel: "Har hafta",
		startTimeLabel: "belgilangan vaqtda",
		countdown: "Tez orada",
		imageSource: FALLBACK_CONTEST_IMAGES[1],
		gradient: CONTEST_GRADIENTS[1],
		isCompleted: false,
		isFallback: true,
		scope: "global",
		showReminder: true,
	},
];

const CONTEST_SCOPE_OPTIONS: { label: string; value: ContestScope }[] = [
	{ label: "Global", value: "global" },
	{ label: "Academy", value: "academy" },
];

const CONTEST_RANKING_PERIOD_OPTIONS: {
	label: string;
	value: ContestRankingPeriod;
}[] = [
	{ label: "Kunlik", value: "daily" },
	{ label: "Haftalik", value: "weekly" },
];

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

const pickString = (...values: unknown[]) =>
	values.find(
		(value): value is string => typeof value === "string" && value.length > 0,
	);

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

const pickId = (...values: unknown[]) => {
	for (const value of values) {
		if (typeof value === "number" && Number.isFinite(value)) return String(value);
		if (typeof value === "string" && value.trim().length > 0) return value.trim();
	}

	return undefined;
};

const pickBoolean = (value: unknown) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value !== "string") return false;

	const normalized = value.trim().toLowerCase();

	return ["1", "true", "yes", "joined", "qo'shilgan", "qoshilgan"].includes(
		normalized,
	);
};

const isNetworkError = (error: unknown) => {
	const record = asRecord(error);
	const message = pickString(record?.message, error instanceof Error ? error.message : "");
	const code = pickString(record?.code);

	return Boolean(
		code === "ERR_NETWORK" ||
			code === "ECONNABORTED" ||
			message?.toLowerCase().includes("network error") ||
			message?.toLowerCase().includes("network request failed") ||
			message?.toLowerCase().includes("timeout") ||
			message?.toLowerCase().includes("no response"),
	);
};

const getOfflineCopy = (language: string) => {
	if (language.startsWith("ru")) {
		return {
			title: "Нет подключения к интернету",
			description: "Проверьте соединение и обновите страницу.",
			button: "Обновить",
		};
	}

	if (language.includes("Cyrl")) {
		return {
			title: "Интернет алоқаси йўқ",
			description: "Уланишни текширинг ва саҳифани янгиланг.",
			button: "Янгилаш",
		};
	}

	return {
		title: "Internet aloqasi yo'q",
		description: "Ulanishni tekshiring va sahifani yangilang.",
		button: "Yangilash",
	};
};

const getLocaleCode = (language: string) => {
	if (language.startsWith("ru")) return "ru-RU";
	if (language.includes("Cyrl")) return "uz-Cyrl-UZ";
	return "uz-Latn-UZ";
};

const getLocalizedContestFallback = (
	contest: ContestItem,
	t: (key: string, fallback: string) => string,
) => ({
	...contest,
	countdown: t("contest.status.soon", "Tez orada"),
	startLabel: t("contest.schedule.weekly", "Har hafta"),
	startTimeLabel: t("contest.time.scheduled", "belgilangan vaqtda"),
	title:
		contest.scope === "academy"
			? t("contest.fallback.academyTitle", "Academy Contest")
			: t("contest.fallback.globalTitle", "Global Contest"),
});

const getLocalizedRankingEmptyMessage = ({
	contestTitle,
	language,
	periodLabel,
}: {
	contestTitle?: string | null;
	language: string;
	periodLabel: string;
}) => {
	if (contestTitle) {
		if (language.startsWith("ru")) {
			return `${contestTitle}: рейтинг пока не сформирован. Результаты появятся здесь, когда будут готовы.`;
		}
		if (language.includes("Cyrl")) {
			return `${contestTitle} учун ҳали рейтинг шаклланмади. Натижалар тайёр бўлганда шу ерда кўринади.`;
		}
		return `${contestTitle} uchun hali reyting shakllanmadi. Natijalar tayyor bo'lganda shu yerda ko'rinadi.`;
	}

	if (language.startsWith("ru")) {
		return `Пока нет завершенного ${periodLabel.toLowerCase()} contest.`;
	}
	if (language.includes("Cyrl")) {
		return `Ҳозирча якунланган ${periodLabel.toLowerCase()} contest йўқ.`;
	}
	return `Hozircha yakunlangan ${periodLabel.toLowerCase()} contest yo'q.`;
};

const getLocalizedJoinedMessage = (
	language: string,
	startTimeLabel: string,
) => {
	if (language.startsWith("ru")) {
		return `Вы уже зарегистрированы. Contest начнется ${startTimeLabel}. Дождитесь начала.`;
	}
	if (language.includes("Cyrl")) {
		return `Сиз рўйхатдан ўтгансиз. Contest ${startTimeLabel} да бошланади. Бошланишини кутинг.`;
	}
	return `Siz ro'yxatdan o'tgansiz. Contest ${startTimeLabel} da boshlanadi. Boshlanishini kuting.`;
};

const getLocalizedResultMessage = ({
	contestTitle,
	isWinner,
	language,
	rank,
	reward,
}: {
	contestTitle: string;
	isWinner: boolean;
	language: string;
	rank: number;
	reward: number;
}) => {
	if (language.startsWith("ru")) {
		return isWinner
			? `${contestTitle} завершен. Вы заняли ${rank}-е место и выиграли ${reward} coin.`
			: `${contestTitle} завершен. Вы заняли ${rank}-е место. В следующий раз получится попасть в топ-10.`;
	}
	if (language.includes("Cyrl")) {
		return isWinner
			? `${contestTitle} якунланди. Сиз ${rank}-ўринни олдингиз ва ${reward} coin ютдингиз.`
			: `${contestTitle} якунланди. Сиз ${rank}-ўринни олдингиз. Кейинги сафар 10 таликка киришингизга ишонамиз.`;
	}
	return isWinner
		? `${contestTitle} yakunlandi. Siz ${rank}-o'rinni oldingiz va ${reward} coin yutdingiz.`
		: `${contestTitle} yakunlandi. Siz ${rank}-o'rinni oldingiz. Keyingi safar 10 talikka kirishingizga ishonamiz.`;
};

const hasAcademyMembership = (user: unknown) => {
	const record = asRecord(user);
	const academy = asRecord(record?.academy);
	const profile = asRecord(record?.profile);

	return Boolean(
		pickBoolean(record?.is_academy_member) ||
			pickBoolean(record?.academy_member) ||
			pickBoolean(record?.has_academy) ||
			pickBoolean(record?.is_academy_joined) ||
			pickString(
				record?.academy_id,
				record?.academy_key,
				record?.academy_slug,
				academy?.id,
				academy?.key,
				profile?.academy_id,
				profile?.academy_key,
			),
	);
};

const resolveAssetUrl = (value?: string | null) => {
	if (!value) return null;
	if (/^https?:\/\//i.test(value)) return value;
	return `${apiBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
};

const padTimePart = (value: number) => String(value).padStart(2, "0");

const getTimezoneOffsetLabel = (date: Date) => {
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const absoluteOffset = Math.abs(offsetMinutes);
	const hours = Math.floor(absoluteOffset / 60);
	const minutes = absoluteOffset % 60;

	return `GMT${sign}${padTimePart(hours)}:${padTimePart(minutes)}`;
};

const formatRankingDuration = (totalSeconds?: number) => {
	if (typeof totalSeconds !== "number") return null;
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const restSeconds = seconds % 60;

	if (hours > 0) {
		return `${hours}:${padTimePart(minutes)}:${padTimePart(restSeconds)}`;
	}

	return `${padTimePart(minutes)}:${padTimePart(restSeconds)}`;
};

const parseRankingDurationSeconds = (...values: unknown[]) => {
	for (const value of values) {
		const numericValue = pickNumber(value);
		if (typeof numericValue === "number") return numericValue;

		if (typeof value !== "string") continue;
		const parts = value
			.trim()
			.split(":")
			.map((part) => Number(part));
		if (parts.some((part) => !Number.isFinite(part))) continue;

		if (parts.length === 3) {
			return parts[0] * 3600 + parts[1] * 60 + parts[2];
		}
		if (parts.length === 2) {
			return parts[0] * 60 + parts[1];
		}
	}

	return undefined;
};

const getDateDiffSeconds = (...values: unknown[]) => {
	const [startValue, endValue] = values;
	const start = typeof startValue === "string" ? new Date(startValue).getTime() : NaN;
	const end = typeof endValue === "string" ? new Date(endValue).getTime() : NaN;

	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return undefined;
	}

	return Math.floor((end - start) / 1000);
};

const formatContestDate = (
	value: string | null | undefined,
	language: string,
	t: (key: string, fallback: string) => string,
) => {
	if (!value) return t("contest.status.soon", "Tez orada");

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;

	return `${new Intl.DateTimeFormat(getLocaleCode(language), {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		weekday: "short",
	}).format(date)} ${getTimezoneOffsetLabel(date)}`;
};

const formatContestModalTime = (
	value: string | null | undefined,
	language: string,
	t: (key: string, fallback: string) => string,
) => {
	if (!value) return t("contest.time.scheduled", "belgilangan vaqtda");

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const now = new Date();
	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	const time = `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;

	return isToday
		? `${t("common.today", "Bugun")} ${time}`
		: `${new Intl.DateTimeFormat(getLocaleCode(language), {
				weekday: "short",
			}).format(date)} ${time}`;
};

const getContestCountdown = (
	contest: Contest,
	t: (key: string, fallback: string) => string,
	now = Date.now(),
) => {
	const status = pickString(contest.status)?.toLowerCase();
	if (status === "finished" || status === "completed") {
		return t("contest.status.finished", "Yakunlangan");
	}
	if (status === "active" || status === "live" || status === "in_progress") {
		return t("contest.status.started", "Boshlangan");
	}

	const startsAt = pickString(
		contest.starts_at,
		contest.start_time,
		contest.started_at,
	);
	if (!startsAt) return t("contest.status.soon", "Tez orada");

	const startedAt = new Date(startsAt).getTime();
	if (Number.isNaN(startedAt)) return t("contest.status.soon", "Tez orada");

	const diffSeconds = Math.max(0, Math.floor((startedAt - now) / 1000));
	if (diffSeconds <= 0) return t("contest.status.started", "Boshlangan");

	const days = Math.floor(diffSeconds / 86400);
	const hours = Math.floor((diffSeconds % 86400) / 3600);
	const minutes = Math.floor((diffSeconds % 3600) / 60);
	const seconds = diffSeconds % 60;
	const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

	return days > 0 ? `${days}d ${time}` : time;
};

const getLiveCountdown = (
	startsAt: string | null | undefined,
	contestStatus: string | null | undefined,
	t: (key: string, fallback: string) => string,
	now: number,
) => {
	const status = pickString(contestStatus)?.toLowerCase();
	if (status === "finished" || status === "completed") {
		return t("contest.status.finished", "Yakunlangan");
	}
	if (status === "active" || status === "live" || status === "in_progress") {
		return t("contest.status.started", "Boshlangan");
	}
	if (!startsAt) return t("contest.status.soon", "Tez orada");

	const startedAt = new Date(startsAt).getTime();
	if (Number.isNaN(startedAt)) return t("contest.status.soon", "Tez orada");

	const diffSeconds = Math.max(0, Math.floor((startedAt - now) / 1000));
	if (diffSeconds <= 0) return t("contest.status.started", "Boshlangan");

	const days = Math.floor(diffSeconds / 86400);
	const hours = Math.floor((diffSeconds % 86400) / 3600);
	const minutes = Math.floor((diffSeconds % 3600) / 60);
	const seconds = diffSeconds % 60;
	const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

	return days > 0 ? `${days}d ${time}` : time;
};

const isContestStarted = (contest: ContestItem) => Boolean(contest.isStarted);

const getContestTimestamp = (contest: Contest) => {
	const value = pickString(
		contest.ended_at,
		contest.ends_at,
		contest.end_time,
		contest.started_at,
		contest.starts_at,
		contest.start_time,
	);

	if (!value) return 0;

	const timestamp = new Date(value).getTime();

	return Number.isFinite(timestamp) ? timestamp : 0;
};

const isContestCompleted = (contest: Contest) => {
	const status = pickString(contest.status)?.toLowerCase();

	if (
		status === "finished" ||
		status === "completed" ||
		status === "ended" ||
		status === "done"
	) {
		return true;
	}

	const endedAt = pickString(contest.ended_at, contest.ends_at, contest.end_time);
	if (!endedAt) return false;

	const endedAtTimestamp = new Date(endedAt).getTime();

	return Number.isFinite(endedAtTimestamp) && endedAtTimestamp <= Date.now();
};

const getContestRankingPeriod = (
	contest: Contest,
): ContestRankingPeriod | null => {
	const rawValue = pickString(
		contest.recurrence,
		contest.contest_type,
		contest.type,
		contest.kind,
		contest.category,
		contest.group,
		contest.title,
		contest.name,
	)?.toLowerCase();

	if (!rawValue) return null;
	if (
		rawValue.includes("daily") ||
		rawValue.includes("kunlik") ||
		rawValue.includes("day")
	) {
		return "daily";
	}
	if (
		rawValue.includes("weekly") ||
		rawValue.includes("haftalik") ||
		rawValue.includes("week")
	) {
		return "weekly";
	}

	return null;
};

const getContestScope = (contest: Contest): ContestScope => {
	if (typeof contest.is_global === "boolean") {
		return contest.is_global ? "global" : "academy";
	}

	const rawScope = pickString(
		contest.scope,
		contest.contest_type,
		contest.type,
		contest.kind,
		contest.category,
		contest.group,
	)?.toLowerCase();

	if (!rawScope) return "academy";
	if (rawScope.includes("global")) return "global";

	return "academy";
};

const getMyContestId = (item: MyContest) => {
	const record = asRecord(item);
	const nestedContest = asRecord(record?.contest);

	return pickId(
		record?.contest_id,
		nestedContest?.id,
		record?.id,
	);
};

const getContestStartedState = (contest: Contest) => {
	const status = pickString(contest.status)?.toLowerCase();
	if (status === "active" || status === "live" || status === "in_progress") {
		return true;
	}

	const startsAt = pickString(
		contest.starts_at,
		contest.start_time,
		contest.started_at,
	);
	if (!startsAt) return false;
	const startedAt = new Date(startsAt).getTime();
	return Number.isFinite(startedAt) && startedAt <= Date.now();
};

const mapContest = (
	contest: Contest,
	index: number,
	language: string,
	t: (key: string, fallback: string) => string,
): ContestItem => {
	const isCompleted = isContestCompleted(contest);
	const startsAt = pickString(
		contest.starts_at,
		contest.start_time,
		contest.started_at,
	);
	const gradientValue = Array.isArray(contest.gradient)
		? (contest.gradient as unknown[])
		: null;
	const gradient =
		gradientValue &&
		typeof gradientValue[0] === "string" &&
		typeof gradientValue[1] === "string"
			? ([gradientValue[0], gradientValue[1]] as [string, string])
			: CONTEST_GRADIENTS[index % CONTEST_GRADIENTS.length];

	return {
		id: contest.id,
		title:
			pickString(contest.title, contest.name) ??
			`${t("contest.title", "Contest")} ${String(contest.id)}`,
		startLabel: formatContestDate(startsAt, language, t),
		startTimeLabel: formatContestModalTime(startsAt, language, t),
		countdown: getContestCountdown(contest, t),
		isStarted: getContestStartedState(contest),
		imageSource: FALLBACK_CONTEST_IMAGES[index % FALLBACK_CONTEST_IMAGES.length],
		gradient,
		isCompleted,
		isJoined: pickBoolean(contest.is_joined),
		showReminder: !isCompleted,
		scope: getContestScope(contest),
		startsAt: startsAt ?? null,
		contestStatus: pickString(contest.status) ?? null,
	};
};

const getRankingDisplayName = (entry: ContestRankingEntry) => {
	const user = asRecord(entry.user);
	const firstName = pickString(entry.first_name, user?.first_name);
	const lastName = pickString(entry.last_name, user?.last_name);
	const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
	const username = pickString(entry.username, user?.username);

	return (
		pickString(entry.display_name, entry.full_name, fullName, username) ??
		"Foydalanuvchi"
	);
};

const getRankingUserId = (entry: ContestRankingEntry) => {
	const user = asRecord(entry.user);

	return pickId(entry.user_id, user?.id, entry.id);
};

const getContestReward = (rank: number) => {
	if (rank === 1) return 200;
	if (rank === 2) return 150;
	if (rank === 3) return 100;
	if (rank >= 4 && rank <= 10) return 30;
	return 0;
};

const mapRankingEntry = (
	entry: ContestRankingEntry,
	index: number,
	t: (key: string, fallback: string) => string,
): RankingUser => {
	const user = asRecord(entry.user);
	const rank = pickNumber(entry.rank, entry.place, index + 1) ?? index + 1;
	const avatarUrl =
		resolveAssetUrl(
			pickString(
				entry.photo_url,
				entry.avatar_url,
				entry.profile_photo_url,
				user?.photo_url,
				user?.avatar_url,
				user?.profile_photo_url,
			),
		) ?? "https://assets.leetcode.com/users/default_avatar.jpg";
	const medal =
		rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined;
	const correctCount = pickNumber(entry.correct_count);
	const wrongCount = pickNumber(entry.wrong_count);
	const durationSeconds =
		parseRankingDurationSeconds(
			entry.duration_secs,
			entry.duration_seconds,
			entry.duration,
			entry.elapsed_seconds,
			entry.elapsed_secs,
			entry.elapsed_time,
			entry.time,
			entry.time_taken,
			entry.time_taken_seconds,
			entry.time_spent,
			entry.time_spent_secs,
			entry.time_spent_seconds,
			entry.spent_time,
			entry.solve_time,
			entry.total_time,
		) ??
		getDateDiffSeconds(
			entry.started_at ?? entry.start_time ?? entry.created_at,
			entry.finished_at ?? entry.end_time ?? entry.submitted_at,
		);
	const durationLabel = formatRankingDuration(
		durationSeconds,
	);
	const metrics: { label: string; value: number | string }[] = [];

	if (typeof correctCount === "number" && typeof wrongCount === "number") {
		metrics.push({
			label: t("contest.ranking.answers", "Javob"),
			value: `${correctCount}/${wrongCount}`,
		});
	}
	if (durationLabel) {
		metrics.push({ label: t("contest.ranking.time", "Vaqt"), value: durationLabel });
	}
	const score = pickNumber(entry.score, entry.points);
	if (typeof score === "number") {
		metrics.push({ label: t("contest.ranking.score", "Ball"), value: score });
	}
	const rating = pickNumber(entry.rating);
	if (typeof rating === "number") {
		metrics.push({ label: t("contest.ranking.rating", "Reyting"), value: rating });
	}
	const attended = pickNumber(entry.attended, entry.attended_count, entry.contests_count);
	if (typeof attended === "number") {
		metrics.push({
			label: t("contest.ranking.attended", "Qatnashgan"),
			value: attended,
		});
	}

	return {
		rank,
		displayName: getRankingDisplayName(entry),
		userId: getRankingUserId(entry),
		avatarUrl,
		metrics,
		medal,
		primaryMetric: metrics[0]?.value,
	};
};

function ContestHeader() {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";

	return (
		<Box className="px-4 my-2 flex-row items-center justify-between">
			<Box>
				<YandexRippleButton
					onPress={() => router.replace("/tabs/(tabs)/home")}
					borderRadius={9999}
				>
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
				<Text className="text-sm" style={{ color: muted }}>
					{t("contest.subtitleShort", "Haftalik musobaqalar")}
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

function ContestScopeTabs({
	onChange,
	value,
}: {
	onChange: (value: ContestScope) => void;
	value: ContestScope;
}) {
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const [dimensions, setDimensions] = React.useState({ height: 48, width: 100 });
	const activeIndex = CONTEST_SCOPE_OPTIONS.findIndex(
		(option) => option.value === value,
	);
	const indicatorInset = 4;
	const buttonWidth = dimensions.width / CONTEST_SCOPE_OPTIONS.length;
	const indicatorWidth = Math.max(0, buttonWidth - indicatorInset * 2);
	const indicatorHeight = Math.max(0, dimensions.height - indicatorInset * 2);
	const indicatorX = useSharedValue(
		Math.max(0, activeIndex) * buttonWidth + indicatorInset,
	);

	React.useEffect(() => {
		indicatorX.value = withTiming(
			Math.max(0, activeIndex) * buttonWidth + indicatorInset,
			{
				duration: 240,
				easing: Easing.out(Easing.cubic),
			},
		);
	}, [activeIndex, buttonWidth, indicatorInset, indicatorX]);

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: indicatorX.value }],
	}));

	const handleLayout = (event: LayoutChangeEvent) => {
		setDimensions({
			height: event.nativeEvent.layout.height,
			width: event.nativeEvent.layout.width,
		});
	};

	return (
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
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 1 }}
			style={{
				borderRadius: 999,
				marginHorizontal: 16,
				marginTop: 16,
				padding: 0.8,
			}}
		>
			<Box
				className="flex-row rounded-full p-1 overflow-hidden"
				onLayout={handleLayout}
				style={{ backgroundColor: isDark ? "#171717" : "#ffffff" }}
			>
				<Animated.View
					style={[
						indicatorStyle,
						{
							position: "absolute",
							left: 0,
							top: indicatorInset,
							height: indicatorHeight,
							width: indicatorWidth,
							borderRadius: 999,
							backgroundColor: isDark ? "#f5f5f5" : "#111111",
						},
					]}
				/>
				{CONTEST_SCOPE_OPTIONS.map((option) => {
					const isActive = option.value === value;

					return (
						<YandexRippleButton
							key={option.value}
							borderRadius={999}
							onPress={() => onChange(option.value)}
							rippleOpacity={0.05}
							style={{ flex: 1 }}
						>
							<Box className="h-10 items-center justify-center rounded-full">
								<Text
									className="text-sm font-semibold"
									style={{
										color: isActive
											? isDark
												? "#111111"
												: "#ffffff"
											: isDark
												? "#d4d4d4"
												: "#525252",
									}}
								>
									{option.value === "global"
										? t("contest.scope.global", "Global")
										: t("contest.scope.academy", "Academy")}
								</Text>
							</Box>
						</YandexRippleButton>
					);
				})}
			</Box>
		</LinearGradient>
	);
}

function CountdownChip({
	blurTarget,
	isDark,
	label,
}: {
	blurTarget: React.RefObject<View | null>;
	isDark: boolean;
	label: string;
}) {
	const { t } = useI18n();
	const isLive = label === t("contest.status.started", "Boshlangan");

	if (isLive) return <LiveChip blurTarget={blurTarget} isDark={isDark} />;

	return (
		<BlurView
			blurTarget={blurTarget}
			blurReductionFactor={1}
			intensity={18}
			tint="dark"
			blurMethod="dimezisBlurView"
			className="absolute right-4 top-4 z-20 overflow-hidden rounded-full"
			style={{
				backgroundColor: isDark
					? "rgba(255,255,255,0.05)"
					: "rgba(0,0,0,0.05)",
			}}
		>
			<Box className="flex-row items-center gap-2 px-3.5 py-2">
				<Hourglass size={14} color="#ffffff" strokeWidth={2.1} />
				<Text className="text-[13px] font-semibold tabular-nums text-white shadow-sm">
					{label}
				</Text>
			</Box>
		</BlurView>
	);
}

function LiveChip({
	blurTarget,
	isDark,
}: {
	blurTarget: React.RefObject<View | null>;
	isDark: boolean;
}) {
	const { t } = useI18n();
	const pulse = useSharedValue(1);

	React.useEffect(() => {
		pulse.value = withRepeat(
			withSequence(
				withTiming(1.35, { duration: 700 }),
				withTiming(1, { duration: 700 }),
			),
			-1,
			false,
		);
	}, [pulse]);

	const pulseStyle = useAnimatedStyle(() => ({
		opacity: 2 - pulse.value,
		transform: [{ scale: pulse.value }],
	}));

	return (
		<BlurView
			blurTarget={blurTarget}
			blurReductionFactor={1}
			intensity={18}
			tint="dark"
			blurMethod="dimezisBlurView"
			style={{
				position: "absolute",
				right: 16,
				top: 16,
				zIndex: 20,
				borderRadius: 999,
				overflow: "hidden",
				backgroundColor: isDark
					? "rgba(255,255,255,0.05)"
					: "rgba(0,0,0,0.05)",
			}}
		>
			<Box className="flex-row items-center gap-2 rounded-full px-3.5 py-2">
				<Box className="h-3 w-3 items-center justify-center">
					<Animated.View
						style={[
							{
								backgroundColor: "rgba(34,197,94,0.38)",
								borderRadius: 999,
								height: 12,
								position: "absolute",
								width: 12,
							},
							pulseStyle,
						]}
					/>
					<Box className="h-2 w-2 rounded-full bg-emerald-500" />
				</Box>
				<Text className="text-[13px] font-semibold text-white shadow-sm">
					{t("contest.status.live", "Live")}
				</Text>
			</Box>
		</BlurView>
	);
}

function ContestCard({
	cardWidth,
	contest,
	onPress,
}: {
	cardWidth: number;
	contest: ContestItem;
	onPress?: () => void;
}) {
	const cardHeight = cardWidth * 0.625;
	const blurTargetRef = React.useRef<View | null>(null);
	const { colorMode } = useAppTheme();
	const isDark = colorMode === "dark";

	return (
		<YandexRippleButton
			borderRadius={32}
			disabled={!onPress}
			onPress={onPress}
			rippleOpacity={0.05}
		>
			<Box
				className="overflow-hidden rounded-[32px] bg-card"
				style={{
					height: cardHeight,
					width: cardWidth,
				}}
			>
				<BlurTargetView
					ref={blurTargetRef}
					style={StyleSheet.absoluteFillObject}
				>
					<Image
						source={contest.imageSource}
						style={{ height: "100%", width: "100%" }}
						resizeMethod="resize"
						resizeMode="stretch"
					/>
				</BlurTargetView>

				<CountdownChip
					blurTarget={blurTargetRef}
					isDark={isDark}
					label={contest.countdown}
				/>

				<BlurView
					blurTarget={blurTargetRef}
					blurReductionFactor={1}
					intensity={18}
					tint="dark"
					blurMethod="dimezisBlurView"
					className="absolute bottom-0 left-0 right-0 z-20 overflow-hidden"
					style={{
						backgroundColor: isDark
							? "rgba(255,255,255,0.05)"
							: "rgba(0,0,0,0.05)",
					}}
				>
					<Box className="flex-row items-center justify-between px-7 py-4">
						<Box className="flex-1 pr-3">
							<Text className="text-base font-semibold text-white shadow-sm">
								{contest.title}
							</Text>
							<Text className="mt-0.5 text-xs text-white/70 shadow-sm">
								{contest.startLabel}
							</Text>
						</Box>
					</Box>
				</BlurView>
			</Box>
		</YandexRippleButton>
	);
}

function ContestCardSkeleton({ width }: { width: number }) {
	const height = width * 0.625;

	return (
		<Box
			className="overflow-hidden rounded-[32px] bg-card"
			style={{ height, width }}
		>
			<Box className="absolute right-4 top-4 h-9 w-28 rounded-full bg-white/10" />
			<Box className="absolute bottom-0 left-0 right-0 px-7 py-4 bg-white/5">
				<Box className="h-5 w-36 rounded-full bg-white/10" />
				<Box className="mt-2 h-3 w-44 rounded-full bg-white/10" />
			</Box>
		</Box>
	);
}

function RankingPanel({
	currentUser,
	emptyMessage,
	isLoading,
	onPeriodChange,
	period,
	rankingContestTitle,
	users,
}: {
	currentUser?: RankingUser | null;
	emptyMessage: string;
	isLoading?: boolean;
	onPeriodChange: (value: ContestRankingPeriod) => void;
	period: ContestRankingPeriod;
	rankingContestTitle?: string | null;
	users: RankingUser[];
}) {
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const [showAll, setShowAll] = React.useState(false);
	const bodyBg = isDark ? "23,24,24" : "242,242,242";
	const fadeColors: [string, string, string] = isDark
		? [`rgba(${bodyBg},0)`, `rgba(${bodyBg},0.86)`, `rgb(${bodyBg})`]
		: [`rgba(${bodyBg},0)`, `rgba(${bodyBg},0.9)`, `rgb(${bodyBg})`];
	const rankingUsers = users;
	const topUsers = rankingUsers.slice(0, 10);
	const visibleUsers = showAll ? rankingUsers : topUsers;
	const hasPodium = visibleUsers.length >= 3;
	const podiumUsers = hasPodium
		? [visibleUsers[1], visibleUsers[0], visibleUsers[2]]
		: [];
	const visibleListUsers = hasPodium ? visibleUsers.slice(3) : visibleUsers;
	const shouldAppendCurrentUser =
		!showAll &&
		Boolean(currentUser) &&
		!topUsers.some((user) => user.userId === currentUser?.userId);
	const listUsers = shouldAppendCurrentUser && currentUser
		? [...visibleListUsers, currentUser]
		: visibleListUsers;
	const shadowStyle = isDark
		? {}
		: {
				shadowColor: "#0f172a",
				shadowOffset: { width: 0, height: 8 },
				shadowOpacity: 0.08,
				shadowRadius: 18,
				elevation: 2,
			};
	const [periodDimensions, setPeriodDimensions] = React.useState({
		height: 40,
		width: 190,
	});
	const periodIndex = CONTEST_RANKING_PERIOD_OPTIONS.findIndex(
		(option) => option.value === period,
	);
	const periodInset = 4;
	const periodButtonWidth =
		(periodDimensions.width - periodInset * 2) /
		CONTEST_RANKING_PERIOD_OPTIONS.length;
	const periodIndicatorWidth = Math.max(0, periodButtonWidth - 3);
	const periodIndicatorHeight = Math.max(
		0,
		periodDimensions.height - periodInset * 2 - 2,
	);
	const periodIndicatorX = useSharedValue(
		periodInset + Math.max(0, periodIndex) * periodButtonWidth,
	);

	React.useEffect(() => {
		periodIndicatorX.value = withTiming(
			periodInset + Math.max(0, periodIndex) * periodButtonWidth,
			{
				duration: 240,
				easing: Easing.out(Easing.cubic),
			},
		);
	}, [periodButtonWidth, periodIndex, periodIndicatorX]);

	const periodIndicatorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: periodIndicatorX.value }],
	}));

	React.useEffect(() => {
		setShowAll(false);
	}, [period, rankingContestTitle]);

	return (
		<Box className="mx-3 mt-3">
			<Box className="items-center">
				<Box
					className="h-10 flex-row rounded-full border border-border bg-card p-1 overflow-hidden"
					onLayout={(event) =>
						setPeriodDimensions({
							height: event.nativeEvent.layout.height,
							width: event.nativeEvent.layout.width,
						})
					}
					style={[
						shadowStyle,
						{
							alignSelf: "center",
							width: 190,
						},
					]}
				>
					<Animated.View
						style={[
							periodIndicatorStyle,
							{
								position: "absolute",
								left: 0,
								top: periodInset,
								height: periodIndicatorHeight,
								width: periodIndicatorWidth,
								borderColor: "#ffb347",
								borderRadius: 999,
								borderWidth: 1,
								overflow: "hidden",
							},
						]}
					>
						<LinearGradient
							colors={["#ffc85a", "#ff9f2f", "#ff784b"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={StyleSheet.absoluteFillObject}
						/>
					</Animated.View>
					{CONTEST_RANKING_PERIOD_OPTIONS.map((option) => {
						const isActive = option.value === period;

						return (
							<YandexRippleButton
								key={option.value}
								borderRadius={999}
								onPress={() => onPeriodChange(option.value)}
								rippleOpacity={0.05}
								style={{ width: periodButtonWidth }}
							>
								<Box className="h-full w-full items-center justify-center">
									<Text
										className="text-[11px] font-semibold uppercase"
										style={{
											color: isActive
												? "#ffffff"
												: isDark
													? "#a1a1aa"
													: "#64748b",
											includeFontPadding: false,
											letterSpacing: 0.88,
											lineHeight: 14,
											textAlign: "center",
											textAlignVertical: "center",
										}}
									>
										{option.value === "daily"
											? t("contest.period.daily", "Kunlik")
											: t("contest.period.weekly", "Haftalik")}
									</Text>
								</Box>
							</YandexRippleButton>
						);
					})}
				</Box>
				{rankingContestTitle ? (
					<Text className="mt-4 text-xs text-muted-foreground">
						{rankingContestTitle}
					</Text>
				) : null}
			</Box>

			{isLoading ? (
				<Box className="mt-6 py-10 items-center justify-center">
					<ActivityIndicator color="#ff9f2f" />
				</Box>
			) : rankingUsers.length === 0 ? (
				<Box className="mt-6 px-5 py-10 items-center">
					<Trophy size={56} color="#a1a1aa" strokeWidth={1.3} />
					<Text className="mt-4 text-center text-sm text-muted-foreground">
						{emptyMessage}
					</Text>
				</Box>
			) : (
				<>
					{hasPodium ? (
						<Box className="mt-0 h-[292px] overflow-hidden">
							<Box
								className="h-full flex-row items-end justify-center gap-5 pt-2"
								style={{ paddingBottom: 4 }}
							>
								{podiumUsers.map((user) => (
									<PodiumColumn key={user.rank} user={user} isDark={isDark} />
								))}
							</Box>
							<LinearGradient
								pointerEvents="none"
								colors={fadeColors}
								locations={[0, 0.72, 1]}
								style={{
									bottom: 0,
									height: 44,
									left: 0,
									position: "absolute",
									right: 0,
								}}
							/>
						</Box>
					) : null}

						<Box className={hasPodium ? "gap-1.5" : "mt-6 gap-1.5"}>
							{listUsers.map((user) => (
							<RankingListRow
								key={`${user.userId ?? user.rank}-${user.rank}`}
								user={user}
								isDark={isDark}
							/>
						))}
					</Box>
				</>
			)}

			{rankingUsers.length > visibleUsers.length ? (
				<Box className="mt-4 items-center">
					<YandexRippleButton
						borderRadius={999}
						onPress={() => setShowAll(true)}
						rippleOpacity={0.05}
					>
						<Box className="min-h-9 rounded-full border border-border bg-card px-4 items-center justify-center">
							<Text className="text-xs font-medium">
								{t("common.showMore", "Ko'proq ko'rsatish")}
							</Text>
						</Box>
					</YandexRippleButton>
				</Box>
			) : null}
		</Box>
	);
}

function PodiumColumn({
	isDark,
	user,
}: {
	isDark: boolean;
	user: RankingUser;
}) {
	const { t } = useI18n();
	const medal = user.medal ?? "gold";
	const isGold = medal === "gold";
	const isSilver = medal === "silver";
	const medalPalette = {
		gold: {
			rank: "#eab308",
			ring: "#624512",
			inner: "#e9cd77",
			name: isDark ? "#f8fafc" : "#334155",
			rating: isDark ? "#a1a1aa" : "#64748b",
		},
		silver: {
			rank: "#94a3b8",
			ring: "#464646",
			inner: "#bcbcbc",
			name: isDark ? "#e2e8f0" : "#334155",
			rating: isDark ? "#A2A2A2" : "#475569",
		},
		bronze: {
			rank: "#b45309",
			ring: "#4c291c",
			inner: "#cb9f93",
			name: isDark ? "#e2e8f0" : "#334155",
			rating: isDark ? "#A2A2A2" : "#475569",
		},
	}[medal];
	const columnHeight = isGold ? 168 : isSilver ? 152 : 144;
	const visibleColumnHeight = columnHeight + 76;
	const pillarTop = 99;
	const cardTop = 115;
	const shadowStyle = isDark
		? {}
		: {
				shadowColor: "#0f172a",
				shadowOffset: { width: 0, height: 8 },
				shadowOpacity: 0.06,
				shadowRadius: 18,
				elevation: 2,
			};

	return (
		<Box
			className="relative"
			style={{
				height: visibleColumnHeight,
				width: 80,
			}}
		>
			<LinearGradient
				colors={
					isDark
						? ["#0b0b0c", "#202124", "#0b0b0c"]
						: ["#d4d4d4", "#f5f5f5", "#d4d4d4"]
				}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={{
					height: 200,
					left: 0,
					position: "absolute",
					top: pillarTop,
					width: 80,
				}}
			/>
			<LinearGradient
				colors={
					isDark
						? ["#313131", "#4A4A4A", "#27282A"]
						: ["#9A9A9A", "#E0E0E0", "#FFFFFF"]
				}
				start={{ x: 0, y: 0.5 }}
				end={{ x: 1, y: 0.5 }}
				style={{
					borderRadius: 999,
					height: 20,
					left: 0,
					position: "absolute",
					top: 90,
					width: 80,
				}}
			/>

			<Box
				className="absolute rounded-full"
				style={{
					backgroundColor: medalPalette.ring,
					height: 83,
					left: 0,
					top: 18,
					width: 80,
				}}
			/>
			<Box
				className="absolute rounded-full"
				style={{
					backgroundColor: medalPalette.inner,
					height: 80,
					left: 0,
					top: 16.5,
					width: 80,
				}}
			/>
			<Image
				source={{ uri: user.avatarUrl }}
				resizeMode="cover"
				style={{
					borderRadius: 36,
					height: 72,
					left: 4,
					position: "absolute",
					top: 20.5,
					width: 72,
				}}
			/>
			<Box
				className="absolute items-center justify-center"
				style={{
					height: 30,
					left: 25,
					top: -10,
					width: 30,
				}}
			>
				<Box
					style={{
						backgroundColor: medalPalette.rank,
						borderRadius: 7,
						height: 24,
						position: "absolute",
						transform: [{ rotate: "45deg" }],
						width: 24,
					}}
				/>
				<Box
					style={{
						borderLeftColor: "transparent",
						borderLeftWidth: 4,
						borderRightColor: "transparent",
						borderRightWidth: 4,
						borderTopColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.32)",
						borderTopWidth: 5,
						bottom: 0,
						position: "absolute",
					}}
				/>
				<Crown size={15} color="#ffffff" fill="#ffffff" strokeWidth={2.2} />
			</Box>

			<Box
				className="absolute items-center justify-center rounded-2xl border border-border bg-card px-2 py-2"
				style={{
					minHeight: 58,
					left: -8,
					top: cardTop,
					width: 96,
					...shadowStyle,
				}}
			>
				<Text
					className="text-xs font-medium text-center"
					numberOfLines={1}
					style={{ color: medalPalette.name }}
				>
					{user.isCurrentUser ? t("common.you", "Siz") : user.displayName}
					{user.countryFlag ? ` ${user.countryFlag}` : ""}
				</Text>
				<Text className="mt-1 text-xs text-center" style={{ color: medalPalette.rating }}>
					{user.primaryMetric ?? "-"}
				</Text>
			</Box>

		</Box>
	);
}

function RankingListRow({
	isDark,
	user,
}: {
	isDark: boolean;
	user: RankingUser;
}) {
	const { t } = useI18n();
	const shadowStyle = isDark
		? {}
		: {
				shadowColor: "#0f172a",
				shadowOffset: { width: 0, height: 8 },
				shadowOpacity: 0.06,
				shadowRadius: 18,
				elevation: 2,
			};
	const muted = isDark ? "#a1a1aa" : "#64748b";
	const shouldHighlight = user.isCurrentUser && user.rank > 3;

	return (
		<Box
			className="h-16 rounded-2xl border bg-card px-4 flex-row items-center gap-4"
			style={[
				shadowStyle,
				{
					borderColor: shouldHighlight ? "#facc15" : isDark ? "#2f2f2f" : "#e5e7eb",
					borderWidth: shouldHighlight ? 1.5 : 1,
				},
			]}
		>
			<Box className="w-5 rounded-full bg-background items-center justify-center">
				<Text className="text-xs leading-5" style={{ color: isDark ? "#e5e7eb" : "#334155" }}>
					{user.rank}
				</Text>
			</Box>
			<Image
				source={{ uri: user.avatarUrl }}
				resizeMode="cover"
				className="h-7 w-7 rounded-full"
			/>
			<Box className="flex-1 flex-row items-center">
				<Text className="flex-1 text-sm font-medium" numberOfLines={1}>
					{user.isCurrentUser ? t("common.you", "Siz") : user.displayName}
					{user.countryFlag ? ` ${user.countryFlag}` : ""}
				</Text>
				<Box className="ml-3 items-end">
					{user.metrics.length > 0 ? (
						user.metrics.slice(0, 2).map((metric) => (
							<Text
								key={metric.label}
								className="text-xs leading-4"
								style={{ color: muted }}
							>
								{metric.label}:{" "}
								<Text
									className="text-xs leading-4"
									style={{ color: isDark ? "#ffffff" : "#0f172a" }}
								>
									{metric.value}
								</Text>
							</Text>
						))
					) : (
						<Text className="text-xs leading-4" style={{ color: muted }}>
							#{user.rank}
						</Text>
					)}
				</Box>
			</Box>
		</Box>
	);
}

function JoinedContestInfoModal({
	contest,
	onClose,
}: {
	contest: JoinedContestModalState;
	onClose: () => void;
}) {
	const { language, t } = useI18n();
	const startTimeLabel =
		contest?.startTimeLabel?.trim() ||
		contest?.startLabel?.trim() ||
		t("contest.time.scheduled", "belgilangan vaqtda");
	const message = getLocalizedJoinedMessage(language, startTimeLabel);

	return (
		<Modal isOpen={Boolean(contest)} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="mt-0 mb-0 pt-8 pb-0">
					<Box className="items-center">
						<Box className="h-20 w-20 rounded-full border-2 border-emerald-300 items-center justify-center">
							<Check size={36} color="#0f9f6e" strokeWidth={2.6} />
						</Box>

						<Heading className="mt-8 text-center text-2xl font-bold">
							{t("contest.joined.title", "Ro'yxatdan o'tdingiz")}
						</Heading>
						<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
							{message}
						</Text>

						<Pressable className="mt-6 w-1/2" onPress={onClose}>
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

function ContestResultModal({
	result,
	onClose,
}: {
	result: ContestResultModalState;
	onClose: () => void;
}) {
	const { language, t } = useI18n();
	const isWinner = Boolean(result && result.reward > 0);
	const contestTitle = result?.contestTitle ?? t("contest.title", "Contest");
	const resultMessage = getLocalizedResultMessage({
		contestTitle,
		isWinner,
		language,
		rank: result?.rank ?? 0,
		reward: result?.reward ?? 0,
	});

	return (
		<Modal isOpen={Boolean(result)} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="mt-0 mb-0 pt-8 pb-0">
					<Box className="items-center">
						<Box className="h-20 w-20 rounded-full border-2 border-[#ffb347] items-center justify-center bg-[#ff9f2f]/10">
							{isWinner ? (
								<Image
									source={coinImage}
									style={{ height: 48, width: 48 }}
									resizeMode="contain"
								/>
							) : (
								<Crown size={38} color="#ff9f2f" strokeWidth={2.3} />
							)}
						</Box>

						<Heading className="mt-8 text-center text-2xl font-bold">
							{isWinner
								? t("contest.result.winnerTitle", "Tabriklaymiz!")
								: t("contest.result.keepTryingTitle", "Yaxshi harakat!")}
						</Heading>
						<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
							{resultMessage}
						</Text>

						<Pressable className="mt-6 w-1/2" onPress={onClose}>
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

export default function ContestScreen() {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const { language, t } = useI18n();
	const { user, refreshSession } = useAuth();
	const queryClient = useQueryClient();
	const scheduledNotificationKeyRef = React.useRef("");
	const shownResultModalKeyRef = React.useRef("");
	const [joinedContestModal, setJoinedContestModal] =
		React.useState<JoinedContestModalState>(null);
	const [contestResultModal, setContestResultModal] =
		React.useState<ContestResultModalState>(null);
	const [isRefreshing, setIsRefreshing] = React.useState(false);
	const [joinedAcademy, setJoinedAcademy] = React.useState(false);
	const [now, setNow] = React.useState(() => Date.now());

	React.useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);
	const cardWidth = Math.min(width - 56, 400);
	React.useEffect(() => {
		AsyncStorage.getItem(ACADEMY_JOINED_STORAGE_KEY)
			.then((value) => { if (value === "1") setJoinedAcademy(true); })
			.catch(() => {});
	}, []);

	const [contestScope, setContestScope] =
		React.useState<ContestScope>("global");
	const [rankingPeriod, setRankingPeriod] =
		React.useState<ContestRankingPeriod>("daily");
	const membershipQuery = useAcademyMembershipQuery(
		contestScope === "academy" && Boolean(user?.id),
	);

	// Refetch membership each time user switches to Academy tab
	React.useEffect(() => {
		if (contestScope === "academy" && user?.id) {
			membershipQuery.refetch().catch(() => {});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [contestScope]);

	// When backend says user is no longer a member, clear the local flag
	React.useEffect(() => {
		if (
			!membershipQuery.isLoading &&
			!membershipQuery.isFetching &&
			membershipQuery.data === false &&
			joinedAcademy
		) {
			setJoinedAcademy(false);
			AsyncStorage.removeItem(ACADEMY_JOINED_STORAGE_KEY).catch(() => {});
		}
	}, [membershipQuery.data, membershipQuery.isLoading, membershipQuery.isFetching, joinedAcademy]);

	const contestsQuery = useContestsQuery({ type: contestScope });
	const myContestsQuery = useMyContestsQuery();
	const contests = React.useMemo(() => {
		const backendContests = contestsQuery.data ?? [];
		const joinedContestIds = new Set(
			(myContestsQuery.data ?? [])
				.map(getMyContestId)
				.filter((id): id is string => Boolean(id)),
		);
		const mappedContests = backendContests.map((contest, index) => ({
			...mapContest(contest, index, language, t),
			isJoined:
				pickBoolean(contest.is_joined) || joinedContestIds.has(String(contest.id)),
		}));
		const availableScopes = new Set(mappedContests.map((contest) => contest.scope));
		const missingFallbackContests = FALLBACK_CONTESTS.filter(
			(contest) => !availableScopes.has(contest.scope),
		).map((contest) => getLocalizedContestFallback(contest, t));

		return [...mappedContests, ...missingFallbackContests];
	}, [contestsQuery.data, language, myContestsQuery.data, t]);

	React.useEffect(() => {
		const backendContests = contestsQuery.data ?? [];
		if (backendContests.length === 0) return;

		const joinedContestIds = new Set(
			(myContestsQuery.data ?? [])
				.map(getMyContestId)
				.filter((id): id is string => Boolean(id)),
		);
		const scheduleKey = [
			language,
			...backendContests.map((contest) => {
				const contestId = String(contest.id);
				const isJoined =
					pickBoolean(contest.is_joined) || joinedContestIds.has(contestId);
				const startsAt = pickString(
					contest.starts_at,
					contest.start_time,
					contest.started_at,
				);

				return `${contestId}:${startsAt ?? ""}:${isJoined ? "joined" : "open"}`;
			}),
		].join("|");

		if (scheduledNotificationKeyRef.current === scheduleKey) return;
		scheduledNotificationKeyRef.current = scheduleKey;

		void Promise.all(
			backendContests.map((contest) => {
				const contestId = String(contest.id);
				const isJoined =
					pickBoolean(contest.is_joined) || joinedContestIds.has(contestId);
				const title =
					pickString(contest.title, contest.name) ??
					`${t("contest.title", "Contest")} ${contestId}`;

				return scheduleContestReminderNotifications({
					contest,
					isJoined,
					language,
					title,
				});
			}),
		);
	}, [contestsQuery.data, language, myContestsQuery.data, t]);
	const visibleContests = React.useMemo(
		() =>
			contests
				.filter((contest) => contest.scope === contestScope && !contest.isCompleted)
				.map((contest) => {
					if (contest.isFallback) return contest;
					const liveCountdown = getLiveCountdown(
						contest.startsAt,
						contest.contestStatus,
						t,
						now,
					);
					const status = contest.contestStatus?.toLowerCase();
					const liveIsStarted =
						status === "active" || status === "live" || status === "in_progress"
							? true
							: contest.startsAt
								? new Date(contest.startsAt).getTime() <= now
								: contest.isStarted;
					return { ...contest, countdown: liveCountdown, isStarted: liveIsStarted };
				}),
		[contestScope, contests, now, t],
	);
	const latestRankingContest = React.useMemo(() => {
		const backendContests = contestsQuery.data ?? [];

		return (
			backendContests
				.filter((contest) => getContestScope(contest) === contestScope)
				.filter((contest) => getContestRankingPeriod(contest) === rankingPeriod)
				.filter(isContestCompleted)
				.sort((first, second) => getContestTimestamp(second) - getContestTimestamp(first))[0] ??
			null
		);
	}, [contestScope, contestsQuery.data, rankingPeriod]);
	const rankingQuery = useContestRankingQuery(
		latestRankingContest?.id,
		Boolean(latestRankingContest),
	);
	const currentUserId = user?.id ? String(user.id) : "";
	const rankingUsers = React.useMemo(() => {
		const backendRanking = rankingQuery.data ?? [];

		return backendRanking
			.map((entry, index) => {
				const mappedUser = mapRankingEntry(entry, index, t);
				const isCurrentUser =
					currentUserId.length > 0 && mappedUser.userId === currentUserId;

				return {
					...mappedUser,
					displayName: isCurrentUser ? t("common.you", "Siz") : mappedUser.displayName,
					isCurrentUser,
				};
			})
			.sort((first, second) => first.rank - second.rank);
	}, [currentUserId, rankingQuery.data, t]);
	const currentRankingUser = React.useMemo(() => {
		const fromRanking =
			rankingUsers.find((rankingUser) => rankingUser.isCurrentUser) ?? null;
		if (fromRanking) return fromRanking;
		if (!latestRankingContest) return null;

		const myContest = (myContestsQuery.data ?? []).find(
			(item) => getMyContestId(item) === String(latestRankingContest.id),
		);
		const rank = pickNumber(myContest?.rank);
		if (typeof rank !== "number") return null;

		const correctCount = pickNumber(myContest?.correct_count);
		const wrongCount = pickNumber(myContest?.wrong_count);
		const metrics: { label: string; value: number | string }[] = [];
		if (typeof correctCount === "number" && typeof wrongCount === "number") {
			metrics.push({
				label: t("contest.ranking.answers", "Javob"),
				value: `${correctCount}/${wrongCount}`,
			});
		}

		return {
			avatarUrl:
				resolveAssetUrl(
					pickString(
						user?.photo_url,
						user?.avatar_url,
						user?.profile_photo_url,
						user?.telegram_photo_url,
					),
				) ?? "https://assets.leetcode.com/users/default_avatar.jpg",
			displayName: t("common.you", "Siz"),
			isCurrentUser: true,
			medal:
				rank === 1
					? "gold"
					: rank === 2
						? "silver"
						: rank === 3
							? "bronze"
							: undefined,
			metrics,
			primaryMetric: metrics[0]?.value,
			rank,
			userId: currentUserId,
		} satisfies RankingUser;
	}, [currentUserId, latestRankingContest, myContestsQuery.data, rankingUsers, t, user]);
	React.useEffect(() => {
		if (!latestRankingContest || rankingQuery.isLoading || rankingQuery.isFetching) {
			return;
		}
		if (!currentRankingUser) return;

		const contestId = String(latestRankingContest.id);
		const modalKey = `${contestId}:${currentRankingUser.rank}`;
		if (shownResultModalKeyRef.current === modalKey) return;

		shownResultModalKeyRef.current = modalKey;
		const storageKey = `${CONTEST_RESULT_MODAL_STORAGE_PREFIX}${modalKey}`;

		AsyncStorage.getItem(storageKey)
			.then((seen) => {
				if (seen === "1") return;
				setContestResultModal({
					contestTitle:
						pickString(latestRankingContest.title, latestRankingContest.name) ??
						`${t("contest.title", "Contest")} ${contestId}`,
					rank: currentRankingUser.rank,
					reward: getContestReward(currentRankingUser.rank),
				});
				return AsyncStorage.setItem(storageKey, "1");
			})
			.catch(() => {
				setContestResultModal({
					contestTitle:
						pickString(latestRankingContest.title, latestRankingContest.name) ??
						`${t("contest.title", "Contest")} ${contestId}`,
					rank: currentRankingUser.rank,
					reward: getContestReward(currentRankingUser.rank),
				});
			});
	}, [
		currentRankingUser,
		latestRankingContest,
		rankingQuery.isFetching,
		rankingQuery.isLoading,
		t,
	]);
	// Backend is the source of truth for membership.
	// While query is in-flight or errored, fall back to local signals to avoid false join panel.
	// Once successfully resolved, backend result is authoritative.
	const membershipResolved =
		!membershipQuery.isLoading &&
		!membershipQuery.isFetching &&
		!membershipQuery.isError;
	const isMember = membershipResolved
		? membershipQuery.data === true || joinedAcademy
		: hasAcademyMembership(user) || joinedAcademy;
	const academyAccessRequired =
		contestScope === "academy" && !isMember && membershipResolved;
	const isOffline =
		(isNetworkError(contestsQuery.error) && (contestsQuery.data?.length ?? 0) === 0) ||
		isNetworkError(rankingQuery.error);
	const isMembershipChecking =
		contestScope === "academy" &&
		Boolean(user?.id) &&
		(membershipQuery.isLoading || membershipQuery.isFetching) &&
		!joinedAcademy &&
		!hasAcademyMembership(user);
	const isContestLoading =
		isMembershipChecking ||
		contestsQuery.isLoading ||
		!contestsQuery.isFetched ||
		(contestsQuery.isFetching && contests.length === 0);
	const scopeLabel =
		contestScope === "global"
			? t("contest.scope.global", "Global")
			: t("contest.scope.academy", "Academy");
	const rankingPeriodLabel =
		rankingPeriod === "daily"
			? t("contest.period.daily", "Kunlik")
			: t("contest.period.weekly", "Haftalik");
	const latestRankingContestTitle = latestRankingContest
		? (pickString(latestRankingContest.title, latestRankingContest.name) ??
			`${t("contest.title", "Contest")} ${String(latestRankingContest.id)}`)
		: null;
	const isSingleContestCard = !isContestLoading && visibleContests.length === 1;
	const visibleCardWidth = isSingleContestCard
		? Math.min(width - 32, 400)
		: cardWidth;
	const stateCardWidth = width - 32;
	const rankingEmptyMessage = getLocalizedRankingEmptyMessage({
		contestTitle: latestRankingContestTitle,
		language,
		periodLabel: rankingPeriodLabel,
	});
	const contestErrorMessage = academyAccessRequired
		? ""
		: isOffline
			? ""
		: contestsQuery.isError
		? t("contest.error.list", "Contestlar ro'yxatini olishda xato yuz berdi.")
		: rankingQuery.isError
			? t("contest.error.ranking", "Contest reytingini olishda xato yuz berdi.")
			: "";
	const handleRefresh = React.useCallback(async () => {
		if (isRefreshing) return;
		setIsRefreshing(true);

		try {
			await Promise.all([
				contestsQuery.refetch(),
				myContestsQuery.refetch(),
				rankingQuery.refetch(),
				...(contestScope === "academy" ? [membershipQuery.refetch()] : []),
			]);
		} finally {
			setIsRefreshing(false);
		}
	}, [contestScope, contestsQuery, isRefreshing, membershipQuery, myContestsQuery, rankingQuery]);
	const handleContestPress = React.useCallback(
		(contest: ContestItem) => {
			if (contest.isFallback) return;

			if (contest.isJoined) {
				if (isContestStarted(contest)) {
					router.push({
						pathname: "/tabs/(questions)/contest/[contestId]",
						params: {
							contestId: String(contest.id),
							title: contest.title,
						},
					});
					return;
				}

				setJoinedContestModal({
					startLabel: contest.startLabel,
					startTimeLabel: contest.startTimeLabel,
					title: contest.title,
				});
				return;
			}

			router.push({
				pathname: "/tabs/(questions)/contest/register/[contestId]",
				params: {
					contestId: String(contest.id),
					title: contest.title,
				},
			});
		},
		[router],
	);

	return (
		<Box className="flex-1 pt-safe bg-background">
			<ContestHeader />
			<JoinedContestInfoModal
				contest={joinedContestModal}
				onClose={() => setJoinedContestModal(null)}
			/>
			<ContestResultModal
				result={contestResultModal}
				onClose={() => setContestResultModal(null)}
			/>
				<ContestScopeTabs
					value={contestScope}
					onChange={(nextScope) => {
						setContestScope(nextScope);
					}}
				/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor="#ff9f2f"
						colors={["#ff9f2f"]}
						progressBackgroundColor="#202020"
					/>
				}
			>
				{isOffline ? (
					<NetworkErrorState
						isRetrying={isRefreshing}
						onRetry={handleRefresh}
					/>
				) : (
					<>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					snapToInterval={visibleCardWidth + 20}
					decelerationRate="fast"
					contentContainerStyle={{
						gap: isSingleContestCard ? 0 : 20,
						paddingHorizontal: 16,
						paddingVertical: 22,
					}}
				>
					{academyAccessRequired ? (
						<AcademyJoinPanel
							width={stateCardWidth}
							onJoined={() => {
								setJoinedAcademy(true);
								AsyncStorage.setItem(ACADEMY_JOINED_STORAGE_KEY, "1").catch(() => {});
								refreshSession().catch(() => {});
								queryClient.invalidateQueries({
									queryKey: contestQueryKeys.academyMembership,
								});
								contestsQuery.refetch();
								myContestsQuery.refetch();
								rankingQuery.refetch();
							}}
						/>
					) : isContestLoading ? (
						<Box
							className="items-center justify-center"
							style={{ height: stateCardWidth * 0.625, width: stateCardWidth }}
						>
							<ActivityIndicator color="#ff9f2f" />
						</Box>
					) : visibleContests.length > 0 ? (
						visibleContests.map((contest) => (
								<ContestCard
									key={contest.id}
									cardWidth={visibleCardWidth}
									contest={contest}
									onPress={() => handleContestPress(contest)}
								/>
							))
					) : (
						<Box
							className="items-center justify-center px-6"
							style={{ height: stateCardWidth * 0.625, width: stateCardWidth }}
						>
							<CalendarX size={56} color="#a1a1aa" strokeWidth={1.3} />
							<Text className="mt-4 text-center text-sm text-muted-foreground">
								{t("contest.empty.notJoined", "Hali contest qo'shilmagan")}
							</Text>
						</Box>
					)}
				</ScrollView>

					{contestErrorMessage ? (
					<Box className="mx-3 mb-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
						<Text className="text-sm text-destructive">
							{contestErrorMessage}
						</Text>
					</Box>
				) : null}

				{academyAccessRequired || isMembershipChecking ? null : (
					<RankingPanel
						currentUser={currentRankingUser}
						emptyMessage={rankingEmptyMessage}
						isLoading={
							rankingQuery.isLoading ||
							rankingQuery.isFetching ||
							!rankingQuery.isFetched
						}
						onPeriodChange={setRankingPeriod}
						period={rankingPeriod}
						rankingContestTitle={latestRankingContestTitle}
						users={rankingUsers}
					/>
				)}
					</>
				)}
			</ScrollView>
		</Box>
	);
}
