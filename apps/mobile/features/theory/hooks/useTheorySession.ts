import { useMemo } from "react";

import { DEFAULT_TEST_SETTINGS } from "../constants";
import type {
	SessionQuestion,
	SessionQuestionOption,
	TestMode,
	TheorySession,
} from "../types";
import {
	useQuizSessionDetailQuery,
	type QuizChoice,
	type QuizSessionDetail,
	type QuizSessionQuestion,
} from "@/features/quiz/api";

function pickString(...values: unknown[]) {
	return values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();
}

function getLocalizedText(
	source: Record<string, unknown> | undefined | null,
	baseKey: string,
	languageKey: string,
) {
	if (!source) return "";
	if (languageKey.startsWith("ru")) {
		return pickString(source[`${baseKey}_ru`], source[`${baseKey}_uzl`]);
	}

	if (languageKey.includes("Cyrl")) {
		return pickString(source[`${baseKey}_uzk`], source[`${baseKey}_uzl`]);
	}

	return pickString(source[`${baseKey}_uzl`], source[`${baseKey}_ru`]);
}

function getQuestionImageUrl(question: Record<string, unknown>) {
	const media = Array.isArray(question.media) ? question.media : [];
	const image = media.find((item) => {
		if (!item || typeof item !== "object") return false;
		const record = item as Record<string, unknown>;
		return record.media_type === "image" && typeof record.file === "string";
	}) as Record<string, unknown> | undefined;

	return typeof image?.file === "string" ? image.file : null;
}

function mapChoiceToOption(
	choice: QuizChoice,
	index: number,
	languageKey: string,
	correctChoiceId?: number | null,
): SessionQuestionOption {
	const id = String(choice.id);

	return {
		id,
		label: String.fromCharCode(65 + index),
		text: getLocalizedText(choice, "text", languageKey) || `Variant ${index + 1}`,
		isCorrect:
			typeof choice.is_correct === "boolean"
				? choice.is_correct
				: correctChoiceId !== null && correctChoiceId !== undefined
					? choice.id === correctChoiceId
					: false,
		order: typeof choice.order === "number" ? choice.order : index + 1,
	};
}

function mapSessionQuestion(
	item: QuizSessionQuestion,
	index: number,
	languageKey: string,
): SessionQuestion {
	const question = (item.question ?? {}) as Record<string, unknown>;
	const choices = Array.isArray(question.choices)
		? (question.choices as QuizChoice[])
		: [];
	const correctChoiceId =
		typeof item.correct_choice?.id === "number" ? item.correct_choice.id : null;
	const options = choices
		.map((choice, choiceIndex) =>
			mapChoiceToOption(choice, choiceIndex, languageKey, correctChoiceId),
		)
		.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
	const selectedChoiceId =
		typeof item.selected_choice?.id === "number"
			? String(item.selected_choice.id)
			: null;

	return {
		sessionQuestionId: String(item.id),
		questionId: String(question.id ?? item.id),
		position: typeof item.order === "number" ? item.order : index + 1,
		prompt:
			getLocalizedText(question, "text", languageKey) ||
			`Savol ${index + 1}`,
		imageUrl: getQuestionImageUrl(question),
		explanation: getLocalizedText(question, "explanation", languageKey) || null,
		options,
		selectedOptionId: selectedChoiceId,
		isCorrect: item.is_correct,
		answeredAt: item.answered_at,
	};
}

function mapMode(mode: QuizSessionDetail["mode"]): TestMode {
	if (mode === "test" || mode === "mock_exam") return "mock_exam";
	if (mode === "marathon") return "marathon";
	return "topic_practice";
}

function mapBackendSessionToTheorySession(
	session: QuizSessionDetail,
	userId: string,
	languageKey: string,
): TheorySession {
	const questions = (session.session_questions ?? [])
		.slice()
		.sort((a, b) => a.order - b.order || a.id - b.id)
		.map((item, index) => mapSessionQuestion(item, index, languageKey));

	return {
		id: String(session.id),
		userId,
		topicId:
			session.category_id === null || session.category_id === undefined
				? null
				: String(session.category_id),
		topicSlug:
			session.category_id === null || session.category_id === undefined
				? null
				: `section-${session.category_id}`,
		topicTitle: session.category_name || null,
		mode: mapMode(session.mode),
		totalQuestions: session.total_questions || questions.length,
		timeLimitMinutes: session.time_limit_minutes,
		settings: DEFAULT_TEST_SETTINGS,
		startedAt: session.started_at,
		finishedAt: session.finished_at,
		scoreCorrect: session.score,
		scoreIncorrect: questions.filter((item) => item.isCorrect === false).length,
		questions,
		percentage: session.percentage,
		isPassed: session.is_passed,
	};
}

export function useTheorySession(
	userId?: string | null,
	sessionId?: string | null,
	language?: string | null,
) {
	const normalizedSessionId = (sessionId ?? "").trim();
	const languageKey = (language ?? "uz-Latn").trim() || "uz-Latn";
	const sessionQuery = useQuizSessionDetailQuery(
		normalizedSessionId,
		Boolean(userId && normalizedSessionId),
	);

	const session = useMemo(() => {
		if (!sessionQuery.data || !userId) return null;
		return mapBackendSessionToTheorySession(sessionQuery.data, userId, languageKey);
	}, [languageKey, sessionQuery.data, userId]);

	const error =
		sessionQuery.error instanceof Error
			? sessionQuery.error.message
			: sessionQuery.error
				? "Test ma'lumotini yuklashda xatolik yuz berdi."
				: "";

	const reload = async () => {
		await sessionQuery.refetch();
	};

	return {
		session,
		isLoading: sessionQuery.isLoading || sessionQuery.isFetching,
		error,
		reload,
	};
}
