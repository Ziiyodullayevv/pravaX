import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import type { Contest } from "@/features/contests/api";

const CONTEST_NOTIFICATION_CHANNEL_ID = "contest-reminders";
const REMINDER_OFFSETS = [30, 5] as const;

type ExpoNotifications = typeof import("expo-notifications");
type ContestReminderLanguage = "uzl" | "uzk" | "ru";

// expo-notifications removed Android push support from Expo Go in SDK 53.
// Importing the module in Expo Go on Android throws at module load time
// (DevicePushTokenAutoRegistration side effect). Skip the import entirely
// in that environment — notifications quietly no-op until a dev/prod build.
const isExpoGo =
	Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const notificationsSupported = !(isExpoGo && Platform.OS === "android");

let notificationModulePromise: Promise<ExpoNotifications | null> | null = null;

async function getNotificationsModule() {
	if (!notificationsSupported) return null;

	if (!notificationModulePromise) {
		notificationModulePromise = import("expo-notifications")
			.then((notifications) => {
				if (typeof notifications?.setNotificationHandler !== "function") {
					return null;
				}
				notifications.setNotificationHandler({
					handleNotification: async () => ({
						shouldPlaySound: true,
						shouldSetBadge: false,
						shouldShowBanner: true,
						shouldShowList: true,
					}),
				});

				return notifications;
			})
			.catch((error) => {
				console.warn(
					"Contest notifications are unavailable in this runtime.",
					error instanceof Error ? error.message : error,
				);
				return null;
			});
	}

	return notificationModulePromise;
}

const pickString = (...values: unknown[]) =>
	values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();

function getContestStartDate(contest?: Contest | null) {
	const startsAt = pickString(
		contest?.starts_at,
		contest?.start_time,
		contest?.started_at,
	);
	if (!startsAt) return null;

	const date = new Date(startsAt);
	return Number.isNaN(date.getTime()) ? null : date;
}

function getReminderLanguage(language?: string): ContestReminderLanguage {
	if (language?.startsWith("ru")) return "ru";
	if (language?.includes("Cyrl") || language?.includes("cyr")) return "uzk";
	return "uzl";
}

function getContestReminderContent({
	isJoined,
	language,
	minutesBefore,
	title,
}: {
	isJoined: boolean;
	language?: string;
	minutesBefore: 30 | 5;
	title: string;
}) {
	const normalizedLanguage = getReminderLanguage(language);

	if (normalizedLanguage === "ru") {
		if (isJoined) {
			return {
				title: `${title}: осталось ${minutesBefore} мин.`,
				body:
					minutesBefore === 30
						? "Завершите подготовку и соберите фокус. Контест скоро начнется."
						: "До старта совсем немного. Сделайте глубокий вдох и покажите свой лучший результат.",
			};
		}

		return {
			title: `${title} начнется через ${minutesBefore} мин.`,
			body:
				minutesBefore === 30
					? "Зарегистрируйтесь сейчас, чтобы не пропустить начало теста."
					: "Тест скоро начнется. Успейте зарегистрироваться и зайти вовремя.",
		};
	}

	if (normalizedLanguage === "uzk") {
		if (isJoined) {
			return {
				title: `${title}: ${minutesBefore} дақиқа қолди`,
				body:
					minutesBefore === 30
						? "Тайёргарликни якунланг, диққатни жамланг. Contest тез орада бошланади."
						: "Стартга жуда оз қолди. Чуқур нафас олинг ва энг яхши натижангизни кўрсатинг.",
			};
		}

		return {
			title: `${title} ${minutesBefore} дақиқада бошланади`,
			body:
				minutesBefore === 30
					? "Тест бошланишини ўтказиб юбормаслик учун ҳозир рўйхатдан ўтинг."
					: "Тест тез орада бошланади. Рўйхатдан ўтиб, вақтида киришга улгуринг.",
		};
	}

	if (isJoined) {
		return {
			title: `${title}: ${minutesBefore} daqiqa qoldi`,
			body:
				minutesBefore === 30
					? "Tayyorgarlikni yakunlang, fokusni jamlang. Contest tez orada boshlanadi."
					: "Startga juda oz qoldi. Chuqur nafas oling va eng yaxshi natijangizni ko'rsating.",
		};
	}

	return {
		title: `${title} ${minutesBefore} daqiqada boshlanadi`,
		body:
			minutesBefore === 30
				? "Test boshlanishini o'tkazib yubormaslik uchun hozir ro'yxatdan o'ting."
				: "Test tez orada boshlanadi. Ro'yxatdan o'tib, vaqtida kirishga ulgurib qoling.",
	};
}

async function ensureContestNotificationPermissions(
	Notifications: ExpoNotifications,
) {
	const currentPermissions = await Notifications.getPermissionsAsync();
	let status = currentPermissions.status;

	if (status !== "granted") {
		const requestedPermissions = await Notifications.requestPermissionsAsync();
		status = requestedPermissions.status;
	}

	if (status !== "granted") return false;

	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(
			CONTEST_NOTIFICATION_CHANNEL_ID,
			{
				name: "Contest reminders",
				description: "Contest boshlanishidan oldingi eslatmalar",
				importance: Notifications.AndroidImportance.HIGH,
				sound: "default",
				vibrationPattern: [0, 250, 250, 250],
			},
		);
	}

	return true;
}

export async function scheduleContestReminderNotifications({
	contest,
	isJoined = false,
	language,
	title,
}: {
	contest?: Contest | null;
	isJoined?: boolean;
	language?: string;
	title: string;
}) {
	const startDate = getContestStartDate(contest);
	if (!startDate) return [];

	const Notifications = await getNotificationsModule();
	if (!Notifications) return [];

	const hasPermission = await ensureContestNotificationPermissions(Notifications);
	if (!hasPermission) return [];

	const now = Date.now();
	const contestId = String(contest?.id ?? title);
	const scheduledIds: string[] = [];

	for (const minutesBefore of REMINDER_OFFSETS) {
		const triggerDate = new Date(startDate.getTime() - minutesBefore * 60_000);
		if (triggerDate.getTime() <= now) continue;

		const identifier = `contest-${contestId}-${minutesBefore}m`;
		await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
		const content = getContestReminderContent({
			isJoined,
			language,
			minutesBefore,
			title,
		});

		const scheduledId = await Notifications.scheduleNotificationAsync({
			identifier,
			content: {
				title: content.title,
				body: content.body,
				data: {
					contestId,
					isJoined,
					minutesBefore,
					type: "contest-reminder",
				},
				sound: "default",
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: triggerDate,
				channelId: CONTEST_NOTIFICATION_CHANNEL_ID,
			},
		});

		scheduledIds.push(scheduledId);
	}

	return scheduledIds;
}
