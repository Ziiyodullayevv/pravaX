import { useQuery } from "@tanstack/react-query";

import { axiosInstance, endpoints } from "@/lib/api";

export type TokenTransaction = {
	id: number;
	amount: number;
	balance_after: number;
	reason: string;
	session_id: number | string | null;
	contest_id: number | string | null;
	created_at: string;
};

export type TokenBalance = {
	balance: number;
	updated_at: string;
	recent_transactions: TokenTransaction[];
};

export type PaginatedTokenTransactions = {
	count: number;
	next: string | null;
	previous: string | null;
	results: TokenTransaction[];
};

export const tokenQueryKeys = {
	balance: ["tokens", "balance"] as const,
	history: ["tokens", "history"] as const,
};

export async function getTokenBalance() {
	const response = await axiosInstance.get<TokenBalance>(endpoints.tokens.balance);
	return response.data;
}

export async function getTokenHistory() {
	const response = await axiosInstance.get<
		TokenTransaction[] | PaginatedTokenTransactions
	>(endpoints.tokens.history);

	if (Array.isArray(response.data)) {
		return {
			count: response.data.length,
			next: null,
			previous: null,
			results: response.data,
		};
	}

	return response.data;
}

export function useTokenBalanceQuery(enabled = true) {
	return useQuery({
		queryKey: tokenQueryKeys.balance,
		queryFn: getTokenBalance,
		enabled,
		staleTime: 30_000,
	});
}

export function useTokenHistoryQuery(enabled = true) {
	return useQuery({
		queryKey: tokenQueryKeys.history,
		queryFn: getTokenHistory,
		enabled,
		staleTime: 30_000,
	});
}
