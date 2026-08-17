import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DailyPlanGoals = {
	questionGoal: number;
	accuracyGoal: number;
	activeMinutesGoal: number;
};

export const DEFAULT_DAILY_PLAN_GOALS: DailyPlanGoals = {
	questionGoal: 80,
	accuracyGoal: 85,
	activeMinutesGoal: 60,
};

const DAILY_PLAN_GOALS_STORAGE_KEY = "daily-plan:goals:v1";

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
	const numberValue =
		typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

	if (!Number.isFinite(numberValue)) return fallback;

	return Math.min(max, Math.max(min, Math.round(numberValue)));
}

export function normalizeDailyPlanGoals(
	value: Partial<DailyPlanGoals> | null | undefined,
): DailyPlanGoals {
	return {
		questionGoal: clampInteger(
			value?.questionGoal,
			1,
			500,
			DEFAULT_DAILY_PLAN_GOALS.questionGoal,
		),
		accuracyGoal: clampInteger(
			value?.accuracyGoal,
			1,
			100,
			DEFAULT_DAILY_PLAN_GOALS.accuracyGoal,
		),
		activeMinutesGoal: clampInteger(
			value?.activeMinutesGoal,
			1,
			24 * 60,
			DEFAULT_DAILY_PLAN_GOALS.activeMinutesGoal,
		),
	};
}

export async function getDailyPlanGoals() {
	try {
		const storedValue = await AsyncStorage.getItem(DAILY_PLAN_GOALS_STORAGE_KEY);
		if (!storedValue) return DEFAULT_DAILY_PLAN_GOALS;

		const parsed = JSON.parse(storedValue) as Partial<DailyPlanGoals>;
		return normalizeDailyPlanGoals(parsed);
	} catch {
		return DEFAULT_DAILY_PLAN_GOALS;
	}
}

export async function saveDailyPlanGoals(goals: DailyPlanGoals) {
	const normalizedGoals = normalizeDailyPlanGoals(goals);

	await AsyncStorage.setItem(
		DAILY_PLAN_GOALS_STORAGE_KEY,
		JSON.stringify({
			...normalizedGoals,
			updatedAt: new Date().toISOString(),
		}),
	);

	return normalizedGoals;
}

export function useDailyPlanGoals() {
	const [goals, setGoals] = useState<DailyPlanGoals>(DEFAULT_DAILY_PLAN_GOALS);
	const [isReady, setIsReady] = useState(false);

	const reload = useCallback(async () => {
		const nextGoals = await getDailyPlanGoals();
		setGoals(nextGoals);
		return nextGoals;
	}, []);

	useEffect(() => {
		let isMounted = true;

		(async () => {
			try {
				const nextGoals = await getDailyPlanGoals();
				if (isMounted) setGoals(nextGoals);
			} finally {
				if (isMounted) setIsReady(true);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, []);

	const save = useCallback(async (nextGoals: DailyPlanGoals) => {
		const normalizedGoals = await saveDailyPlanGoals(nextGoals);
		setGoals(normalizedGoals);
		return normalizedGoals;
	}, []);

	return {
		goals,
		isReady,
		reload,
		save,
	};
}
