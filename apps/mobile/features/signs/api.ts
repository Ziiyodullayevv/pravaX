import { useQuery } from "@tanstack/react-query";

import { apiBaseUrl, axiosInstance, endpoints } from "@/lib/api";

export type SignSection = {
	id: number;
	name: string | LocalizedText;
	order: number;
	signs_count: number;
};

export type SignListItem = {
	id: number;
	number: string;
	name: string | LocalizedText;
	image: string;
	order: number;
};

export type SignDetail = SignListItem & {
	description: string | LocalizedText;
	extra: string | LocalizedText;
	section: SignSection;
};

export type LocalizedText = {
	uzl?: string | null;
	uzk?: string | null;
	ru?: string | null;
	[key: string]: unknown;
};

export function getLocalizedSignText(
	value: string | LocalizedText | null | undefined,
	language: string,
	fallback = "",
) {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object") return fallback;

	if (language.startsWith("ru")) {
		return value.ru || value.uzl || value.uzk || fallback;
	}
	if (language.includes("Cyrl")) {
		return value.uzk || value.uzl || value.ru || fallback;
	}

	return value.uzl || value.uzk || value.ru || fallback;
}

const SIGNS_STALE_TIME = 1000 * 60 * 60 * 24;
const SIGNS_GC_TIME = 1000 * 60 * 60 * 24 * 7;

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

function unwrapList<T>(payload: unknown): T[] {
	if (Array.isArray(payload)) return payload as T[];

	const record = asRecord(payload);
	if (!record) return [];

	for (const key of ["data", "results", "signs", "items"]) {
		if (Array.isArray(record[key])) return record[key] as T[];
	}

	const data = asRecord(record.data);
	if (data) {
		for (const key of ["results", "signs", "items"]) {
			if (Array.isArray(data[key])) return data[key] as T[];
		}
	}

	return [];
}

function sortByOrder<T extends { order?: number; id?: number }>(items: T[]) {
	return [...items].sort((first, second) => {
		const orderDiff = (first.order ?? 0) - (second.order ?? 0);
		if (orderDiff !== 0) return orderDiff;
		return (first.id ?? 0) - (second.id ?? 0);
	});
}

export function resolveSignImageUrl(value?: string | null) {
	if (!value) return "";
	if (/^https?:\/\//i.test(value)) return value;
	return `${apiBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

export const signQueryKeys = {
	all: ["signs"] as const,
	detail: (id: string | number) => ["signs", "detail", String(id)] as const,
	sectionSigns: (sectionId: string | number) =>
		["signs", "sections", String(sectionId), "signs"] as const,
	sections: ["signs", "sections"] as const,
};

export async function getSignSections() {
	const response = await axiosInstance.get<unknown>(
		endpoints.signs.sections,
	);
	return sortByOrder(unwrapList<SignSection>(response.data));
}

export async function getSectionSigns(sectionId: string | number) {
	const response = await axiosInstance.get<unknown>(
		endpoints.signs.sectionSigns(sectionId),
	);
	return sortByOrder(unwrapList<SignListItem>(response.data));
}

export async function getSignDetail(id: string | number) {
	const response = await axiosInstance.get<SignDetail>(endpoints.signs.detail(id));
	return response.data;
}

const stableSignsQueryOptions = {
	gcTime: SIGNS_GC_TIME,
	refetchOnMount: false,
	refetchOnReconnect: false,
	refetchOnWindowFocus: false,
	staleTime: SIGNS_STALE_TIME,
};

export function useSignSectionsQuery(enabled = true) {
	return useQuery({
		queryKey: signQueryKeys.sections,
		queryFn: getSignSections,
		enabled,
		...stableSignsQueryOptions,
	});
}

export function useSectionSignsQuery(
	sectionId?: string | number | null,
	enabled = true,
) {
	return useQuery({
		queryKey: signQueryKeys.sectionSigns(sectionId ?? ""),
		queryFn: () => getSectionSigns(sectionId as string | number),
		enabled:
			enabled &&
			sectionId !== null &&
			sectionId !== undefined &&
			String(sectionId).length > 0,
		...stableSignsQueryOptions,
	});
}

export function useSignDetailQuery(id?: string | number | null, enabled = true) {
	return useQuery({
		queryKey: signQueryKeys.detail(id ?? ""),
		queryFn: () => getSignDetail(id as string | number),
		enabled:
			enabled &&
			id !== null &&
			id !== undefined &&
			String(id).length > 0,
		...stableSignsQueryOptions,
	});
}
