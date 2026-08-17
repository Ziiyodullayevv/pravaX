import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

import { axiosInstance, endpoints } from "@/lib/api";
import { tokenQueryKeys } from "@/features/tokens/api";

export type QuizCategory = {
	id: string | number;
	title?: string;
	name?: string | {
		uzl?: string;
		uzk?: string;
		ru?: string;
	};
	name_uzl?: string;
	name_uzk?: string;
	name_ru?: string;
	slug?: string;
	description?: string | null;
	icon?: string | null;
	image?: string | null;
	image_url?: string | null;
	order?: number;
	questions_count?: number;
	viewed_count?: number;
	unviewed_count?: number;
	answered_count?: number;
	correct_count?: number;
	wrong_count?: number;
	time_limit?: number | string | null;
	time_limit_minutes?: number | string | null;
	token_cost?: number | string | null;
	tokens_required?: number | string | null;
	required_tokens?: number | string | null;
	price?: number | string | null;
	cost?: number | string | null;
	progress_percent?: number;
	is_completed?: boolean;
	[key: string]: unknown;
};

export type QuizCategoriesStats = {
	sections_count?: number;
	questions_count?: number;
	viewed_count?: number;
	unviewed_count?: number;
	// Mode token costs (returned by backend alongside categories stats)
	mock_exam_token_cost?: number | string | null;
	test_token_cost?: number | string | null;
	exam_token_cost?: number | string | null;
	practice_token_cost?: number | string | null;
	random_token_cost?: number | string | null;
	marathon_token_cost?: number | string | null;
	[key: string]: unknown;
};

export type QuizModeCosts = {
	mockExam: number | null;
	practice: number | null;
	marathon: number | null;
};

function pickPositiveNumber(...values: unknown[]): number | null {
	for (const v of values) {
		if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
		if (typeof v === "string" && v.trim().length > 0) {
			const n = Number(v);
			if (Number.isFinite(n) && n > 0) return n;
		}
	}
	return null;
}

export function extractModeCosts(stats: QuizCategoriesStats): QuizModeCosts {
	return {
		mockExam: pickPositiveNumber(
			stats.mock_exam_token_cost,
			stats.test_token_cost,
			stats.exam_token_cost,
			stats.mock_exam_cost,
			stats.exam_cost,
		),
		practice: pickPositiveNumber(
			stats.practice_token_cost,
			stats.random_token_cost,
			stats.practice_cost,
			stats.random_cost,
		),
		marathon: pickPositiveNumber(
			stats.marathon_token_cost,
			stats.marathon_cost,
		),
	};
}

export type QuizCategoriesPayload = {
	stats: QuizCategoriesStats;
	sections: QuizCategory[];
};

export type QuizQuestion = {
	id: string | number;
	number?: number | null;
	category?: string | number | null;
	category_id?: string | number | null;
	category_name?: string | null;
	text_uzl?: string;
	text_uzk?: string;
	text_ru?: string;
	explanation_uzl?: string;
	explanation_uzk?: string;
	explanation_ru?: string;
	choices?: QuizChoice[];
	media?: unknown[];
	[key: string]: unknown;
};

export type QuizSessionMode =
	| "category"
	| "test"
	| "mock_exam"
	| "practice"
	| "marathon";
export type QuizSessionStatus = "in_progress" | "completed" | "abandoned";

export type QuizSession = {
	id: number;
	mode: QuizSessionMode;
	status: QuizSessionStatus;
	score: number;
	total_questions: number;
	time_limit_minutes: number | null;
	percentage: number;
	is_passed: boolean;
	category_id: number | null;
	category_name: string;
	started_at: string;
	finished_at: string | null;
};

export type QuizChoice = {
	id: number;
	text_uzl?: string;
	text_uzk?: string;
	text_ru?: string;
	order?: number;
	is_correct?: boolean;
	[key: string]: unknown;
};

export type QuizSessionQuestion = {
	id: number;
	order: number;
	is_correct: boolean | null;
	answered_at: string | null;
	selected_choice?: QuizChoice | null;
	correct_choice?: QuizChoice | null;
	question: QuizQuestion;
	[key: string]: unknown;
};

export type QuizSessionDetail = QuizSession & {
	session_questions: QuizSessionQuestion[];
};

export type QuizMistakeItem = {
	wrong_count: number;
	question: QuizQuestion;
	correct_choice: QuizChoice | null;
};

export type QuizSavedQuestion = {
	id: number;
	question: QuizQuestion;
	saved_at: string;
};

export type SaveQuestionInput = {
	questionId: number | string;
	question?: QuizQuestion | null;
};

export type QuizQuestionsPageParams = {
	categoryId?: number | string | null;
	difficulty?: "easy" | "medium" | "hard" | null;
	page?: number;
	pageSize?: number;
};

export type PaginatedQuizQuestions = {
	count: number;
	next: string | null;
	previous: string | null;
	results: QuizQuestion[];
};

export type PaginatedQuizMistakes = {
	count: number;
	next: string | null;
	previous: string | null;
	results: QuizMistakeItem[];
};

export type PaginatedQuizSavedQuestions = {
	count: number;
	next: string | null;
	previous: string | null;
	results: QuizSavedQuestion[];
};

export type StartQuizSessionInput = {
	categoryId: number | string;
};

export type StartQuizPracticeSessionInput = {
	count: 10 | 20 | 50 | 100 | 150;
	mode?: "practice" | "marathon";
};

export type SubmitQuizAnswerInput = {
	question_id: number;
	choice_id: number;
	correct_choice_id: number;
	status: boolean;
};

export type SubmitQuizSessionInput = {
	sessionId: number | string;
	answers: SubmitQuizAnswerInput[];
	finishedAt?: string;
};

const unwrapList = <T,>(payload: unknown): T[] => {
	if (Array.isArray(payload)) return payload as T[];

	if (payload && typeof payload === "object") {
		const record = payload as Record<string, unknown>;
		if (Array.isArray(record.data)) return record.data as T[];
		if (Array.isArray(record.results)) return record.results as T[];
		if (Array.isArray(record.sections)) return record.sections as T[];
	}

	return [];
};

const normalizeQuizCategoriesPayload = (payload: unknown): QuizCategoriesPayload => {
	if (Array.isArray(payload)) {
		return { sections: payload as QuizCategory[], stats: {} };
	}

	if (payload && typeof payload === "object") {
		const record = payload as Record<string, unknown>;
		const data = record.data;

		if (data && typeof data === "object" && !Array.isArray(data)) {
			return normalizeQuizCategoriesPayload(data);
		}

		const sections = Array.isArray(record.sections)
			? (record.sections as QuizCategory[])
			: Array.isArray(record.results)
				? (record.results as QuizCategory[])
				: [];
		const stats =
			record.stats && typeof record.stats === "object" && !Array.isArray(record.stats)
				? (record.stats as QuizCategoriesStats)
				: {};

		return { sections, stats };
	}

	return { sections: [], stats: {} };
};

const unwrapData = <T,>(payload: T | { data?: T }) => {
	if (
		payload &&
		typeof payload === "object" &&
		"data" in payload &&
		(payload as { data?: T }).data
	) {
		return (payload as { data: T }).data;
	}

	return payload as T;
};

const normalizePaginatedList = <T,>(payload: unknown) => {
	if (payload && typeof payload === "object" && !Array.isArray(payload)) {
		const record = payload as Record<string, unknown>;
		if (Array.isArray(record.results)) {
			return {
				count: typeof record.count === "number" ? record.count : record.results.length,
				next: typeof record.next === "string" ? record.next : null,
				previous: typeof record.previous === "string" ? record.previous : null,
				results: record.results as T[],
			};
		}
	}

	const results = unwrapList<T>(payload);
	return {
		count: results.length,
		next: null,
		previous: null,
		results,
	};
};

export const quizQueryKeys = {
	categories: ["quiz", "categories"] as const,
	mistakes: (categoryId?: string | number | null) =>
		["quiz", "mistakes", categoryId ? String(categoryId) : "all"] as const,
	mistakesInfinite: (categoryId?: string | number | null, pageSize = 20) =>
		[
			"quiz",
			"mistakes",
			"infinite",
			categoryId ? String(categoryId) : "all",
			String(pageSize),
		] as const,
	questions: ["quiz", "questions"] as const,
	question: (id: string | number) => ["quiz", "questions", String(id)] as const,
	questionsPage: (params: QuizQuestionsPageParams) =>
		[
			"quiz",
			"questions",
			"page",
			params.categoryId ? String(params.categoryId) : "all",
			params.difficulty ?? "all",
			String(params.page ?? 1),
			String(params.pageSize ?? 20),
		] as const,
	questionsInfinite: (params: QuizQuestionsPageParams) =>
		[
			"quiz",
			"questions",
			"infinite",
			params.categoryId ? String(params.categoryId) : "all",
			params.difficulty ?? "all",
			String(params.pageSize ?? 20),
		] as const,
	session: (id: string | number) => ["quiz", "sessions", String(id)] as const,
	sessions: ["quiz", "sessions"] as const,
	saved: ["quiz", "saved"] as const,
	savedInfinite: (pageSize = 20) =>
		["quiz", "saved", "infinite", String(pageSize)] as const,
};

export async function getQuizCategories() {
	const response = await axiosInstance.get(endpoints.quiz.categories);
	return normalizeQuizCategoriesPayload(response.data);
}

export async function getQuizCategorySections() {
	const payload = await getQuizCategories();
	return payload.sections;
}

export async function getQuizQuestions() {
	const response = await axiosInstance.get(endpoints.quiz.questions);
	return unwrapList<QuizQuestion>(response.data);
}

export async function getQuizQuestionsPage(
	params: QuizQuestionsPageParams = {},
): Promise<PaginatedQuizQuestions> {
	const response = await axiosInstance.get(endpoints.quiz.questions, {
		params: {
			...(params.categoryId ? { category: Number(params.categoryId) } : {}),
			...(params.difficulty ? { difficulty: params.difficulty } : {}),
			page: params.page ?? 1,
			page_size: params.pageSize ?? 20,
		},
	});

	if (response.data && typeof response.data === "object") {
		const record = response.data as Record<string, unknown>;
		if (Array.isArray(record.results)) {
			return {
				count: typeof record.count === "number" ? record.count : record.results.length,
				next: typeof record.next === "string" ? record.next : null,
				previous: typeof record.previous === "string" ? record.previous : null,
				results: record.results as QuizQuestion[],
			};
		}
	}

	const results = unwrapList<QuizQuestion>(response.data);
	return {
		count: results.length,
		next: null,
		previous: null,
		results,
	};
}

export async function getQuizQuestionDetail(id: string | number) {
	const response = await axiosInstance.get<QuizQuestion | { data: QuizQuestion }>(
		endpoints.quiz.questionDetail(id),
	);
	return unwrapData(response.data);
}

export async function getQuizMistakes(categoryId?: string | number | null) {
	const response = await axiosInstance.get(endpoints.quiz.mistakes, {
		params: categoryId ? { category: Number(categoryId) } : undefined,
	});
	return unwrapList<QuizMistakeItem>(response.data);
}

export async function getQuizMistakesPage({
	categoryId,
	page = 1,
	pageSize = 20,
}: {
	categoryId?: string | number | null;
	page?: number;
	pageSize?: number;
}): Promise<PaginatedQuizMistakes> {
	const response = await axiosInstance.get(endpoints.quiz.mistakes, {
		params: {
			...(categoryId ? { category: Number(categoryId) } : {}),
			page,
			page_size: pageSize,
		},
	});

	return normalizePaginatedList<QuizMistakeItem>(response.data);
}

export async function getQuizSavedQuestions() {
	const response = await axiosInstance.get(endpoints.quiz.saved);
	return unwrapList<QuizSavedQuestion>(response.data);
}

export async function getQuizSavedQuestionsPage({
	page = 1,
	pageSize = 20,
}: {
	page?: number;
	pageSize?: number;
} = {}): Promise<PaginatedQuizSavedQuestions> {
	const response = await axiosInstance.get(endpoints.quiz.saved, {
		params: { page, page_size: pageSize },
	});

	return normalizePaginatedList<QuizSavedQuestion>(response.data);
}

export async function saveQuizQuestion(input: SaveQuestionInput) {
	const response = await axiosInstance.post<
		QuizSavedQuestion | { data: QuizSavedQuestion }
	>(endpoints.quiz.saved, {
		question_id: Number(input.questionId),
	});
	return unwrapData(response.data);
}

export async function deleteQuizSavedQuestion(questionId: number | string) {
	await axiosInstance.delete(endpoints.quiz.savedDelete(questionId));
	return String(questionId);
}

export async function getQuizSessions() {
	const response = await axiosInstance.get(endpoints.quiz.sessions);
	return unwrapList<QuizSession>(response.data);
}

export async function startQuizSession(input: StartQuizSessionInput) {
	const payload = {
		category_id: Number(input.categoryId),
	};

	if (__DEV__) {
		console.info("[quiz] POST /api/quiz/sessions/", payload);
	}

	const response = await axiosInstance.post<QuizSessionDetail | { data: QuizSessionDetail }>(
		endpoints.quiz.sessions,
		payload,
	);
	const session = unwrapData(response.data);

	if (__DEV__) {
		console.info("[quiz] session started", {
			id: session.id,
			total_questions: session.total_questions,
			status: session.status,
		});
	}

	return session;
}

export async function startQuizTestSession() {
	if (__DEV__) {
		console.info("[quiz] POST /api/quiz/test/");
	}

	const response = await axiosInstance.post<
		QuizSessionDetail | { data: QuizSessionDetail }
	>(endpoints.quiz.test);
	const session = unwrapData(response.data);

	if (__DEV__) {
		console.info("[quiz] test session started", {
			id: session.id,
			total_questions: session.total_questions,
			time_limit_minutes: session.time_limit_minutes,
			status: session.status,
		});
	}

	return session;
}

export async function startQuizPracticeSession(
	input: StartQuizPracticeSessionInput,
) {
	if (__DEV__) {
		console.info("[quiz] POST /api/quiz/practice/", {
			count: input.count,
			mode: input.mode,
		});
	}

	const payload = {
		count: input.count,
		...(input.mode ? { mode: input.mode } : {}),
	};
	const response = await axiosInstance.post<
		QuizSessionDetail | { data: QuizSessionDetail }
	>(endpoints.quiz.practice, payload);
	const session = unwrapData(response.data);

	if (__DEV__) {
		console.info("[quiz] practice session started", {
			id: session.id,
			total_questions: session.total_questions,
			time_limit_minutes: session.time_limit_minutes,
			status: session.status,
		});
	}

	return session;
}

export async function getQuizSessionDetail(id: string | number) {
	const response = await axiosInstance.get<
		QuizSessionDetail | { data: QuizSessionDetail }
	>(endpoints.quiz.sessionDetail(id));
	return unwrapData(response.data);
}

export async function abandonQuizSession(id: string | number) {
	const response = await axiosInstance.post<QuizSession | { data: QuizSession }>(
		endpoints.quiz.sessionAbandon(id),
	);
	return unwrapData(response.data);
}

export async function submitQuizSession(input: SubmitQuizSessionInput) {
	const response = await axiosInstance.post<
		QuizSessionDetail | { data: QuizSessionDetail }
	>(endpoints.quiz.sessionSubmit(input.sessionId), {
		answers: input.answers,
		...(input.finishedAt ? { finished_at: input.finishedAt } : {}),
	});
	return unwrapData(response.data);
}

export function useQuizCategoriesQuery(enabled = true) {
	return useQuery({
		queryKey: quizQueryKeys.categories,
		queryFn: getQuizCategorySections,
		enabled,
	});
}

export function useQuizCategoriesPayloadQuery(enabled = true) {
	return useQuery({
		queryKey: [...quizQueryKeys.categories, "payload"] as const,
		queryFn: getQuizCategories,
		enabled,
	});
}

export function useQuizModeCostsQuery(enabled = true) {
	return useQuery({
		queryKey: [...quizQueryKeys.categories, "mode-costs"] as const,
		queryFn: async () => {
			const payload = await getQuizCategories();
			return extractModeCosts(payload.stats);
		},
		enabled,
		staleTime: 5 * 60_000,
	});
}

export function useQuizQuestionsQuery(enabled = true) {
	return useQuery({
		queryKey: quizQueryKeys.questions,
		queryFn: getQuizQuestions,
		enabled,
	});
}

export function useQuizQuestionsPageQuery(
	params: QuizQuestionsPageParams,
	enabled = true,
) {
	return useQuery({
		queryKey: quizQueryKeys.questionsPage(params),
		queryFn: () => getQuizQuestionsPage(params),
		enabled,
	});
}

export function useQuizQuestionsInfiniteQuery(
	params: Omit<QuizQuestionsPageParams, "page">,
	enabled = true,
) {
	return useInfiniteQuery({
		queryKey: quizQueryKeys.questionsInfinite(params),
		queryFn: ({ pageParam }) =>
			getQuizQuestionsPage({
				...params,
				page: pageParam,
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage.next) return undefined;
			return allPages.length + 1;
		},
		enabled,
	});
}

export function useQuizQuestionDetailQuery(
	id?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: quizQueryKeys.question(id ?? ""),
		queryFn: () => getQuizQuestionDetail(id as string | number),
		enabled: enabled && id !== null && id !== undefined && String(id).length > 0,
	});
}

export function useQuizMistakesQuery(
	categoryId?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: quizQueryKeys.mistakes(categoryId),
		queryFn: () => getQuizMistakes(categoryId),
		enabled,
	});
}

export function useQuizMistakesInfiniteQuery(
	categoryId?: string | number | null,
	enabled = true,
	pageSize = 20,
) {
	return useInfiniteQuery({
		queryKey: quizQueryKeys.mistakesInfinite(categoryId, pageSize),
		queryFn: ({ pageParam }) =>
			getQuizMistakesPage({ categoryId, page: pageParam, pageSize }),
		initialPageParam: 1,
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage.next) return undefined;
			return allPages.length + 1;
		},
		enabled,
	});
}

export function useQuizSavedQuestionsQuery(enabled = true) {
	return useQuery({
		queryKey: quizQueryKeys.saved,
		queryFn: getQuizSavedQuestions,
		enabled,
	});
}

export function useQuizSavedQuestionsInfiniteQuery(enabled = true, pageSize = 20) {
	return useInfiniteQuery({
		queryKey: quizQueryKeys.savedInfinite(pageSize),
		queryFn: ({ pageParam }) =>
			getQuizSavedQuestionsPage({ page: pageParam, pageSize }),
		initialPageParam: 1,
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage.next) return undefined;
			return allPages.length + 1;
		},
		enabled,
	});
}

export function useQuizSessionsQuery(enabled = true) {
	return useQuery({
		queryKey: quizQueryKeys.sessions,
		queryFn: getQuizSessions,
		enabled,
	});
}

export function useQuizSessionDetailQuery(
	id?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: quizQueryKeys.session(id ?? ""),
		queryFn: () => getQuizSessionDetail(id as string | number),
		enabled: enabled && id !== null && id !== undefined && String(id).length > 0,
	});
}

export function useStartQuizSessionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: startQuizSession,
		onSuccess: (session) => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.sessions });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.balance });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.history });
			queryClient.setQueryData(quizQueryKeys.session(session.id), session);
		},
	});
}

export function useStartQuizTestSessionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: startQuizTestSession,
		onSuccess: (session) => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.sessions });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.balance });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.history });
			queryClient.setQueryData(quizQueryKeys.session(session.id), session);
		},
	});
}

export function useStartQuizPracticeSessionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: startQuizPracticeSession,
		onSuccess: (session) => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.sessions });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.balance });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.history });
			queryClient.setQueryData(quizQueryKeys.session(session.id), session);
		},
	});
}

export function useSaveQuizQuestionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: saveQuizQuestion,
		onMutate: async (input) => {
			await queryClient.cancelQueries({ queryKey: quizQueryKeys.saved });
			const previousSaved =
				queryClient.getQueryData<QuizSavedQuestion[]>(quizQueryKeys.saved) ?? [];
			const questionId = String(input.questionId);

			if (!previousSaved.some((item) => String(item.question.id) === questionId)) {
				const optimisticQuestion: QuizQuestion =
					input.question ?? {
						id: input.questionId,
						text_uzl: "",
					};

				queryClient.setQueryData<QuizSavedQuestion[]>(quizQueryKeys.saved, [
					{
						id: -Date.now(),
						question: optimisticQuestion,
						saved_at: new Date().toISOString(),
					},
					...previousSaved,
				]);
			}

			return { previousSaved };
		},
		onError: (_error, _input, context) => {
			if (context?.previousSaved) {
				queryClient.setQueryData(quizQueryKeys.saved, context.previousSaved);
			}
		},
		onSuccess: (savedQuestion) => {
			queryClient.setQueryData<QuizSavedQuestion[]>(quizQueryKeys.saved, (current) => {
				const previous = current ?? [];
				const withoutDuplicate = previous.filter(
					(item) => String(item.question.id) !== String(savedQuestion.question.id),
				);
				return [savedQuestion, ...withoutDuplicate];
			});
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.saved });
		},
	});
}

export function useDeleteQuizSavedQuestionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteQuizSavedQuestion,
		onMutate: async (questionId) => {
			await queryClient.cancelQueries({ queryKey: quizQueryKeys.saved });
			const previousSaved =
				queryClient.getQueryData<QuizSavedQuestion[]>(quizQueryKeys.saved) ?? [];
			const normalizedQuestionId = String(questionId);

			queryClient.setQueryData<QuizSavedQuestion[]>(
				quizQueryKeys.saved,
				previousSaved.filter(
					(item) => String(item.question.id) !== normalizedQuestionId,
				),
			);

			return { previousSaved };
		},
		onError: (_error, _input, context) => {
			if (context?.previousSaved) {
				queryClient.setQueryData(quizQueryKeys.saved, context.previousSaved);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.saved });
		},
	});
}

export function useAbandonQuizSessionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: abandonQuizSession,
		onSuccess: (session) => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.sessions });
			queryClient.setQueryData(quizQueryKeys.session(session.id), session);
		},
	});
}

export function useSubmitQuizSessionMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: submitQuizSession,
		onSuccess: (session) => {
			queryClient.invalidateQueries({ queryKey: quizQueryKeys.sessions });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.balance });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.history });
			queryClient.setQueryData(quizQueryKeys.session(session.id), session);
		},
	});
}
