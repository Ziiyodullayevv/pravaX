import React from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronLeft, HelpCircle } from "lucide-react-native";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import {
	useQuizCategoriesQuery,
	useQuizQuestionDetailQuery,
	type QuizChoice,
	type QuizQuestion,
} from "@/features/quiz/api";
import { getCategoryTitle } from "@/features/theory/backend-mappers";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

function pickString(...values: unknown[]) {
	return values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();
}

function getQuestionText(question: QuizQuestion | null | undefined, language: string) {
	if (!question) return "";

	if (language.startsWith("ru")) {
		return pickString(question.text_ru, question.text_uzl, question.text_uzk);
	}

	if (language.includes("Cyrl")) {
		return pickString(question.text_uzk, question.text_uzl, question.text_ru);
	}

	return pickString(question.text_uzl, question.text_ru, question.text_uzk);
}

function getChoiceText(choice: QuizChoice, language: string) {
	if (language.startsWith("ru")) {
		return pickString(choice.text_ru, choice.text_uzl, choice.text_uzk);
	}

	if (language.includes("Cyrl")) {
		return pickString(choice.text_uzk, choice.text_uzl, choice.text_ru);
	}

	return pickString(choice.text_uzl, choice.text_ru, choice.text_uzk);
}

export default function QuestionDetailScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ questionId?: string }>();
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const correctBorder = "#22c55e";
	const correctText = isDark ? "#bbf7d0" : "#166534";
	const questionId = params.questionId ?? "";
	const mountReady = useDeferredMount();
	const questionQuery = useQuizQuestionDetailQuery(questionId, mountReady);
	const categoriesQuery = useQuizCategoriesQuery(mountReady);
	const question = questionQuery.data;
	const choices = Array.isArray(question?.choices)
		? [...question.choices].sort(
				(a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id,
			)
		: [];
	const correctChoice = choices.find((choice) => choice.is_correct);
	const questionText = getQuestionText(question, language);
	const categoryLabel = React.useMemo(() => {
		const categoryId = question?.category_id ?? question?.category;
		const category = (categoriesQuery.data ?? []).find(
			(item) => String(item.id) === String(categoryId),
		);

		if (category) {
			return getCategoryTitle(category, language) ?? question?.category_name ?? "";
		}

		return question?.category_name ?? "";
	}, [categoriesQuery.data, language, question]);

	return (
		<Box className="flex-1 pt-safe bg-background">
			<Box className="px-4 my-2 flex-row items-center justify-between">
				<YandexRippleButton onPress={() => router.back()} borderRadius={9999}>
					<GradientIconFrame
						size={48}
						borderRadius={999}
						innerBorderRadius={999}
					>
						<ChevronLeft size={24} color={palette.text} />
					</GradientIconFrame>
				</YandexRippleButton>

				<Box className="items-center">
					<Heading className="text-lg font-semibold" style={{ color: text }}>
						{t("practice.questions.detailTitle", "Question")}
					</Heading>
					<Text className="text-sm" style={{ color: muted }}>
						#{question?.number ?? question?.id ?? questionId}
					</Text>
				</Box>

				<GradientIconFrame
					size={48}
					borderRadius={999}
					innerBorderRadius={999}
				>
					<HelpCircle size={23} color={palette.text} />
				</GradientIconFrame>
			</Box>

			<ScrollView
				showsVerticalScrollIndicator={false}
				overScrollMode="never"
				decelerationRate="normal"
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
			>
				{questionQuery.isLoading ? (
					<Box className="mt-10 items-center justify-center">
						<ActivityIndicator color={palette.text} />
					</Box>
				) : questionQuery.error ? (
					<Box className="mt-4 rounded-3xl bg-card px-4 py-5 border border-destructive/30">
						<Text className="text-sm text-destructive">
							{questionQuery.error instanceof Error
								? questionQuery.error.message
								: t(
										"practice.questions.detailLoadError",
										"Could not load question.",
									)}
						</Text>
						<Pressable className="mt-3" onPress={() => questionQuery.refetch()}>
							<Text className="text-base font-semibold text-primary">
								{t("common.retry", "Retry")}
							</Text>
						</Pressable>
					</Box>
				) : question ? (
					<>
						<Box className="mt-4 rounded-3xl bg-card px-4 py-4">
							<Text className="text-sm text-muted-foreground">
								{categoryLabel}
							</Text>
							<Heading
								className="mt-3 text-xl font-semibold leading-7"
								style={{ color: text }}
							>
								{questionText || t("practice.questions.empty", "Question not found.")}
							</Heading>
						</Box>

						<Box className="mt-4 rounded-3xl bg-card px-4 py-4">
							<Heading className="text-base font-semibold" style={{ color: text }}>
								{t("theory.review.correctAnswer", "Correct answer")}
							</Heading>

							{choices.length > 0 ? (
								<Box className="mt-3 gap-3">
									{choices.map((choice, index) => {
										const isCorrect = choice.id === correctChoice?.id;
										return (
											<Box
												key={choice.id}
												className="rounded-3xl px-4 py-4 flex-row items-start gap-3 bg-background shadow-sm"
												style={
													isCorrect
														? {
																borderColor: correctBorder,
																borderWidth: 2,
															}
														: undefined
												}
											>
												<Box
													className={[
														"h-9 w-9 rounded-full items-center justify-center",
														isCorrect
															? "border-2"
															: "border border-border",
													].join(" ")}
													style={
														isCorrect
															? {
																	backgroundColor: "transparent",
																	borderColor: correctBorder,
																}
															: { backgroundColor: "transparent" }
													}
												>
													{isCorrect ? (
														<Check size={21} color={correctBorder} strokeWidth={2.5} />
													) : (
														<Text className="text-sm font-semibold">
															{String.fromCharCode(65 + index)}
														</Text>
													)}
												</Box>
												<Text
													className={[
														"flex-1 text-base leading-6",
														isCorrect ? "font-semibold" : "",
													].join(" ")}
													style={isCorrect ? { color: correctText } : undefined}
												>
													{getChoiceText(choice, language) ??
														`Variant ${index + 1}`}
												</Text>
											</Box>
										);
									})}
								</Box>
							) : (
								<Text className="mt-3 text-sm text-muted-foreground">
									{t(
										"practice.questions.noChoices",
										"Answer choices were not found.",
									)}
								</Text>
							)}
						</Box>
					</>
				) : null}
			</ScrollView>
		</Box>
	);
}
