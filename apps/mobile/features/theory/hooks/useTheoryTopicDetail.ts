import { useCallback, useMemo } from "react";

import { mapCategoryToTopic } from "../backend-mappers";
import type { TheoryTopicDetail } from "../types";
import { useQuizCategoriesQuery } from "@/features/quiz/api";

export function useTheoryTopicDetail(
	userId?: string | null,
	slug?: string | null,
	language?: string | null,
	enabled: boolean = true,
) {
	const normalizedSlug = (slug ?? "").trim();
	const languageKey = (language ?? "uz-Latn").trim() || "uz-Latn";
	const queryEnabled = enabled && Boolean(userId && normalizedSlug);
	const categoriesQuery = useQuizCategoriesQuery(queryEnabled);

	const detail = useMemo<TheoryTopicDetail | null>(() => {
		if (!normalizedSlug) return null;

		const categories = categoriesQuery.data ?? [];
		const questionCountByCategory = new Map<string, number>();
		const topics = categories.map((category, index) =>
			mapCategoryToTopic(category, index, languageKey, questionCountByCategory),
		);
		const topic = topics.find(
			(item) => item.slug === normalizedSlug || item.id === normalizedSlug,
		);

		return topic ? { topic } : null;
	}, [categoriesQuery.data, languageKey, normalizedSlug]);

	const isInitialLoading =
		categoriesQuery.isLoading ||
		(!detail && categoriesQuery.isFetching);
	const queryError = categoriesQuery.error;
	const error =
		queryError instanceof Error
			? queryError.message
			: queryError
				? "Bo'lim ma'lumotini yuklashda xatolik yuz berdi."
				: !isInitialLoading && normalizedSlug && !detail
					? "Bo'lim topilmadi."
					: "";

	const reload = useCallback(async () => {
		await categoriesQuery.refetch();
	}, [categoriesQuery.refetch]);

	return { detail, isLoading: isInitialLoading, error, reload };
}
