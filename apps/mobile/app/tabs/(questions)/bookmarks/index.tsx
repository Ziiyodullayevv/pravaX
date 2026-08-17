import React, { useCallback, useMemo, useState } from "react";
import { Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import {
	BookmarkPlus,
	BookmarkX,
	ChevronLeft,
	ChevronRight,
	CircleCheck,
} from "lucide-react-native";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { NetworkErrorState } from "@/components/NetworkErrorState";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import {
	useQuizCategoriesQuery,
	useDeleteQuizSavedQuestionMutation,
	useQuizSavedQuestionsInfiniteQuery,
	type QuizQuestion,
	type QuizSavedQuestion,
} from "@/features/quiz/api";
import { getCategoryTitle } from "@/features/theory/backend-mappers";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

function pickString(...values: unknown[]) {
	return values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();
}

function getQuestionText(question: QuizQuestion, language: string) {
	if (language.startsWith("ru")) {
		return pickString(question.text_ru, question.text_uzl);
	}

	if (language.includes("Cyrl")) {
		return pickString(question.text_uzk, question.text_uzl);
	}

	return pickString(question.text_uzl, question.text_ru);
}

const SavedQuestionCard = React.memo(function SavedQuestionCard({
	item,
	language,
	categoryLabel,
	mutedColor,
	textColor,
	onPress,
	onDelete,
	isDeleting,
	savedLabel,
}: {
	item: QuizSavedQuestion;
	language: string;
	categoryLabel: string;
	mutedColor: string;
	textColor: string;
	onPress: (item: QuizSavedQuestion) => void;
	onDelete: (questionId: number | string) => void;
	isDeleting: boolean;
	savedLabel: string;
}) {
	const title = getQuestionText(item.question, language) ?? "Savol";
	const handlePress = useCallback(() => onPress(item), [onPress, item]);
	const handleDelete = useCallback(
		(event?: { stopPropagation?: () => void }) => {
			event?.stopPropagation?.();
			onDelete(item.question.id);
		},
		[onDelete, item.question.id],
	);

	return (
		<Pressable onPress={handlePress}>
			<Box className="rounded-3xl bg-card px-4 py-4">
				<Box className="flex-row items-start gap-2">
					<Pressable
						onPress={handleDelete}
						disabled={isDeleting}
					>
						<Box className={isDeleting ? "opacity-50" : ""}>
							<GradientIconFrame>
								<BookmarkPlus size={20} color="#0f8b5f" strokeWidth={1.9} />
							</GradientIconFrame>
						</Box>
					</Pressable>

					<Box className="ml-4 flex-1">
						<Heading
							className="text-sm font-semibold"
							numberOfLines={2}
							ellipsizeMode="tail"
							style={{ color: textColor }}
						>
							{title}
						</Heading>
						<Text
							className="mt-1 text-sm text-foreground/70"
							numberOfLines={1}
						>
							{categoryLabel}
						</Text>

						<Pressable
							className="mt-3 self-start"
							onPress={handleDelete}
							disabled={isDeleting}
						>
							<Box
								className={[
									"flex-row items-center gap-2",
									isDeleting ? "opacity-50" : "",
								].join(" ")}
							>
								<CircleCheck size={18} color="#0f8b5f" />
								<Text className="text-sm text-emerald-700">
									{savedLabel}
								</Text>
							</Box>
						</Pressable>
					</Box>

					<Box className="-mr-1 mt-1">
						<ChevronRight size={22} color={mutedColor} />
					</Box>
				</Box>
			</Box>
		</Pressable>
	);
});

const SavedQuestionSkeleton = React.memo(function SavedQuestionSkeleton() {
	return (
		<Box className="rounded-3xl bg-card px-4 py-4">
			<Box className="flex-row items-start gap-2">
				<Skeleton variant="sharp" className="h-10 w-10 rounded-xl" />

				<Box className="ml-4 flex-1">
					<SkeletonText _lines={2} className="h-3" />
					<Skeleton variant="sharp" className="mt-2 h-3 w-4/5 rounded-full" />
					<Box className="mt-3 flex-row items-center gap-2">
						<Skeleton variant="circular" className="h-[18px] w-[18px]" />
						<Skeleton variant="sharp" className="h-3 w-24 rounded-full" />
					</Box>
				</Box>

				<Box className="-mr-1 mt-1">
					<Skeleton variant="sharp" className="h-6 w-4 rounded-full" />
				</Box>
			</Box>
		</Box>
	);
});

const SAVED_LIST_CONTENT_STYLE = {
	paddingHorizontal: 12,
	paddingTop: 16,
	paddingBottom: 24,
	flexGrow: 1,
} as const;
const SAVED_SEPARATOR = () => <Box className="h-3" />;

type SavedListItem =
	| { type: "skeleton"; id: string }
	| { type: "saved"; item: QuizSavedQuestion };

export default function BookmarksScreen() {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { user } = useAuth();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const mountReady = useDeferredMount();
	const categoriesQuery = useQuizCategoriesQuery(mountReady);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const {
		data: savedPages,
		isLoading,
		isFetching,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
		error,
		refetch,
	} = useQuizSavedQuestionsInfiniteQuery(mountReady && Boolean(user?.id));
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await Promise.all([categoriesQuery.refetch(), refetch()]);
		} finally {
			setIsRefreshing(false);
		}
	}, [categoriesQuery, refetch]);
	const data = useMemo(
		() => savedPages?.pages.flatMap((page) => page.results) ?? [],
		[savedPages],
	);
	const totalSavedCount = savedPages?.pages[0]?.count ?? data.length;
	const deleteSavedMutation = useDeleteQuizSavedQuestionMutation();
	const showSkeleton = (!mountReady || isLoading || isFetching) && data.length === 0;
	const skeletonItems = useMemo(
		() => Array.from({ length: 10 }, (_, index) => `s${index + 1}`),
		[],
	);
	const categoryTitleById = useMemo(() => {
		const titleById = new Map<string, string>();

		for (const category of categoriesQuery.data ?? []) {
			const title = getCategoryTitle(category, language);
			if (title) titleById.set(String(category.id), title);
		}

		return titleById;
	}, [categoriesQuery.data, language]);
	const listData = useMemo<SavedListItem[]>(() => {
		if (showSkeleton) {
			return skeletonItems.map((id) => ({ type: "skeleton", id }));
		}

		return data.map((item) => ({ type: "saved", item }));
	}, [data, showSkeleton, skeletonItems]);
	const errorMessage =
		error instanceof Error
			? error.message
			: error
				? "Saqlangan savollarni yuklashda xatolik yuz berdi."
				: "";
	const savedLabel = t("practice.questions.saved", "Saqlangan");
	const questionsFallback = t("practice.questions.title", "Savollar");
	const emptyText = t("practice.bookmarks.empty", "Saqlangan savollar yo'q.");

	const handleCardPress = useCallback(
		(item: QuizSavedQuestion) => {
			router.push({
				pathname: "/tabs/(questions)/questions/[questionId]",
				params: { questionId: String(item.question.id) },
			});
		},
		[router],
	);

	const handleCardDelete = useCallback(
		(questionId: number | string) => {
			deleteSavedMutation.mutate(questionId);
		},
		[deleteSavedMutation],
	);

	const handleBackPress = useCallback(
		() => router.replace("/tabs/(tabs)/home"),
		[router],
	);

	const handleEndReached = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const keyExtractor = useCallback(
		(item: SavedListItem, index: number) =>
			item.type === "skeleton"
				? item.id
				: String(item.item.question.id ?? index),
		[],
	);

	const renderItem = useCallback(
		({ item }: { item: SavedListItem }) => {
			if (item.type === "skeleton") return <SavedQuestionSkeleton />;
			const q = item.item.question;
			const categoryLabel =
				categoryTitleById.get(String(q.category_id ?? q.category ?? "")) ??
				q.category_name ??
				questionsFallback;
			return (
				<SavedQuestionCard
					item={item.item}
					language={language}
					categoryLabel={categoryLabel}
					mutedColor={muted}
					textColor={text}
					isDeleting={deleteSavedMutation.isPending}
					savedLabel={savedLabel}
					onPress={handleCardPress}
					onDelete={handleCardDelete}
				/>
			);
		},
		[
			categoryTitleById,
			questionsFallback,
			language,
			muted,
			text,
			deleteSavedMutation.isPending,
			savedLabel,
			handleCardPress,
			handleCardDelete,
		],
	);

	const listFooterComponent = useMemo(
		() =>
			isFetchingNextPage ? (
				<Box className="py-4">
					<SavedQuestionSkeleton />
				</Box>
			) : null,
		[isFetchingNextPage],
	);

	const listEmptyComponent = useMemo(
		() =>
			showSkeleton ? null : (
				<Box className="flex-1 items-center justify-center py-24">
					<BookmarkX size={64} color={muted} strokeWidth={1.3} />
					<Text className="mt-4 text-base text-center" style={{ color: muted }}>
						{emptyText}
					</Text>
				</Box>
			),
		[showSkeleton, muted, emptyText],
	);

	return (
		<Box className="flex-1 pt-safe bg-background">
			<Box className="px-4 my-2 flex-row items-center justify-between">
				<Box>
					<YandexRippleButton
						onPress={handleBackPress}
						borderRadius={9999}
					>
						<GradientIconFrame
							size={48}
							borderRadius={999}
							innerBorderRadius={999}
						>
							<ChevronLeft size={24} color={palette.text} />
						</GradientIconFrame>
					</YandexRippleButton>
				</Box>

				<Box className="h-12 flex-1 items-center justify-center px-3">
					<Heading className="text-lg font-semibold" style={{ color: text }}>
						{t("practice.explore.bookmarks.title", "Bookmarks")}
					</Heading>
					<Text
						className="text-sm"
						style={{ color: muted, lineHeight: 18, marginTop: 1 }}
					>
						{totalSavedCount.toLocaleString("en-US")}{" "}
						{t("common.questionsWord", "savol")}
					</Text>
				</Box>

				<GradientIconFrame
					size={48}
					borderRadius={999}
					innerBorderRadius={999}
				>
					<BookmarkPlus size={24} color={palette.text} strokeWidth={1.9} />
				</GradientIconFrame>
			</Box>

			{errorMessage && data.length === 0 && !showSkeleton ? (
					<NetworkErrorState onRetry={handleRefresh} isRetrying={isRefreshing} />
				) : (
					<FlashList
						showsVerticalScrollIndicator={false}
					overScrollMode="never"
					decelerationRate="normal"
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						data={listData}
						keyExtractor={keyExtractor}
						renderItem={renderItem}
						ItemSeparatorComponent={SAVED_SEPARATOR}
						onEndReached={handleEndReached}
						onEndReachedThreshold={0.45}
						ListFooterComponent={listFooterComponent}
						ListEmptyComponent={listEmptyComponent}
						contentContainerStyle={SAVED_LIST_CONTENT_STYLE}
					/>
				)}
		</Box>
	);
}
