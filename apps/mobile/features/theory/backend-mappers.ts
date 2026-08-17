import type { QuizCategory, QuizQuestion } from "@/features/quiz/api";
import { CATEGORY_TEST_TOKEN_COST, SECONDS_PER_QUESTION } from "./constants";
import type { TheoryOverview, TheoryTopic } from "./types";

export function toNumber(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.max(0, Math.floor(value));
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return Math.max(0, Math.floor(parsed));
		}
	}

	return 0;
}

export function pickString(...values: unknown[]) {
	return values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();
}

function slugify(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function getCategoryTitle(category: QuizCategory, languageKey: string) {
	const name = category.name;
	const localizedName =
		name && typeof name === "object" && !Array.isArray(name)
			? (name as Record<string, unknown>)
			: null;

	if (languageKey.startsWith("ru")) {
		return pickString(
			localizedName?.ru,
			category.name_ru,
			localizedName?.uzl,
			category.name_uzl,
			typeof name === "string" ? name : null,
			category.title,
		);
	}

	if (languageKey.includes("Cyrl")) {
		return pickString(
			localizedName?.uzk,
			category.name_uzk,
			localizedName?.uzl,
			category.name_uzl,
			typeof name === "string" ? name : null,
			category.title,
		);
	}

	return pickString(
		localizedName?.uzl,
		category.name_uzl,
		typeof name === "string" ? name : null,
		category.title,
		localizedName?.ru,
		category.name_ru,
	);
}

export function buildQuestionCountByCategory(questions: QuizQuestion[]) {
	const countByCategory = new Map<string, number>();

	for (const question of questions) {
		const categoryId = question.category ?? question.category_id;
		if (categoryId === null || categoryId === undefined) continue;

		const key = String(categoryId);
		countByCategory.set(key, (countByCategory.get(key) ?? 0) + 1);
	}

	return countByCategory;
}

export function getCategoryQuestionCount(
	category: QuizCategory,
	questionCountByCategory: Map<string, number>,
) {
	const countFromCategory = toNumber(
		category.total_questions ??
			category.questions_count ??
			category.question_count ??
			category.totalQuestions,
	);

	if (countFromCategory > 0) return countFromCategory;

	return questionCountByCategory.get(String(category.id)) ?? 0;
}

export function getCategorySlug(category: QuizCategory, fallbackTitle: string) {
	const id = String(category.id);
	return pickString(category.slug) ?? `section-${id || slugify(fallbackTitle)}`;
}

export function mapCategoryToTopic(
	category: QuizCategory,
	index: number,
	languageKey: string,
	questionCountByCategory: Map<string, number>,
): TheoryTopic {
	const id = String(category.id);
	const title = getCategoryTitle(category, languageKey) ?? `Bo'lim ${index + 1}`;
	const slug = getCategorySlug(category, title);
	const totalQuestions = getCategoryQuestionCount(category, questionCountByCategory);
	const timeLimitMinutes = toNumber(
		category.time_limit_minutes ?? category.time_limit,
	);
	const tokenCost =
		Math.max(1, Math.ceil(totalQuestions / 10)) * CATEGORY_TEST_TOKEN_COST;
	const seenQuestions = toNumber(category.viewed_count);
	const unviewedQuestions = toNumber(category.unviewed_count);
	const answeredQuestions = toNumber(category.answered_count);
	const correctCount = toNumber(category.correct_count);
	const incorrectCount = toNumber(category.wrong_count);
	const progressPercent = toNumber(category.progress_percent);

	return {
		id,
		slug,
		title,
		subtitle: pickString(category.description) ?? "",
		order: toNumber(category.order) || index + 1,
		imageKey: pickString(category.icon) ?? id,
		totalQuestions,
		timeLimitMinutes:
			timeLimitMinutes > 0
				? timeLimitMinutes
				: totalQuestions > 0
					? Math.ceil((totalQuestions * SECONDS_PER_QUESTION) / 60)
					: null,
		tokenCost,
		seenQuestions,
		answeredQuestions,
		correctCount,
		incorrectCount,
		completed: category.is_completed === true,
		progressPercent:
			progressPercent > 0
				? progressPercent
				: totalQuestions > 0
					? Math.round((seenQuestions / totalQuestions) * 100)
					: unviewedQuestions > 0
						? 0
						: 0,
	};
}

export function buildOverview(topics: TheoryTopic[]): TheoryOverview {
	const totalQuestions = topics.reduce((sum, topic) => sum + topic.totalQuestions, 0);
	const seenQuestions = topics.reduce((sum, topic) => sum + topic.seenQuestions, 0);

	return {
		summary: {
			totalTopics: topics.length,
			totalQuestions,
			seenQuestions,
			notSeenQuestions: Math.max(0, totalQuestions - seenQuestions),
			progressPercent:
				totalQuestions > 0 ? Math.round((seenQuestions / totalQuestions) * 100) : 0,
		},
		topics,
	};
}
