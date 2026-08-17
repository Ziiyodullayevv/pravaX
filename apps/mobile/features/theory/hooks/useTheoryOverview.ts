import { useMemo } from "react";

import type { TheoryOverview } from "../types";
import {
	buildOverview,
	mapCategoryToTopic,
	toNumber,
} from "../backend-mappers";
import { useQuizCategoriesPayloadQuery } from "@/features/quiz/api";

const EMPTY_OVERVIEW: TheoryOverview = {
	summary: {
		totalTopics: 0,
		totalQuestions: 0,
		seenQuestions: 0,
		notSeenQuestions: 0,
		progressPercent: 0,
	},
	topics: [],
};

export function useTheoryOverview(
	userId?: string | null,
	language?: string | null,
	enabled: boolean = true,
) {
	const languageKey = (language ?? "uz-Latn").trim() || "uz-Latn";
	const categoriesQuery = useQuizCategoriesPayloadQuery(enabled && Boolean(userId));

	const overview = useMemo<TheoryOverview>(() => {
		const categories = categoriesQuery.data?.sections ?? [];
		if (categories.length === 0) return EMPTY_OVERVIEW;
		const questionCountByCategory = new Map<string, number>();

		const topics = categories
			.map((category, index) =>
				mapCategoryToTopic(category, index, languageKey, questionCountByCategory),
			)
			.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

		const builtOverview = buildOverview(topics);
		const stats = categoriesQuery.data?.stats;
		if (!stats) return builtOverview;

		const totalTopics = toNumber(stats.sections_count);
		const totalQuestions = toNumber(stats.questions_count);
		const seenQuestions = toNumber(stats.viewed_count);
		const notSeenQuestions = toNumber(stats.unviewed_count);

		return {
			...builtOverview,
			summary: {
				totalTopics: totalTopics || builtOverview.summary.totalTopics,
				totalQuestions: totalQuestions || builtOverview.summary.totalQuestions,
				seenQuestions,
				notSeenQuestions:
					notSeenQuestions ||
					Math.max(0, (totalQuestions || builtOverview.summary.totalQuestions) - seenQuestions),
				progressPercent:
					totalQuestions > 0
						? Math.round((seenQuestions / totalQuestions) * 100)
						: builtOverview.summary.progressPercent,
			},
		};
	}, [categoriesQuery.data, languageKey]);

	const error =
		categoriesQuery.error instanceof Error
			? categoriesQuery.error.message
			: categoriesQuery.error
				? "Bo'limlarni yuklashda xatolik yuz berdi."
				: "";

	const reload = async () => {
		await categoriesQuery.refetch();
	};

	return {
		overview,
		summary: overview.summary,
		topics: overview.topics,
		isLoading:
			categoriesQuery.isLoading ||
			categoriesQuery.isFetching,
		error,
		reload,
	};
}
