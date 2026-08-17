import type { QuizSession } from "@/features/quiz/api";

import type { TodayMetricStats } from "./types";

export const EMPTY_TODAY_METRIC_STATS: TodayMetricStats = {
	solvedQuestions: 0,
	accuracyPercent: 0,
	activityMinutes: 0,
};

const DEFAULT_ANSWER_TIME_MS = 45_000;
const MAX_ACTIVE_GAP_MS = 2 * 60_000;

function parseTimestamp(value: string | null | undefined) {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function getDayBounds(now: Date) {
	const dayStart = new Date(now);
	dayStart.setHours(0, 0, 0, 0);

	const dayEnd = new Date(dayStart);
	dayEnd.setDate(dayEnd.getDate() + 1);

	return {
		dayStartMs: dayStart.getTime(),
		dayEndMs: dayEnd.getTime(),
	};
}

function isInToday(timestamp: number, dayStartMs: number, dayEndMs: number) {
	return timestamp >= dayStartMs && timestamp < dayEndMs;
}

export function getTodayMetricStatsFromSessions(
	sessions: QuizSession[],
	now: Date = new Date(),
): TodayMetricStats {
	if (sessions.length === 0) {
		return { ...EMPTY_TODAY_METRIC_STATS };
	}

	const { dayStartMs, dayEndMs } = getDayBounds(now);
	let solvedQuestions = 0;
	let correctAnswers = 0;
	let activityDurationMs = 0;

	for (const session of sessions) {
		const finishedAtMs = parseTimestamp(session.finished_at);
		if (!isInToday(finishedAtMs, dayStartMs, dayEndMs)) continue;

		solvedQuestions += Math.max(0, session.total_questions);
		correctAnswers += Math.max(0, session.score);

		const startedAtMs = parseTimestamp(session.started_at);
		const durationMs = finishedAtMs - startedAtMs;
		if (durationMs > 0) {
			activityDurationMs += Math.min(durationMs, MAX_ACTIVE_GAP_MS * 10);
		} else if (session.total_questions > 0) {
			activityDurationMs += session.total_questions * DEFAULT_ANSWER_TIME_MS;
		}
	}

	const accuracyPercent =
		solvedQuestions > 0 ? Math.round((correctAnswers / solvedQuestions) * 100) : 0;
	const activityMinutes = Math.max(0, Math.round(activityDurationMs / 60000));

	return {
		solvedQuestions,
		accuracyPercent,
		activityMinutes,
	};
}
