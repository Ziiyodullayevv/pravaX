import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { axiosInstance, endpoints } from "@/lib/api";
import { tokenQueryKeys } from "@/features/tokens/api";
import type { QuizChoice, QuizQuestion } from "@/features/quiz/api";

export type ContestStatus =
	| "upcoming"
	| "active"
	| "live"
	| "in_progress"
	| "finished"
	| "completed"
	| string;

export type Contest = {
	id: number | string;
	title?: string;
	name?: string;
	description?: string | null;
	contest_type?: string | null;
	recurrence?: "none" | "daily" | "weekly" | string | null;
	scope?: string | null;
	type?: string | null;
	kind?: string | null;
	is_global?: boolean;
	access_key?: string | null;
	academy_key?: string | null;
	entry_token?: number | string | null;
	token_cost?: number | string | null;
	tokens_required?: number | string | null;
	required_tokens?: number | string | null;
	started_at?: string | null;
	starts_at?: string | null;
	start_time?: string | null;
	end_time?: string | null;
	ended_at?: string | null;
	ends_at?: string | null;
	image?: string | null;
	image_url?: string | null;
	banner?: string | null;
	banner_url?: string | null;
	status?: ContestStatus;
	participants_count?: number;
	question_count?: number;
	questions_count?: number;
	total_questions?: number;
	time_limit?: number;
	time_limit_minutes?: number;
	time_remaining?: string | null;
	is_joined?: boolean | string | null;
	[key: string]: unknown;
};

export type MyContest = {
	contest?: Contest;
	contest_id?: number | string;
	correct_count?: number;
	wrong_count?: number;
	rank?: number;
	is_submitted?: boolean;
	joined_at?: string | null;
	[key: string]: unknown;
};

export type ContestQuestion = QuizQuestion & {
	choices?: QuizChoice[];
};

export type ContestRankingEntry = {
	id?: number | string;
	rank?: number;
	place?: number;
	user?: {
		id?: number | string;
		first_name?: string | null;
		last_name?: string | null;
		username?: string | null;
		phone_number?: string | null;
		photo_url?: string | null;
		avatar_url?: string | null;
		profile_photo_url?: string | null;
		[key: string]: unknown;
	} | null;
	user_id?: number | string;
	first_name?: string | null;
	last_name?: string | null;
	username?: string | null;
	display_name?: string | null;
	full_name?: string | null;
	photo_url?: string | null;
	avatar_url?: string | null;
	profile_photo_url?: string | null;
	score?: number;
	rating?: number;
	points?: number;
	correct_count?: number;
	wrong_count?: number;
	duration_secs?: number;
	finished_at?: string | null;
	attended?: number;
	attended_count?: number;
	contests_count?: number;
	[key: string]: unknown;
};

export type ContestSubmitAnswer = {
	question_id: number | string;
	choice_id?: number | string | null;
	selected_choice_id?: number | string | null;
	answer?: unknown;
	[key: string]: unknown;
};

export type SubmitContestInput = {
	contestId: number | string;
	answers: ContestSubmitAnswer[];
	finishedAt?: string;
};

export type JoinContestInput = {
	contestId: number | string;
};

export type Academy = {
	id: number;
	name: string;
	is_member?: string | boolean | null;
	contests?: string | number | null;
	[key: string]: unknown;
};

export type JoinAcademyInput = {
	inviteCode: string;
};

export type ContestListParams = {
	status?: "active" | "finished" | "upcoming";
	type?: "academy" | "global";
};

export type ContestSubmitResult = {
	id?: number | string;
	score?: number;
	percentage?: number;
	is_passed?: boolean;
	status?: string;
	[key: string]: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

const unwrapList = <T,>(payload: unknown): T[] => {
	if (Array.isArray(payload)) return payload as T[];

	const record = asRecord(payload);
	if (record) {
		const listKeys = [
			"data",
			"results",
			"contests",
			"questions",
			"contest_questions",
			"session_questions",
			"ranking",
			"rankings",
			"leaderboard",
			"items",
		];

		for (const key of listKeys) {
			if (Array.isArray(record[key])) return record[key] as T[];
		}

		const data = asRecord(record.data);
		if (data) {
			for (const key of listKeys) {
				if (Array.isArray(data[key])) return data[key] as T[];
			}
		}
	}

	return [];
};

const unwrapData = <T,>(payload: T | { data?: T } | { result?: T }) => {
	if (payload && typeof payload === "object") {
		const record = payload as { data?: T; result?: T };

		if (record.data) return record.data;
		if (record.result) return record.result;
	}

	return payload as T;
};

const getMyContestId = (item: MyContest) => {
	const record = asRecord(item);
	const nestedContest = asRecord(record?.contest);
	const value = record?.contest_id ?? nestedContest?.id ?? record?.id;

	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value === "string" && value.trim().length > 0) return value.trim();

	return "";
};

export const contestQueryKeys = {
	all: ["contests"] as const,
	details: (id: string | number) => ["contests", "details", String(id)] as const,
	listRoot: ["contests", "list"] as const,
	list: (params: ContestListParams = {}) =>
		[
			"contests",
			"list",
			params.type ?? "all",
			params.status ?? "all",
		] as const,
	my: ["contests", "my"] as const,
	questions: (id: string | number) =>
		["contests", "questions", String(id)] as const,
	ranking: (id: string | number) =>
		["contests", "ranking", String(id)] as const,
	academySearch: (name: string) =>
		["contests", "academy", "search", name] as const,
	academyMembership: ["contests", "academy", "membership"] as const,
};

export async function getAcademyMembership(): Promise<boolean> {
	// Membership is determined by user.academy: null = not a member, object = member
	const response = await axiosInstance.get(endpoints.auth.me);
	const raw = response.data;
	const record = asRecord(raw) ?? asRecord(asRecord(raw)?.data);
	if (!record) return false;
	return record.academy !== null && record.academy !== undefined;
}

export function useAcademyMembershipQuery(enabled = true) {
	return useQuery({
		queryKey: contestQueryKeys.academyMembership,
		queryFn: getAcademyMembership,
		enabled,
		staleTime: 0,
		retry: 1,
	});
}

export async function searchAcademies(name: string): Promise<Academy[]> {
	const trimmed = name.trim();
	const response = await axiosInstance.get(endpoints.contests.academy, {
		params: trimmed ? { name: trimmed } : {},
	});
	return unwrapList<Academy>(response.data);
}

export async function joinAcademy(input: JoinAcademyInput) {
	const response = await axiosInstance.post(endpoints.contests.academyJoin, {
		invite_code: input.inviteCode,
	});
	return unwrapData(response.data);
}

export function useAcademySearchQuery(name: string, enabled = true) {
	return useQuery({
		queryKey: contestQueryKeys.academySearch(name),
		queryFn: () => searchAcademies(name),
		enabled: enabled && name.trim().length > 0,
		staleTime: 30_000,
	});
}

export function useJoinAcademyMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: joinAcademy,
		onSuccess: () => {
			// After joining, contests list (academy-scoped) may have new entries
			queryClient.invalidateQueries({ queryKey: contestQueryKeys.listRoot });
			queryClient.invalidateQueries({ queryKey: contestQueryKeys.my });
			queryClient.invalidateQueries({
				queryKey: ["contests", "academy"],
			});
		},
	});
}

export async function getContests(params: ContestListParams = {}) {
	const response = await axiosInstance.get(endpoints.contests.list, {
		params: {
			...(params.status ? { status: params.status } : {}),
			...(params.type ? { type: params.type } : {}),
		},
	});
	return unwrapList<Contest>(response.data);
}

export async function getMyContests() {
	const response = await axiosInstance.get(endpoints.contests.my);
	return unwrapList<MyContest>(response.data);
}

export async function getContestDetails(id: string | number) {
	const response = await axiosInstance.get<Contest | { data: Contest }>(
		endpoints.contests.details(id),
	);
	return unwrapData(response.data);
}

const normalizeJoinContestInput = (input: string | number | JoinContestInput) => {
	if (typeof input === "object" && input !== null) return input;
	return { contestId: input };
};

export async function joinContest(input: string | number | JoinContestInput) {
	const normalized = normalizeJoinContestInput(input);
	const response = await axiosInstance.post<Contest | { data: Contest }>(
		endpoints.contests.join(normalized.contestId),
	);
	return unwrapData(response.data);
}

export async function getContestQuestions(id: string | number) {
	const response = await axiosInstance.get(endpoints.contests.questions(id));
	return unwrapList<ContestQuestion>(response.data);
}

export async function getContestRanking(id: string | number) {
	const response = await axiosInstance.get(endpoints.contests.ranking(id));
	return unwrapList<ContestRankingEntry>(response.data);
}

export async function submitContest(input: SubmitContestInput) {
	const response = await axiosInstance.post<
		ContestSubmitResult | { data: ContestSubmitResult }
	>(endpoints.contests.submit(input.contestId), {
		answers: input.answers,
		...(input.finishedAt ? { finished_at: input.finishedAt } : {}),
	});
	return unwrapData(response.data);
}

export function useContestsQuery(
	params: ContestListParams = {},
	enabled = true,
) {
	return useQuery({
		queryKey: contestQueryKeys.list(params),
		queryFn: () => getContests(params),
		enabled,
	});
}

export function useMyContestsQuery(enabled = true) {
	return useQuery({
		queryKey: contestQueryKeys.my,
		queryFn: getMyContests,
		enabled,
	});
}

export function useContestDetailsQuery(
	id?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: contestQueryKeys.details(id ?? ""),
		queryFn: () => getContestDetails(id as string | number),
		enabled: enabled && id !== null && id !== undefined && String(id).length > 0,
		retry: false,
	});
}

export function useContestQuestionsQuery(
	id?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: contestQueryKeys.questions(id ?? ""),
		queryFn: () => getContestQuestions(id as string | number),
		enabled: enabled && id !== null && id !== undefined && String(id).length > 0,
	});
}

export function useContestRankingQuery(
	id?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: contestQueryKeys.ranking(id ?? ""),
		queryFn: () => getContestRanking(id as string | number),
		enabled: enabled && id !== null && id !== undefined && String(id).length > 0,
	});
}

export function useJoinContestMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: joinContest,
		onMutate: async (input) => {
			const { contestId } = normalizeJoinContestInput(input);
			await queryClient.cancelQueries({ queryKey: contestQueryKeys.listRoot });
			await queryClient.cancelQueries({ queryKey: contestQueryKeys.my });

			const previousList =
				queryClient.getQueriesData<Contest[]>({ queryKey: contestQueryKeys.listRoot });
			const previousMy =
				queryClient.getQueryData<MyContest[]>(contestQueryKeys.my) ?? [];
			const normalizedContestId = String(contestId);
			const joinedContest = previousList
				.flatMap(([, contests]) => contests ?? [])
				.find((contest) => String(contest.id) === normalizedContestId);

			for (const [queryKey, contests] of previousList) {
				queryClient.setQueryData<Contest[]>(
					queryKey,
					(contests ?? []).map((contest) =>
						String(contest.id) === normalizedContestId
							? { ...contest, is_joined: true }
							: contest,
					),
				);
			}

			if (
				joinedContest &&
				!previousMy.some((contest) => getMyContestId(contest) === normalizedContestId)
			) {
				queryClient.setQueryData<MyContest[]>(contestQueryKeys.my, [
					{ contest: { ...joinedContest, is_joined: true } },
					...previousMy,
				]);
			}

			return { previousList, previousMy };
		},
		onError: (_error, _contestId, context) => {
			if (context?.previousList) {
				for (const [queryKey, contests] of context.previousList) {
					queryClient.setQueryData(queryKey, contests);
				}
			}
			if (context?.previousMy) {
				queryClient.setQueryData(contestQueryKeys.my, context.previousMy);
			}
		},
		onSuccess: (contest, input) => {
			const { contestId } = normalizeJoinContestInput(input);
			queryClient.invalidateQueries({ queryKey: contestQueryKeys.listRoot });
			queryClient.invalidateQueries({ queryKey: contestQueryKeys.my });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.balance });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.history });
			queryClient.invalidateQueries({
				queryKey: contestQueryKeys.details(contestId),
			});

			if (contest?.id) {
				queryClient.setQueryData(contestQueryKeys.details(contest.id), contest);
			}
		},
	});
}

export function useSubmitContestMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: submitContest,
		onSuccess: (_result, input) => {
			queryClient.invalidateQueries({ queryKey: contestQueryKeys.listRoot });
			queryClient.invalidateQueries({ queryKey: contestQueryKeys.my });
			queryClient.invalidateQueries({
				queryKey: contestQueryKeys.details(input.contestId),
			});
			queryClient.invalidateQueries({
				queryKey: contestQueryKeys.ranking(input.contestId),
			});
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.balance });
			queryClient.invalidateQueries({ queryKey: tokenQueryKeys.history });
		},
	});
}
