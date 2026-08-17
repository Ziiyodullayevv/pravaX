import React, { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	TextInput,
	type NativeSyntheticEvent,
	type TextInputSubmitEditingEventData,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import {
	BookmarkPlus,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleCheck,
	Crown,
	Search,
} from "lucide-react-native";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import {
	useQuizCategoriesQuery,
	useDeleteQuizSavedQuestionMutation,
	useQuizQuestionsInfiniteQuery,
	useQuizSavedQuestionsQuery,
	useSaveQuizQuestionMutation,
	type QuizCategory,
	type QuizQuestion,
} from "@/features/quiz/api";
import { getCategoryTitle } from "@/features/theory/backend-mappers";
import { useI18n } from "@/locales/i18n-provider";

const PAGE_SIZE = 20;

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

function getQuestionSearchText(question: QuizQuestion) {
	return [
		question.text_uzl,
		question.text_uzk,
		question.text_ru,
		question.category_name,
	]
		.filter((value): value is string => typeof value === "string")
		.join(" ")
	.toLowerCase();
}

const QuestionCard = React.memo(function QuestionCard({
	item,
	language,
	categoryLabel,
	mutedColor,
	textColor,
	isSaved,
	isSaving,
	onPress,
	onToggleSaved,
	questionLabelText,
	savedLabel,
}: {
	item: QuizQuestion;
	language: string;
	categoryLabel: string;
	mutedColor: string;
	textColor: string;
	isSaved: boolean;
	isSaving: boolean;
	onPress: (item: QuizQuestion) => void;
	onToggleSaved: (item: QuizQuestion) => void;
	questionLabelText: string;
	savedLabel: string;
}) {
	const title = getQuestionText(item, language) ?? "Savol";
	const questionLabel = item.number ?? item.id;
	const handlePress = useCallback(() => onPress(item), [onPress, item]);
	const handleToggleSaved = useCallback(
		(event?: { stopPropagation?: () => void }) => {
			event?.stopPropagation?.();
			onToggleSaved(item);
		},
		[onToggleSaved, item],
	);

	return (
		<Pressable onPress={handlePress}>
			<Box className="rounded-3xl bg-card px-4 py-4">
				<Box className="flex-row items-start gap-2">
					<Pressable
						onPress={handleToggleSaved}
						disabled={isSaving}
					>
						<Box className={isSaving ? "opacity-50" : ""}>
							<GradientIconFrame>
								<BookmarkPlus
									size={20}
									color={isSaved ? "#0f8b5f" : textColor}
									strokeWidth={1.9}
								/>
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
							onPress={handleToggleSaved}
							disabled={isSaving}
						>
							<Box
								className={[
									"flex-row items-center gap-2",
									isSaving ? "opacity-50" : "",
								].join(" ")}
							>
								{isSaved ? (
									<CircleCheck size={18} color="#0f8b5f" />
								) : (
									<BookmarkPlus size={18} color={mutedColor} />
								)}
								<Text
									className={[
										"text-sm",
										isSaved ? "text-emerald-700" : "",
									].join(" ")}
									style={isSaved ? undefined : { color: mutedColor }}
								>
									{isSaved ? savedLabel : `${questionLabelText}: ${questionLabel}`}
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

const QuestionSkeleton = React.memo(function QuestionSkeleton() {
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

const QUESTIONS_LIST_CONTENT_STYLE = { paddingHorizontal: 12, paddingBottom: 24 } as const;
const QUESTIONS_SEPARATOR = () => <Box className="h-3" />;

type ListItem =
	| { type: "skeleton"; id: string }
	| { type: "question"; item: QuizQuestion };

export default function QuestionsSearchScreen() {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const [searchText, setSearchText] = useState("");
	const [submittedSearch, setSubmittedSearch] = useState("");
	const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [savingQuestionIds, setSavingQuestionIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const categoriesQuery = useQuizCategoriesQuery();
	const questionsQuery = useQuizQuestionsInfiniteQuery({
		categoryId: selectedCategoryId,
		pageSize: PAGE_SIZE,
	});
	const savedQuestionsQuery = useQuizSavedQuestionsQuery();
	const saveQuestionMutation = useSaveQuizQuestionMutation();
	const deleteSavedQuestionMutation = useDeleteQuizSavedQuestionMutation();
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await Promise.all([
				categoriesQuery.refetch(),
				questionsQuery.refetch(),
				savedQuestionsQuery.refetch(),
			]);
		} finally {
			setIsRefreshing(false);
		}
	}, [categoriesQuery, questionsQuery, savedQuestionsQuery]);
	const questions = useMemo(
		() => questionsQuery.data?.pages.flatMap((pageData) => pageData.results) ?? [],
		[questionsQuery.data],
	);
	const filteredQuestions = useMemo(() => {
		const normalized = submittedSearch.trim().toLowerCase();
		if (!normalized) return questions;

		return questions.filter((question) => {
			return getQuestionSearchText(question).includes(normalized);
		});
	}, [questions, submittedSearch]);
	const totalCount = questionsQuery.data?.pages[0]?.count ?? 0;
	const selectedCategory = (categoriesQuery.data ?? []).find(
		(category) => String(category.id) === selectedCategoryId,
	);
	const selectedCategoryLabel = selectedCategory
		? getCategoryTitle(selectedCategory, language)
		: t("practice.questions.filter", "Filter");
	const categoryTitleById = useMemo(() => {
		const titleById = new Map<string, string>();

		for (const category of categoriesQuery.data ?? []) {
			const title = getCategoryTitle(category, language);
			if (title) titleById.set(String(category.id), title);
		}

		return titleById;
	}, [categoriesQuery.data, language]);
	const showSkeleton = questionsQuery.isLoading && questions.length === 0;
	const skeletonItems = useMemo(
		() => Array.from({ length: 10 }, (_, index) => `s${index + 1}`),
		[],
	);
	const listData = useMemo<ListItem[]>(() => {
		if (showSkeleton) {
			return skeletonItems.map((id) => ({ type: "skeleton", id }));
		}

		return filteredQuestions.map((item) => ({ type: "question", item }));
	}, [filteredQuestions, showSkeleton, skeletonItems]);
	const savedQuestionIds = useMemo(
		() =>
			new Set(
				(savedQuestionsQuery.data ?? []).map((item) => String(item.question.id)),
			),
		[savedQuestionsQuery.data],
	);

	const submitSearch = (
		event?: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
	) => {
		setSubmittedSearch((event?.nativeEvent.text ?? searchText).trim());
	};

	const selectCategory = (category: QuizCategory | null) => {
		setSelectedCategoryId(category ? String(category.id) : null);
		setIsFilterOpen(false);
	};

	const toggleSavedQuestion = useCallback(
		(question: QuizQuestion) => {
			const questionId = String(question.id);
			if (savingQuestionIds.has(questionId)) {
				return;
			}

			setSavingQuestionIds((current) => new Set(current).add(questionId));
			const clearSavingState = () => {
				setSavingQuestionIds((current) => {
					const next = new Set(current);
					next.delete(questionId);
					return next;
				});
			};

			if (savedQuestionIds.has(questionId)) {
				deleteSavedQuestionMutation.mutate(question.id, {
					onSettled: clearSavingState,
				});
				return;
			}

			saveQuestionMutation.mutate(
				{
					questionId: question.id,
					question,
				},
				{
					onSettled: clearSavingState,
				},
			);
		},
		[
			savingQuestionIds,
			savedQuestionIds,
			deleteSavedQuestionMutation,
			saveQuestionMutation,
		],
	);

	const handleCardPress = useCallback(
		(question: QuizQuestion) => {
			router.push({
				pathname: "/tabs/(questions)/questions/[questionId]",
				params: { questionId: String(question.id) },
			});
		},
		[router],
	);

	const questionLabelText = t("practice.questions.detailTitle", "Savol");
	const savedLabel = t("practice.questions.saved", "Saqlangan");
	const questionsFallback = t("practice.questions.title", "Savollar bo'limi");

	const keyExtractor = useCallback(
		(item: ListItem, index: number) =>
			item.type === "skeleton"
				? item.id
				: String(item.item.id ?? index),
		[],
	);

	const getItemType = useCallback(
		(item: ListItem) => (item.type === "skeleton" ? "skel" : "q"),
		[],
	);

	const renderItem = useCallback(
		({ item }: { item: ListItem }) => {
			if (item.type === "skeleton") return <QuestionSkeleton />;
			const q = item.item;
			const categoryLabel =
				categoryTitleById.get(String(q.category_id ?? q.category ?? "")) ??
				q.category_name ??
				questionsFallback;
			return (
				<QuestionCard
					item={q}
					language={language}
					categoryLabel={categoryLabel}
					mutedColor={muted}
					textColor={text}
					isSaved={savedQuestionIds.has(String(q.id))}
					isSaving={savingQuestionIds.has(String(q.id))}
					onPress={handleCardPress}
					onToggleSaved={toggleSavedQuestion}
					questionLabelText={questionLabelText}
					savedLabel={savedLabel}
				/>
			);
		},
		[
			categoryTitleById,
			questionsFallback,
			language,
			muted,
			text,
			savedQuestionIds,
			savingQuestionIds,
			handleCardPress,
			toggleSavedQuestion,
			questionLabelText,
			savedLabel,
		],
	);

	const handleEndReached = useCallback(() => {
		if (questionsQuery.hasNextPage && !questionsQuery.isFetchingNextPage) {
			questionsQuery.fetchNextPage();
		}
	}, [questionsQuery]);

	return (
		<Box className="flex-1 pt-safe bg-background">
			<Box className="px-4 my-2 flex-row items-center justify-between">
				<Box>
					<YandexRippleButton
						onPress={() => router.replace("/tabs/(tabs)/home")}
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

				<Box className="items-center">
					<Heading className="text-lg font-semibold" style={{ color: text }}>
						{t("practice.questions.title", "Questions")}
					</Heading>
					<Text className="text-sm" style={{ color: muted }}>
						{totalCount.toLocaleString("en-US")}{" "}
						{t("common.questionsWord", "questions")}
					</Text>
				</Box>

				<GradientIconFrame
					size={48}
					borderRadius={999}
					innerBorderRadius={999}
				>
					<Crown size={24} color={palette.text} />
				</GradientIconFrame>
			</Box>

			<Box className="px-4 mt-4">
				<Box className="h-14 rounded-[22px] bg-card flex-row items-center px-4">
					<Search size={24} color={muted} strokeWidth={2.2} />
					<TextInput
						value={searchText}
						onChangeText={setSearchText}
						onSubmitEditing={submitSearch}
						returnKeyType="search"
						placeholder={t(
							"practice.questions.searchPlaceholder",
							"What are you looking for?",
						)}
						placeholderTextColor={muted}
						className="flex-1 ml-3 text-lg text-foreground"
						style={{
							color: text,
							height: 48,
							lineHeight: 22,
							paddingTop: 0,
							paddingBottom: 0,
							paddingVertical: 0,
							textAlignVertical: "center",
						}}
					/>

					<Box className="h-9 w-[1px] bg-border mx-3" />

					<Pressable
						className="h-12 flex-row items-center gap-1 justify-center"
						onPress={() => setIsFilterOpen((prev) => !prev)}
					>
						<Text
							className="text-base font-medium"
							numberOfLines={1}
							style={{ color: text, maxWidth: 86 }}
						>
							{selectedCategoryLabel}
						</Text>
						<ChevronDown size={18} color={text} />
					</Pressable>
				</Box>

				{isFilterOpen ? (
					<Box
						className="mt-2 rounded-3xl bg-card overflow-hidden"
						style={{ maxHeight: 300 }}
					>
						<Pressable onPress={() => selectCategory(null)}>
							<Box className="px-4 py-3">
								<Text className="text-base font-medium">
									{t("practice.questions.allCategories", "All categories")}
								</Text>
							</Box>
							<Box className="mx-4 h-[1px] bg-border/60" />
						</Pressable>
						<ScrollView
							nestedScrollEnabled
							showsVerticalScrollIndicator={false}
							style={{ maxHeight: 244 }}
						>
							{(categoriesQuery.data ?? []).map((category, index, categories) => (
								<Pressable
									key={String(category.id)}
									onPress={() => selectCategory(category)}
								>
									<Box className="px-4 py-3">
										<Text className="text-base" numberOfLines={1}>
											{getCategoryTitle(category, language) ??
												`Bo'lim ${category.id}`}
										</Text>
									</Box>
									{index < categories.length - 1 ? (
										<Box className="mx-4 h-[1px] bg-border/40" />
									) : null}
								</Pressable>
							))}
						</ScrollView>
					</Box>
				) : null}
			</Box>

			{questionsQuery.error ? (
				<Box className="mx-4 mt-3 rounded-2xl bg-card px-3 py-3 border border-destructive/30">
					<Text className="text-xs text-destructive">
						{questionsQuery.error instanceof Error
							? questionsQuery.error.message
							: t(
									"practice.questions.loadError",
									"Could not load questions.",
								)}
					</Text>
					<Pressable className="mt-2" onPress={() => questionsQuery.refetch()}>
						<Text className="text-sm font-semibold text-primary">
							{t("common.retry", "Retry")}
						</Text>
					</Pressable>
				</Box>
			) : null}

			<FlashList
				className="mt-4"
				showsVerticalScrollIndicator={false}
				overScrollMode="never"
				decelerationRate="normal"
				refreshing={isRefreshing}
				onRefresh={handleRefresh}
				data={listData}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				getItemType={getItemType}
				ItemSeparatorComponent={QUESTIONS_SEPARATOR}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.6}
				ListEmptyComponent={
					showSkeleton ? null : (
						<Box className="rounded-3xl bg-card px-4 py-5">
							<Text className="text-sm text-foreground/70">
								{t("practice.questions.empty", "Question not found.")}
							</Text>
						</Box>
					)
				}
				ListFooterComponent={
					questionsQuery.isFetchingNextPage ? (
						<Box className="py-5 items-center justify-center">
							<ActivityIndicator color={palette.text} />
						</Box>
					) : questions.length > 0 ? (
						<Box className="py-5 items-center justify-center">
							<Text className="text-xs text-muted-foreground">
								{questions.length.toLocaleString("en-US")} /{" "}
								{totalCount.toLocaleString("en-US")}
							</Text>
						</Box>
					) : null
				}
				contentContainerStyle={QUESTIONS_LIST_CONTENT_STYLE}
			/>
		</Box>
	);
}
