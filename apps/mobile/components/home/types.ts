import type React from "react";
import type { ImageSourcePropType } from "react-native";

import { Colors } from "@/constants/Colors";

export type HomePalette = (typeof Colors)["light"] | (typeof Colors)["dark"];

type MetricBase = {
	id: string;
	label: string;
	icon: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
};

export type RingMetricItem = MetricBase & {
	type: "ring";
	value: string;
	progress: number;
	targetLabel: string;
};

export type ScoreMetricItem = MetricBase & {
	type: "score";
	score: number;
	minTarget: number;
	minTargetLabel: string;
};

export type MetricItem = RingMetricItem | ScoreMetricItem;

export type TodayMetricStats = {
	solvedQuestions: number;
	accuracyPercent: number;
	activityMinutes: number;
};

export type WorkoutItem = {
	id: string;
	day: string;
	title: string;
	reps: string;
	duration: string;
	energy: string;
	image?: ImageSourcePropType;
	rightIcon?: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
};
