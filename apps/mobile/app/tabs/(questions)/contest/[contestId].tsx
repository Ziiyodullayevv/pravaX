import React from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
	BookmarkPlus,
	ChevronLeft,
	ChevronRight,
	Lightbulb,
	Power,
	Search,
	Trophy,
	X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import {
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalContent,
} from "@/components/ui/modal";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { Heading } from "@/components/ui/heading";
import { Image } from "@/components/ui/image";
import {
	ImageViewer,
	ImageViewerCloseButton,
	ImageViewerContent,
	ImageViewerCounter,
	ImageViewerNavigation,
	ImageViewerTrigger,
} from "@/components/ui/image-viewer";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import {
	useContestQuestionsQuery,
	useSubmitContestMutation,
	type ContestQuestion,
	type ContestSubmitAnswer,
} from "@/features/contests/api";
import {
	AnswerOption,
	QuestionNavigator,
	type AnswerOptionStatus,
	type QuestionNavigatorItem,
} from "@/features/theory/components";
import type { QuizChoice, QuizQuestion } from "@/features/quiz/api";
import { apiBaseUrl } from "@/lib/api";
import {
	getFloatingActionBottomOffset,
	getFloatingActionContentPadding,
} from "@/lib/safe-area";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

type ContestQuestionItem = {
	choices: QuizChoice[];
	imageUrl: string | null;
	key: string;
	prompt: string;
	questionId: number | string;
};

const pickString = (...values: unknown[]) =>
	values.find(
		(value): value is string => typeof value === "string" && value.trim().length > 0,
	)?.trim();

const pickNumber = (...values: unknown[]) => {
	for (const value of values) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim().length > 0) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}

	return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

const resolveAssetUrl = (value?: string | null) => {
	if (!value) return null;
	if (/^https?:\/\//i.test(value)) return value;
	return `${apiBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
};

const getLocalizedQuestionText = (question: QuizQuestion, language: string) => {
	if (language.startsWith("ru")) {
		return pickString(question.text_ru, question.text_uzl, question.text_uzk);
	}

	if (language.includes("Cyrl")) {
		return pickString(question.text_uzk, question.text_uzl, question.text_ru);
	}

	return pickString(question.text_uzl, question.text_ru, question.text_uzk);
};

const getLocalizedChoiceText = (choice: QuizChoice, language: string) => {
	if (language.startsWith("ru")) {
		return pickString(choice.text_ru, choice.text_uzl, choice.text_uzk);
	}

	if (language.includes("Cyrl")) {
		return pickString(choice.text_uzk, choice.text_uzl, choice.text_ru);
	}

	return pickString(choice.text_uzl, choice.text_ru, choice.text_uzk);
};

const getQuestionPayload = (item: ContestQuestion): QuizQuestion => {
	const record = asRecord(item);
	const nestedQuestion = asRecord(record?.question);

	return (nestedQuestion ?? record ?? {}) as QuizQuestion;
};

const getQuestionImageUrl = (question: QuizQuestion) => {
	const media = Array.isArray(question.media) ? question.media : [];
	const imageMedia = media.find((item) => {
		const record = asRecord(item);
		return (
			record?.media_type === "image" ||
			typeof record?.file === "string" ||
			typeof record?.url === "string"
		);
	});
	const imageRecord = asRecord(imageMedia);

	return resolveAssetUrl(
		pickString(imageRecord?.file, imageRecord?.url, question.image_url, question.image),
	);
};

const mapContestQuestion = (
	item: ContestQuestion,
	index: number,
	language: string,
	t: (key: string, fallback?: string) => string,
): ContestQuestionItem => {
	const itemRecord = asRecord(item);
	const question = getQuestionPayload(item);
	const questionId =
		pickNumber(question.id, itemRecord?.question_id, itemRecord?.id) ??
		String(index + 1);
	const choices = Array.isArray(question.choices)
		? [...question.choices].sort(
				(first, second) =>
					(first.order ?? 0) - (second.order ?? 0) ||
					Number(first.id) - Number(second.id),
			)
		: [];

	return {
		choices,
		imageUrl: getQuestionImageUrl(question),
		key: String(itemRecord?.id ?? questionId),
		prompt:
			getLocalizedQuestionText(question, language) ??
			`${t("common.question", "Savol")} ${index + 1}`,
		questionId,
	};
};

export default function ContestTestScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ contestId?: string; title?: string }>();
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const primaryForegroundColor = isDark ? "#171717" : "#FAFAFA";
	const bottomActionOffset = getFloatingActionBottomOffset(insets.bottom);
	const contestId = typeof params.contestId === "string" ? params.contestId : "";
	const title = typeof params.title === "string" ? params.title : t("contest.title", "Contest");
	const mountReady = useDeferredMount();
	const questionsQuery = useContestQuestionsQuery(contestId, mountReady && contestId.length > 0);
	const submitContestMutation = useSubmitContestMutation();
	const [currentIndex, setCurrentIndex] = React.useState(0);
	const [selectedAnswers, setSelectedAnswers] = React.useState<Record<string, string>>({});
	const [submitError, setSubmitError] = React.useState("");
	const [resultModal, setResultModal] = React.useState<{ score: number; total: number } | null>(null);

	const questions = React.useMemo(
		() =>
			(questionsQuery.data ?? []).map((item, index) =>
				mapContestQuestion(item, index, language, t),
			),
		[language, questionsQuery.data, t],
	);
	const totalQuestions = questions.length;
	const safeIndex = Math.min(currentIndex, Math.max(totalQuestions - 1, 0));
	const currentQuestion = questions[safeIndex] ?? null;
	const selectedChoiceId = currentQuestion
		? selectedAnswers[String(currentQuestion.questionId)]
		: undefined;
	const answeredCount = Object.keys(selectedAnswers).length;
	const scoreCorrect = React.useMemo(
		() =>
			questions.filter((question) => {
				const answer = selectedAnswers[String(question.questionId)];
				const selectedChoice = question.choices.find(
					(choice) => String(choice.id) === answer,
				);

				return selectedChoice?.is_correct === true;
			}).length,
		[questions, selectedAnswers],
	);
	const scoreIncorrect = Math.max(answeredCount - scoreCorrect, 0);
	const isSubmitted = resultModal !== null;
	const navigatorItems = React.useMemo(
		() =>
			questions.map((question, index): QuestionNavigatorItem => {
				const selectedChoice = selectedAnswers[String(question.questionId)];
				const selectedOption = question.choices.find(
					(choice) => String(choice.id) === selectedChoice,
				);

				return {
					key: question.key,
					label: String(index + 1),
					status:
						index === safeIndex
							? "current"
							: selectedOption?.is_correct === true
								? "correct"
								: selectedOption
									? "wrong"
									: "default",
				};
			}),
		[questions, safeIndex, selectedAnswers],
	);

	React.useEffect(() => {
		setCurrentIndex((prev) => Math.min(prev, Math.max(questions.length - 1, 0)));
	}, [questions.length]);

	const handleSelectChoice = (choice: QuizChoice) => {
		if (!currentQuestion || isSubmitted) return;

		setSelectedAnswers((prev) => ({
			...prev,
			[String(currentQuestion.questionId)]: String(choice.id),
		}));
	};

	const handleSubmit = async () => {
		if (totalQuestions === 0 || isSubmitted) return;
		setSubmitError("");

		const answers: ContestSubmitAnswer[] = questions.flatMap((question) => {
			const choiceId = selectedAnswers[String(question.questionId)];
			const selectedChoice = question.choices.find(
				(choice) => String(choice.id) === choiceId,
			);
			const correctChoice = question.choices.find((choice) => choice.is_correct);

			if (!selectedChoice) return [];

			return [
				{
					question_id: question.questionId,
					choice_id: selectedChoice.id,
					selected_choice_id: selectedChoice.id,
					...(correctChoice ? { correct_choice_id: correctChoice.id } : {}),
					...(typeof selectedChoice.is_correct === "boolean"
						? { status: selectedChoice.is_correct }
						: {}),
				},
			];
		});

		if (answers.length === 0) {
			setSubmitError(t("contest.test.selectAnswer", "Kamida bitta savolga javob belgilang."));
			return;
		}

		try {
			const result = await submitContestMutation.mutateAsync({
				contestId,
				answers,
				finishedAt: new Date().toISOString(),
			});
			const localScore = questions.filter((question) => {
				const answer = selectedAnswers[String(question.questionId)];
				const selectedChoice = question.choices.find(
					(choice) => String(choice.id) === answer,
				);

				return selectedChoice?.is_correct === true;
			}).length;
			const score = pickNumber(result.score, result.points, localScore) ?? localScore;
			const total = pickNumber(result.total_questions, totalQuestions) ?? totalQuestions;

			setResultModal({ score, total });
		} catch (error) {
			setSubmitError(
				error instanceof Error && error.message
					? error.message
					: t("contest.test.submitError", "Contest natijasini saqlashda xato yuz berdi."),
			);
		}
	};

	const hasQuestions = !questionsQuery.isLoading && !questionsQuery.error && Boolean(currentQuestion);

	return (
		<Box className="flex-1 pt-safe bg-background">
			<Box className="mt-2">
				<Box className="px-4 flex-row items-center justify-between">
					<Pressable onPress={() => router.back()}>
						<GradientIconFrame
							size={48}
							borderRadius={999}
							innerBorderRadius={999}
						>
							<Power size={22} strokeWidth={2} color={palette.text} />
						</GradientIconFrame>
					</Pressable>

					<Box className="items-center">
						<Heading className="text-lg font-semibold">{title}</Heading>
						<Text className="text-xs text-muted-foreground">
							{totalQuestions > 0
								? `${totalQuestions} ${t("common.questionsWord", "savol")}`
								: t("contest.test.questionsTitle", "Contest savollari")}
						</Text>
					</Box>

					<Pressable>
						<GradientIconFrame
							size={48}
							borderRadius={999}
							innerBorderRadius={999}
						>
							<Lightbulb size={20} strokeWidth={2} color={palette.text} />
						</GradientIconFrame>
					</Pressable>
				</Box>

				{hasQuestions && (
					<QuestionNavigator
						items={navigatorItems}
						onPress={setCurrentIndex}
					/>
				)}
			</Box>

			{questionsQuery.isLoading ? (
				<Box className="flex-1 items-center justify-center px-6">
					<ActivityIndicator color={palette.text} />
					<Text className="mt-3 text-center text-muted-foreground">
						{t("practice.questions.loading", "Savollar yuklanmoqda")}
					</Text>
				</Box>
			) : questionsQuery.error ? (
				<Box className="flex-1 items-center justify-center px-6">
					<Heading className="text-xl font-semibold text-center">
						{t("contest.test.openErrorTitle", "Savollar ochilmadi")}
					</Heading>
					<Text className="mt-2 text-center text-destructive">
						{questionsQuery.error instanceof Error
							? questionsQuery.error.message
							: t("contest.test.loadError", "Contest savollarini olishda xato yuz berdi.")}
					</Text>
					<Pressable className="mt-4" onPress={() => questionsQuery.refetch()}>
						<Text className="text-base font-semibold text-primary">
							{t("common.retry", "Qayta urinish")}
						</Text>
					</Pressable>
				</Box>
			) : !currentQuestion ? (
				<Box className="flex-1 items-center justify-center px-6">
					<Heading className="text-xl font-semibold text-center">
						{t("exam.noQuestions", "Savollar topilmadi")}
					</Heading>
					<Text className="mt-2 text-center text-muted-foreground">
						{t(
							"contest.test.emptyDescription",
							"Contestga savollar biriktirilmagan yoki backend savollar ro'yxatini bo'sh qaytardi.",
						)}
					</Text>
				</Box>
			) : (
				<ScrollView
					className="flex-1 rounded-t-[30px] bg-card"
					showsVerticalScrollIndicator={false}
					overScrollMode="never"
					decelerationRate="normal"
					contentContainerStyle={{
						flexGrow: 1,
						paddingBottom: getFloatingActionContentPadding(insets.bottom, 132),
					}}
				>
						<Box className="bg-card flex-1 p-4">
							{currentQuestion.imageUrl ? (
								<ImageViewer
									images={[
										{
											alt: currentQuestion.prompt,
											url: currentQuestion.imageUrl,
										},
									]}
								>
									<ImageViewerTrigger className="rounded-2xl overflow-hidden">
										<Box className="relative rounded-2xl overflow-hidden">
											<Box className="w-full h-[220px] rounded-2xl border border-border/40 bg-background items-center justify-center overflow-hidden">
												<Image
													alt="Contest question"
													className="h-full w-full"
													resizeMode="contain"
													source={{ uri: currentQuestion.imageUrl }}
												/>
											</Box>
											<Box
												pointerEvents="none"
												className="absolute right-3 bottom-3 h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/35"
											>
												<Search size={14} color="#ffffff" />
											</Box>
										</Box>
									</ImageViewerTrigger>

									<ImageViewerContent>
										<ImageViewerCloseButton />
										<ImageViewerNavigation />
										<ImageViewerCounter />
									</ImageViewerContent>
								</ImageViewer>
							) : null}

							<Heading className="mt-4 text-xl font-semibold">
								{currentQuestion.prompt}
							</Heading>

							<Box className="mt-4 gap-3">
								{currentQuestion.choices.map((choice, index) => {
									let status: AnswerOptionStatus = "default";
									const hasAnswer = Boolean(selectedChoiceId);
									const isSelected = selectedChoiceId === String(choice.id);

									if (!hasAnswer && isSelected) {
										status = "selected";
									} else if (hasAnswer && isSelected && choice.is_correct) {
										status = "correct";
									} else if (hasAnswer && isSelected && !choice.is_correct) {
										status = "wrong";
									} else if (hasAnswer && !isSelected && choice.is_correct) {
										status = "hint-correct";
									}

									return (
										<AnswerOption
											key={choice.id}
											label={`F${index + 1}`}
											text={
												getLocalizedChoiceText(choice, language) ??
												`${t("common.option", "Variant")} ${index + 1}`
											}
											status={status}
											disabled={isSubmitted || hasAnswer}
											onPress={() => handleSelectChoice(choice)}
										/>
									);
								})}
							</Box>

							{submitError ? (
								<Box className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
									<Text className="text-sm text-destructive">{submitError}</Text>
								</Box>
							) : null}

						</Box>
					</ScrollView>
			)}

			{hasQuestions && (
				<>
					<LinearGradient
						pointerEvents="none"
						colors={
							isDark
								? ["rgba(0,0,0,0)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.78)"]
								: [
										"rgba(255,255,255,0)",
										"rgba(255,255,255,0.5)",
										"rgb(255,255,255)",
									]
						}
						start={{ x: 0.5, y: 0.16 }}
						end={{ x: 0.5, y: 1 }}
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: 0,
							height: 132,
						}}
					/>

					<Box
						className="absolute left-0 right-0 px-7"
						style={{ bottom: bottomActionOffset }}
					>
						<Box className="flex-row items-center justify-between mb-3 px-1">
							<Text className="text-sm text-muted-foreground">
								{t("common.correct", "To'g'ri")}: {scoreCorrect}
							</Text>
							<Text className="text-sm text-muted-foreground">
								{t("common.incorrect", "Noto'g'ri")}: {scoreIncorrect}
							</Text>
						</Box>

						<Box className="flex-row items-center justify-between gap-3">
							<Box className="flex-row items-center gap-2">
								<Pressable
									onPress={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
									disabled={safeIndex === 0 || submitContestMutation.isPending}
								>
									<GradientIconFrame
										size={48}
										borderRadius={999}
										innerBorderRadius={999}
										style={
											safeIndex === 0 || submitContestMutation.isPending
												? { opacity: 0.4 }
												: undefined
										}
									>
										<ChevronLeft size={20} color={palette.text} />
									</GradientIconFrame>
								</Pressable>

								<GradientIconFrame
									size={48}
									borderRadius={999}
									innerBorderRadius={999}
									style={{ opacity: 0.5 }}
								>
									<BookmarkPlus size={20} color={palette.text} />
								</GradientIconFrame>
							</Box>

							{safeIndex === totalQuestions - 1 ? (
								<Button
									className="h-12 px-8 shadow-hard-1 rounded-2xl bg-primary"
									disabled={submitContestMutation.isPending || isSubmitted}
									onPress={handleSubmit}
								>
									{submitContestMutation.isPending ? (
										<ButtonSpinner color={primaryForegroundColor} />
									) : null}
									<ButtonText className="text-base font-semibold text-primary-foreground">
										{submitContestMutation.isPending
											? t("common.saving", "Saqlanmoqda...")
											: t("common.finish", "Yakunlash")}
									</ButtonText>
									{submitContestMutation.isPending ? null : (
										<ChevronRight size={18} color={palette.background} />
									)}
								</Button>
							) : (
								<Button
									className="h-12 px-8 shadow-hard-1 rounded-2xl bg-primary"
									onPress={() =>
										setCurrentIndex((prev) =>
											Math.min(prev + 1, totalQuestions - 1),
										)
									}
								>
									<ButtonText className="text-base font-semibold text-primary-foreground">
										{t("common.next", "Keyingi")}
									</ButtonText>
									<ChevronRight size={18} color={palette.background} />
								</Button>
							)}
						</Box>
					</Box>
				</>
			)}

			<Modal
				isOpen={resultModal !== null}
				onClose={() => {}}
				size="lg"
			>
				<ModalBackdrop className="bg-black/45" />
				<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
					<ModalBody className="mt-0 mb-0 pt-8 pb-0">
						<Box className="items-center">
							<Box className="h-20 w-20 rounded-full border-2 border-[#ffb347] bg-[#ff9f2f]/10 items-center justify-center">
								<Trophy size={38} color="#ff9f2f" strokeWidth={2.3} />
							</Box>

							<Heading className="mt-8 text-center text-2xl font-bold">
								{t("contest.result.doneTitle", "Test yakunlandi!")}
							</Heading>

							<Text className="mt-3 text-center text-[17px] font-semibold" style={{ color: "#ff9f2f" }}>
								{resultModal ? `${resultModal.score} / ${resultModal.total}` : ""}
							</Text>

							<Text className="mt-2 text-center text-base leading-6 text-muted-foreground">
								{t("contest.result.savedNote", "Natijangiz saqlandi. Reyting yangilanganida bu yerda ko'rinadi.")}
							</Text>

							<Pressable
								className="mt-6 w-full"
								onPress={() => {
									setResultModal(null);
									router.back();
								}}
							>
								<Box className="h-12 rounded-2xl bg-[#ff9f2f] items-center justify-center">
									<Text className="text-base font-bold text-[#1B1203]">
										{t("common.understood", "Tushundim")}
									</Text>
								</Box>
							</Pressable>
						</Box>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Box>
	);
}
