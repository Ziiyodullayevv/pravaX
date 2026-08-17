import { CircleHelp, Clock3, Zap } from "lucide-react-native";

import {
	DEFAULT_DAILY_PLAN_GOALS,
	normalizeDailyPlanGoals,
	type DailyPlanGoals,
} from "@/features/daily-plan/goals";

import type { MetricItem, TodayMetricStats, WorkoutItem } from "./types";

export const DAILY_QUESTION_TARGET = DEFAULT_DAILY_PLAN_GOALS.questionGoal;
export const DAILY_ACCURACY_MIN_TARGET = DEFAULT_DAILY_PLAN_GOALS.accuracyGoal;
export const DAILY_TIME_TARGET_MINUTES =
	DEFAULT_DAILY_PLAN_GOALS.activeMinutesGoal;
const DEFAULT_THEORY_CARD_QUESTION_COUNT = 20;
type Translate = (key: string, fallback?: string) => string;
type BuildWorkoutsOptions = {
	theoryQuestionCount?: number | null;
};

function formatMinutes(minutes: number, t: Translate) {
	const hour = Math.floor(minutes / 60);
	const minute = minutes % 60;
	return `${hour}${t("home.metric.unit.hourShort", "h")} ${minute}${t("home.metric.unit.minuteShort", "m")}`;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function lowercaseFirst(value: string) {
	return value.length > 0 ? `${value[0].toLocaleLowerCase()}${value.slice(1)}` : value;
}

export function buildMetrics(
	stats: TodayMetricStats,
	t: Translate,
	goals?: Partial<DailyPlanGoals>,
): MetricItem[] {
	const planGoals = normalizeDailyPlanGoals(goals);
	const solvedQuestions = Math.max(0, Math.floor(stats.solvedQuestions));
	const accuracyPercent = clamp(Math.round(stats.accuracyPercent), 0, 100);
	const activityMinutes = Math.max(0, Math.round(stats.activityMinutes));
	const questionTarget = Math.max(1, planGoals.questionGoal);
	const accuracyTarget = clamp(planGoals.accuracyGoal, 1, 100);
	const timeTarget = Math.max(1, planGoals.activeMinutesGoal);
	const questionUnit = t("home.metric.unit.questionShort", "ta");
	const targetPrefix = t("home.metric.targetPrefix", "target");
	const minuteUnit = t("home.metric.unit.minuteLabel", "min");

	return [
		{
			id: "questions",
			type: "ring",
			value: `${solvedQuestions} ${questionUnit}`,
			label: lowercaseFirst(t("practice.completedShort", "yechilgan")),
			progress: (solvedQuestions / questionTarget) * 100,
			targetLabel: `${targetPrefix}: ${questionTarget} ${questionUnit}`,
			icon: CircleHelp,
		},
		{
			id: "accuracy",
			type: "score",
			score: accuracyPercent,
			minTarget: accuracyTarget,
			minTargetLabel: `${t("home.metric.minimumPrefix", "minimum")}: ${accuracyTarget}%`,
			label: t("home.metric.accuracy.label", "accuracy"),
			icon: Zap,
		},
		{
			id: "activity",
			type: "ring",
			value: formatMinutes(activityMinutes, t),
			label: t("home.metric.activity.label", "activity"),
			progress: (activityMinutes / timeTarget) * 100,
			targetLabel: `${targetPrefix}: ${timeTarget} ${minuteUnit}`,
			icon: Clock3,
		},
	];
}

export function buildWorkouts(t: Translate, options?: BuildWorkoutsOptions): WorkoutItem[] {
	const normalizedTheoryQuestionCount =
		typeof options?.theoryQuestionCount === "number" &&
		Number.isFinite(options.theoryQuestionCount) &&
		options.theoryQuestionCount > 0
			? Math.floor(options.theoryQuestionCount)
			: null;
	const effectiveTheoryQuestionCount =
		normalizedTheoryQuestionCount ?? DEFAULT_THEORY_CARD_QUESTION_COUNT;
	const theoryQuestionsLabel =
		`${effectiveTheoryQuestionCount} ${t("common.questionsWord", "savol")}`;
	const theoryDurationLabel = `${effectiveTheoryQuestionCount} ${t("home.metric.unit.minuteLabel", "min")}`;

	return [
		{
			id: "nazariya-kuni",
			day: t("home.workout.card1.day", "Bugun"),
			title: t("home.workout.card1.title", "Nazariya mashg'uloti"),
			reps: theoryQuestionsLabel,
			duration: theoryDurationLabel,
			energy: t("home.workout.card1.badge.target", "80% maqsad"),
			image: require("../../assets/images/practice/books-ilustration.webp"),
		},
		{
			id: "mock-imtihon",
			day: t("home.workout.card2.day", "Imtihon rejimi"),
			title: t("home.workout.card2.title", "Mock test - Real format"),
			reps: t("home.workout.card2.badge.questions", "20 savol"),
			duration: t("home.workout.card2.badge.duration", "20 min"),
			energy: t("home.workout.card2.badge.target", "90% o'tish"),
			image: require("../../assets/images/practice/certificate.png"),
		},
		{
			id: "marafon",
			day: t("home.workout.card3.day", "Pro daraja"),
			title: t("home.workout.card3.title", "Marafon - 50 savol"),
			reps: t("home.workout.card3.badge.questions", "50 savol"),
			duration: t("home.workout.card3.badge.duration", "60 min"),
			energy: t("home.workout.card3.badge.target", "85% natija"),
			image: require("../../assets/images/practice/medal.webp"),
		},
	];
}

export const WORKOUT_CARD_GRADIENTS: [string, string][] = [
	["#3E9C9A", "#1FCBBE"],
	["#D67D57", "#C16E90"],
	["#3A5FD9", "#24A4E6"],
];

export const METRIC_RING_COLOR = "#F6B81D";
