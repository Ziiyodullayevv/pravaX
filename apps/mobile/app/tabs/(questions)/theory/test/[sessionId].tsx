import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
	AlertTriangle,
	BookmarkPlus,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	Lightbulb,
	Power,
	Search,
	X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
	BottomSheet,
	BottomSheetBackdrop,
	type BottomSheetController,
	BottomSheetContent,
	BottomSheetDragIndicator,
	BottomSheetPortal,
	BottomSheetScrollView,
} from "@/components/ui/bottomsheet";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
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
import {
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalContent,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { Colors } from "@/constants/Colors";
import {
	AnswerOption,
	QuestionNavigator,
	type AnswerOptionStatus,
	type QuestionNavigatorItem,
} from "@/features/theory/components";
import {
	useDeleteQuizSavedQuestionMutation,
	useAbandonQuizSessionMutation,
	useQuizSavedQuestionsQuery,
	useSaveQuizQuestionMutation,
	useSubmitQuizSessionMutation,
	type QuizQuestion,
	type SubmitQuizAnswerInput,
} from "@/features/quiz/api";
import {
	ANONYMOUS_USER_ID,
	AUTO_ADVANCE_DELAY_MS,
	MIN_TEST_SECONDS,
	SECONDS_PER_QUESTION,
} from "@/features/theory/constants";
import { useTheorySession, useTheoryTestSettings } from "@/features/theory/hooks";
import type { SessionQuestion } from "@/features/theory/types";
import { useI18n } from "@/locales/i18n-provider";
import {
	getFloatingActionBottomOffset,
	getFloatingActionContentPadding,
} from "@/lib/safe-area";

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

function formatClock(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getErrorMessage(err: unknown, fallback: string) {
	if (err instanceof Error && err.message) return err.message;
	if (err && typeof err === "object" && "message" in err) {
		const message = (err as { message?: unknown }).message;
		if (typeof message === "string" && message.trim().length > 0) {
			return message;
		}
	}
	return fallback;
}

function toTimestamp(value?: string | null) {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function mergeSessionQuestions(
	incoming: SessionQuestion[],
	local: SessionQuestion[],
) {
	if (local.length === 0) return incoming;

	const localById = new Map(
		local.map((item) => [item.sessionQuestionId, item] as const),
	);

	return incoming.map((remoteItem) => {
		const localItem = localById.get(remoteItem.sessionQuestionId);
		if (!localItem) return remoteItem;
		if (!localItem.selectedOptionId) return remoteItem;
		if (!remoteItem.selectedOptionId) return localItem;

		const localAnsweredAt = toTimestamp(localItem.answeredAt);
		const remoteAnsweredAt = toTimestamp(remoteItem.answeredAt);

		return localAnsweredAt >= remoteAnsweredAt ? localItem : remoteItem;
	});
}

const DEFAULT_TEST_SECONDS = 20 * 60;
const MOCK_EXAM_WRONG_LIMIT = 3;
const MARATHON_SECONDS_BY_QUESTION_COUNT: Record<number, number> = {
	50: 60 * 60,
	100: 120 * 60,
	150: 180 * 60,
};

function getMarathonDurationSeconds(questionCount: number) {
	const normalizedQuestionCount = Math.max(1, Math.floor(questionCount));
	const mappedSeconds =
		MARATHON_SECONDS_BY_QUESTION_COUNT[normalizedQuestionCount];

	if (typeof mappedSeconds === "number") {
		return mappedSeconds;
	}

	return normalizedQuestionCount * 60;
}

export default function TheorySessionTestScreen() {
	const router = useRouter();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const { colorMode } = useAppTheme();
	const { user } = useAuth();
	const { language, t } = useI18n();
	const effectiveUserId = user?.id ?? ANONYMOUS_USER_ID;
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const primaryForegroundColor = isDark ? "#171717" : "#FAFAFA";
	const savedAccentColor = "#ff9f2f";
	const savedIconColor = isDark ? "#ffffff" : "#111111";
	const bottomActionOffset = getFloatingActionBottomOffset(insets.bottom);
	const savedButtonGradientColors: [string, string, string] = [
		"#ffc85a",
		"#ff9f2f",
		"#ff784b",
	];
	const params = useLocalSearchParams<{
		sessionId?: string;
		auto?: string;
		slug?: string;
		title?: string;
		tokenCost?: string;
	}>();
	const sessionId =
		typeof params.sessionId === "string" ? params.sessionId : "";
	const routeAutoAdvance = useMemo(() => {
		if (params.auto === "1") return true;
		if (params.auto === "0") return false;
		return null;
	}, [params.auto]);

	const { session, isLoading, error, reload } = useTheorySession(
		effectiveUserId,
		sessionId,
		language,
	);
	const { settings: persistedSettings } = useTheoryTestSettings();

	const [questions, setQuestions] = useState<SessionQuestion[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [secondsLeft, setSecondsLeft] = useState(MIN_TEST_SECONDS);
	const [scoreCorrect, setScoreCorrect] = useState(0);
	const [scoreIncorrect, setScoreIncorrect] = useState(0);
	const [isFinalizing, setIsFinalizing] = useState(false);
	const [finalizeError, setFinalizeError] = useState("");
	const [exitError, setExitError] = useState("");
	const [isExitModalOpen, setIsExitModalOpen] = useState(false);
	const [isUnansweredModalOpen, setIsUnansweredModalOpen] = useState(false);
	const [firstUnansweredIndex, setFirstUnansweredIndex] = useState<
		number | null
	>(null);
	const explanationSheetRef = useRef<BottomSheetController | null>(null);
	const didNavigateResultRef = useRef(false);
	const abandonQuizSessionMutation = useAbandonQuizSessionMutation();
	const submitQuizSessionMutation = useSubmitQuizSessionMutation();
	const savedQuestionsQuery = useQuizSavedQuestionsQuery(Boolean(user?.id));
	const saveQuestionMutation = useSaveQuizQuestionMutation();
	const deleteSavedQuestionMutation = useDeleteQuizSavedQuestionMutation();
	const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const answeredQuestionIdsRef = useRef<Set<string>>(new Set());
	const questionsRef = useRef<SessionQuestion[]>([]);
	const hydratedSessionIdRef = useRef<string | null>(null);

	useEffect(() => {
		questionsRef.current = questions;
	}, [questions]);

	useEffect(() => {
		if (!session) return;

		const mergedQuestions = mergeSessionQuestions(
			session.questions,
			questionsRef.current,
		);
		setQuestions(mergedQuestions);
		questionsRef.current = mergedQuestions;

		const nextScoreCorrect = mergedQuestions.filter(
			(item) => item.selectedOptionId && item.isCorrect === true,
		).length;
		const nextScoreIncorrect = mergedQuestions.filter(
			(item) => item.selectedOptionId && item.isCorrect === false,
		).length;
		setScoreCorrect(nextScoreCorrect);
		setScoreIncorrect(nextScoreIncorrect);

		answeredQuestionIdsRef.current = new Set(
			mergedQuestions
				.filter((item) => Boolean(item.selectedOptionId))
				.map((item) => item.sessionQuestionId),
		);

		const isNewSession = hydratedSessionIdRef.current !== session.id;
		if (isNewSession) {
			const firstUnanswered = mergedQuestions.findIndex(
				(item) => !item.selectedOptionId,
			);
			setCurrentIndex(
				firstUnanswered === -1
					? Math.max(mergedQuestions.length - 1, 0)
					: firstUnanswered,
			);

			const duration =
				typeof session.timeLimitMinutes === "number" && session.timeLimitMinutes > 0
					? session.timeLimitMinutes * 60
					: session.mode === "mock_exam"
						? DEFAULT_TEST_SECONDS
						: session.mode === "marathon"
							? getMarathonDurationSeconds(mergedQuestions.length)
							: Math.max(
									MIN_TEST_SECONDS,
									mergedQuestions.length * SECONDS_PER_QUESTION,
								);
			setSecondsLeft(duration);
			didNavigateResultRef.current = false;
			hydratedSessionIdRef.current = session.id;
		} else {
			setCurrentIndex((prev) =>
				clamp(prev, 0, Math.max(mergedQuestions.length - 1, 0)),
			);
		}
	}, [session]);

	useEffect(() => {
		if (questions.length === 0) return;
		const timer = setInterval(() => {
			setSecondsLeft((prev) => Math.max(0, prev - 1));
		}, 1000);
		return () => clearInterval(timer);
	}, [questions.length]);

	useEffect(() => {
		return () => {
			if (autoNextTimerRef.current) {
				clearTimeout(autoNextTimerRef.current);
				autoNextTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (event) => {
			const actionType = event.data.action?.type;
			const isBackAction =
				actionType === "GO_BACK" ||
				actionType === "POP" ||
				actionType === "POP_TO_TOP";

			if (!isBackAction) return;
			event.preventDefault();
			setExitError("");
			setIsExitModalOpen(true);
		});

		return unsubscribe;
	}, [navigation]);

	const totalQuestions = questions.length;
	const safeIndex = clamp(currentIndex, 0, Math.max(totalQuestions - 1, 0));
	const currentQuestion = questions[safeIndex] ?? null;
	const exitHref = useMemo<Href>(() => {
		const routeSlug = typeof params.slug === "string" ? params.slug : "";
		if (routeSlug === "random") {
			return {
				pathname: "/tabs/(questions)/marathon",
				params: { mode: "random", count: "10" },
			};
		}
		if (routeSlug === "marathon" || session?.mode === "marathon") {
			return {
				pathname: "/tabs/(questions)/marathon",
				params: { mode: "marathon" },
			};
		}
		if (!session) return "/tabs/(tabs)/home";
		if (session.topicSlug) {
			return {
				pathname: "/tabs/(questions)/theory/[slug]",
				params: { slug: session.topicSlug },
			};
		}
		return "/tabs/(questions)/theory";
	}, [params.slug, session]);
	const isMockExam = session?.mode === "mock_exam";
	const answeredCount = useMemo(
		() => questions.filter((item) => Boolean(item.selectedOptionId)).length,
		[questions],
	);
	const isLast = safeIndex === totalQuestions - 1;
	const currentExplanation =
		currentQuestion?.selectedOptionId && currentQuestion.explanation
			? currentQuestion.explanation.trim()
			: "";
	const hasCurrentAnswer = Boolean(currentQuestion?.selectedOptionId);
	const savedQuestionIds = useMemo(
		() =>
			new Set(
				(savedQuestionsQuery.data ?? []).map((item) => String(item.question.id)),
			),
		[savedQuestionsQuery.data],
	);
	const isCurrentQuestionSaved = Boolean(
		currentQuestion && savedQuestionIds.has(currentQuestion.questionId),
	);
	const isAbandoningSession = abandonQuizSessionMutation.isPending;

	const handleExitTest = async () => {
		if (isAbandoningSession) return;
		setExitError("");

		if (!session) {
			setIsExitModalOpen(false);
			router.replace(exitHref);
			return;
		}

		try {
			await abandonQuizSessionMutation.mutateAsync(session.id);
			setIsExitModalOpen(false);
			router.replace(exitHref);
		} catch (err) {
			setExitError(
				getErrorMessage(
					err,
					t(
						"theory.session.abandonError",
						"Something went wrong while leaving the test.",
					),
				),
			);
		}
	};

	const questionImages = useMemo(
		() =>
			currentQuestion?.imageUrl
				? [
						{
							url: currentQuestion.imageUrl,
							alt: session?.topicTitle ?? t("theory.questions", "Question"),
						},
					]
				: [],
		[currentQuestion?.imageUrl, session?.topicTitle, t],
	);

	const goToResult = async (
		reason: "completed" | "timeout" | "mistake_limit",
	) => {
		if (!session || didNavigateResultRef.current) return;
		didNavigateResultRef.current = true;
		setFinalizeError("");
		setIsFinalizing(true);

		try {
			const answeredPayload = questions
				.filter((item) => item.selectedOptionId && item.isCorrect !== null)
				.map((item) => ({
					sessionQuestionId: item.sessionQuestionId,
					questionId: item.questionId,
					selectedOptionId: item.selectedOptionId as string,
					isCorrect: Boolean(item.isCorrect),
					answeredAt: item.answeredAt ?? new Date().toISOString(),
				}));

			const localCorrect = answeredPayload.filter(
				(item) => item.isCorrect,
			).length;
			const localIncorrect = answeredPayload.length - localCorrect;
			const submitAnswers: SubmitQuizAnswerInput[] = answeredPayload.map(
				(item) => {
					const question = questions.find(
						(candidate) => candidate.questionId === item.questionId,
					);
					const correctOption = question?.options.find((option) => option.isCorrect);

					return {
						question_id: Number(item.questionId),
						choice_id: Number(item.selectedOptionId),
						correct_choice_id: Number(correctOption?.id ?? item.selectedOptionId),
						status: item.isCorrect,
					};
				},
			);

			await submitQuizSessionMutation.mutateAsync({
				sessionId: session.id,
				answers: submitAnswers,
				finishedAt: new Date().toISOString(),
			});

			setScoreCorrect(localCorrect);
			setScoreIncorrect(localIncorrect);

			router.replace({
				pathname: "/tabs/(questions)/theory/[slug]/result",
				params: {
					sessionId: session.id,
					slug: session.topicSlug ?? params.slug ?? "theory",
					title: session.topicTitle ?? params.title ?? t("theory.title", "Theory"),
					reason,
					...(params.auto ? { auto: params.auto } : {}),
					...(params.tokenCost ? { tokenCost: params.tokenCost } : {}),
				},
			});

		} catch (err) {
			didNavigateResultRef.current = false;
			const message = getErrorMessage(
				err,
				t(
					"theory.session.saveError",
					"Something went wrong while saving the test result.",
				),
			);
			setFinalizeError(message);
		} finally {
			setIsFinalizing(false);
		}
	};

	useEffect(() => {
		if (secondsLeft > 0) return;
		if (!session || totalQuestions === 0) return;
		goToResult("timeout").catch(() => {});
	}, [secondsLeft, session, totalQuestions]);

	useEffect(() => {
		if (!session || totalQuestions === 0) return;
		if (session.mode !== "mock_exam") return;
		if (scoreIncorrect < MOCK_EXAM_WRONG_LIMIT) return;
		if (isFinalizing || didNavigateResultRef.current) return;
		if (autoNextTimerRef.current) {
			clearTimeout(autoNextTimerRef.current);
			autoNextTimerRef.current = null;
		}
		goToResult("mistake_limit").catch(() => {});
	}, [session, totalQuestions, scoreIncorrect, isFinalizing]);

	const handleSelectOption = (optionId: string) => {
		if (!session || !currentQuestion) return;
		if (currentQuestion.selectedOptionId) return;
		if (answeredQuestionIdsRef.current.has(currentQuestion.sessionQuestionId))
			return;

		const selectedOption = currentQuestion.options.find(
			(option) => option.id === optionId,
		);
		if (!selectedOption) return;

		answeredQuestionIdsRef.current.add(currentQuestion.sessionQuestionId);
		const answeredAt = new Date().toISOString();
		setQuestions((prev) => {
			const nextQuestions = prev.map((item) =>
				item.sessionQuestionId === currentQuestion.sessionQuestionId
					? item.selectedOptionId
						? item
						: {
								...item,
								selectedOptionId: optionId,
								isCorrect: selectedOption.isCorrect,
								answeredAt,
							}
					: item,
			);
			questionsRef.current = nextQuestions;
			return nextQuestions;
		});

		if (selectedOption.isCorrect) {
			setScoreCorrect((prev) => prev + 1);
		} else {
			setScoreIncorrect((prev) => prev + 1);
		}

		const shouldAutoAdvance =
			routeAutoAdvance ?? persistedSettings.autoAdvance ?? session.settings.autoAdvance;
		if (shouldAutoAdvance && safeIndex < totalQuestions - 1) {
			if (autoNextTimerRef.current) {
				clearTimeout(autoNextTimerRef.current);
			}
			autoNextTimerRef.current = setTimeout(() => {
				setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
				autoNextTimerRef.current = null;
			}, AUTO_ADVANCE_DELAY_MS);
		}
	};

	const handleToggleSavedQuestion = () => {
		if (!currentQuestion) return;

		if (isCurrentQuestionSaved) {
			deleteSavedQuestionMutation.mutate(currentQuestion.questionId);
			return;
		}

		const optimisticQuestion: QuizQuestion = {
			id: Number(currentQuestion.questionId),
			text_uzl: currentQuestion.prompt,
			category: session?.topicId ? Number(session.topicId) : null,
			category_name: session?.topicTitle ?? null,
		};

		saveQuestionMutation.mutate({
			questionId: currentQuestion.questionId,
			question: optimisticQuestion,
		});
	};

	const handleNext = async () => {
		if (totalQuestions === 0) return;

		if (isLast) {
			if (answeredCount < totalQuestions) {
				const firstUnanswered = questions.findIndex(
					(item) => !item.selectedOptionId,
				);
				if (firstUnanswered >= 0) {
					setCurrentIndex(firstUnanswered);
					setFirstUnansweredIndex(firstUnanswered);
					setIsUnansweredModalOpen(true);
				}
				return;
			}

			await goToResult("completed");
			return;
		}

		setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
	};

	const navigatorItems = useMemo<QuestionNavigatorItem[]>(
		() =>
			questions.map((item, index) => {
				let status: QuestionNavigatorItem["status"] = "default";
				if (index === safeIndex) {
					status = "current";
				} else if (item.selectedOptionId && item.isCorrect === false) {
					status = "wrong";
				} else if (item.selectedOptionId && item.isCorrect === true) {
					status = "correct";
				} else if (item.selectedOptionId) {
					status = "answered";
				}

				return {
					key: item.sessionQuestionId,
					label: String(index + 1),
					status,
				};
			}),
		[questions, safeIndex],
	);

	if (isLoading) {
		return (
			<Box className="flex-1 bg-background items-center justify-center px-6">
				<Heading className="text-2xl font-semibold text-center">
					{t("common.loading", "Loading...")}
				</Heading>
				<Text className="mt-2 text-center text-muted-foreground">
					{t("theory.session.loadingDescription", "Loading test session.")}
				</Text>
			</Box>
		);
	}

	if (error || !session) {
		return (
			<Box className="flex-1 bg-background items-center justify-center px-6">
				<Heading className="text-2xl font-semibold text-center">
					{t("common.error", "Error")}
				</Heading>
				<Text className="mt-2 text-center text-destructive">
					{error || t("theory.session.notFound", "Test session not found.")}
				</Text>
				<Button className="mt-4" onPress={() => reload()}>
					<ButtonText>{t("common.retry", "Retry")}</ButtonText>
				</Button>
			</Box>
		);
	}

	if (!currentQuestion) {
		return (
			<Box className="flex-1 bg-background items-center justify-center px-6">
				<Heading className="text-2xl font-semibold text-center">
					{t("exam.noQuestions", "No questions")}
				</Heading>
				<Text className="mt-2 text-center text-muted-foreground">
					{t("theory.session.empty", "Session has no questions.")}
				</Text>
			</Box>
		);
	}

	return (
		<BottomSheet ref={explanationSheetRef} snapToIndex={0}>
			<Box className="flex-1 bg-background pt-safe">
				<Box className="mt-2">
					<Box className="flex-row px-4 items-center justify-between">
						<Pressable onPress={() => setIsExitModalOpen(true)}>
							<GradientIconFrame
								size={48}
								borderRadius={999}
								innerBorderRadius={999}
							>
								<Power size={22} strokeWidth={2} color={palette.text} />
							</GradientIconFrame>
						</Pressable>

						<Box className="items-center">
							<Heading className="text-lg font-semibold">
								{formatClock(secondsLeft)}
							</Heading>
							<Text className="text-xs text-muted-foreground">
								{totalQuestions} {t("common.questionsWord", "questions")}
							</Text>
						</Box>

						<Pressable onPress={() => explanationSheetRef.current?.open()}>
							<GradientIconFrame
								size={48}
								borderRadius={999}
								innerBorderRadius={999}
								shine={Boolean(currentExplanation)}
							>
								<Lightbulb
									size={20}
									strokeWidth={2}
									color={currentExplanation ? savedAccentColor : palette.text}
								/>
							</GradientIconFrame>
						</Pressable>
					</Box>

					<QuestionNavigator
						items={navigatorItems}
						onPress={(index) => setCurrentIndex(index)}
					/>
				</Box>

				<ScrollView
					className="flex-1 rounded-t-[30px] bg-card"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						flexGrow: 1,
						paddingBottom: getFloatingActionContentPadding(insets.bottom, 132),
					}}
				>
					<Box className="bg-card flex-1 p-4">
						{questionImages.length > 0 ? (
							<ImageViewer images={questionImages}>
								<ImageViewerTrigger className="rounded-2xl overflow-hidden">
									<Box className="relative rounded-2xl overflow-hidden">
										<Box className="w-full h-[220px] rounded-2xl border border-border/40 bg-background items-center justify-center overflow-hidden">
											<Image
												source={{ uri: questionImages[0]?.url }}
												alt={
													questionImages[0]?.alt ??
													t("theory.questions", "Question")
												}
												className="w-full h-full"
												resizeMode="contain"
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
							{currentQuestion.options.map((option, optionIndex) => {
								const isSelected =
									currentQuestion.selectedOptionId === option.id;
								const hasAnswer = Boolean(currentQuestion.selectedOptionId);

								let status: AnswerOptionStatus = "default";
								if (!hasAnswer && isSelected) {
									status = "selected";
								} else if (
									hasAnswer &&
									isSelected &&
									currentQuestion.isCorrect
								) {
									status = "correct";
								} else if (
									hasAnswer &&
									isSelected &&
									currentQuestion.isCorrect === false
								) {
									status = "wrong";
								} else if (
									hasAnswer &&
									currentQuestion.isCorrect === false &&
									option.isCorrect
								) {
									status = "hint-correct";
								}

								return (
									<AnswerOption
										key={option.id}
										label={`F${optionIndex + 1}`}
										text={option.text}
										status={status}
										disabled={hasAnswer || isFinalizing}
										onPress={() => handleSelectOption(option.id)}
									/>
								);
							})}
						</Box>

						{finalizeError ? (
							<Text className="mt-3 text-sm text-destructive">
								{finalizeError}
							</Text>
						) : null}
					</Box>
				</ScrollView>

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
					<Box className="flex-row items-center justify-between gap-3">
						<Box className="flex-row items-center gap-2">
							<Pressable
								onPress={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
								disabled={isFinalizing || safeIndex === 0}
							>
								<GradientIconFrame
									size={48}
									borderRadius={999}
									innerBorderRadius={999}
									style={isFinalizing || safeIndex === 0 ? { opacity: 0.4 } : undefined}
								>
									<ChevronLeft size={20} color={palette.text} />
								</GradientIconFrame>
							</Pressable>

							<Pressable
								onPress={handleToggleSavedQuestion}
								disabled={
									isFinalizing ||
									!currentQuestion
								}
							>
								<GradientIconFrame
									size={48}
									borderRadius={999}
									innerBorderRadius={999}
									colors={
										isCurrentQuestionSaved
											? savedButtonGradientColors
											: undefined
									}
									innerBackgroundColor={
										isCurrentQuestionSaved ? savedAccentColor : undefined
									}
									style={
										isFinalizing || !currentQuestion ? { opacity: 0.4 } : undefined
									}
								>
									<BookmarkPlus
										size={20}
										color={isCurrentQuestionSaved ? savedIconColor : palette.text}
									/>
								</GradientIconFrame>
							</Pressable>
						</Box>

						<Button
							className="h-12 px-8 shadow-hard-1 rounded-2xl bg-primary"
							onPress={handleNext}
							disabled={isFinalizing}
						>
							{isFinalizing ? (
								<ButtonSpinner color={primaryForegroundColor} />
							) : null}
							<ButtonText className="text-base font-semibold text-primary-foreground">
								{isFinalizing
									? t("common.saving", "Saving...")
									: isLast
										? t("common.finish", "Finish")
										: t("common.next", "Next")}
							</ButtonText>
							{isFinalizing ? null : (
								<ChevronRight size={18} color={palette.background} />
							)}
						</Button>
					</Box>
				</Box>

				<BottomSheetPortal
					backgroundStyle={{
						borderTopLeftRadius: 30,
						borderTopRightRadius: 30,
						opacity: 0,
					}}
					snapPoints={["60%", "100%"]}
					enableDynamicSizing={false}
					enableHandlePanningGesture
					enableContentPanningGesture
					enableOverDrag={false}
					topInset={insets.top}
					backdropComponent={(props) => (
						<BottomSheetBackdrop
							{...props}
							appearsOnIndex={0}
							disappearsOnIndex={-1}
						/>
					)}
					handleComponent={(props) => (
						<BottomSheetDragIndicator
							{...props}
							className="rounded-t-[30px] bg-card border-b border-border"
						>
							<Text className="text-lg mt-4 font-medium">
								{/* {t("theory.explanation", "Explanation")} */}
								Tushuntirish
							</Text>
						</BottomSheetDragIndicator>
					)}
				>
					<BottomSheetContent className="px-5 pb-0 bg-card h-full">
						<BottomSheetScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingBottom: Math.max(insets.bottom, 20),
							}}
						>
							{hasCurrentAnswer ? (
								<Box className="w-full px-1 py-3">
									<Text className="mt-2 text-base leading-7 text-justify hyphens-auto text-foreground">
										{currentExplanation}
									</Text>
								</Box>
							) : (
								<Box className="w-full items-center justify-center px-1 py-8">
									<CircleHelp size={72} color="#94a3b8" strokeWidth={1.4} />
									<Text className="mt-4 text-center text-base text-muted-foreground">
										{t(
											"theory.explanationUnavailable",
											"Izoh javob tanlangandan keyin ko'rinadi.",
										)}
									</Text>
								</Box>
							)}
						</BottomSheetScrollView>
					</BottomSheetContent>
				</BottomSheetPortal>

				<Modal
					isOpen={isUnansweredModalOpen}
					onClose={() => setIsUnansweredModalOpen(false)}
					size="lg"
				>
					<ModalBackdrop className="bg-black/45" />
					<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
						<Pressable
							className="absolute right-5 top-5 z-10"
							onPress={() => setIsUnansweredModalOpen(false)}
						>
							<X size={24} color="#8f8f8f" />
						</Pressable>

						<ModalBody className="mt-0 mb-0 pt-8 pb-0">
							<Box className="items-center">
								<Box className="h-20 w-20 rounded-full border-2 border-amber-300 bg-amber-100/70 items-center justify-center">
									<AlertTriangle size={34} color="#d97706" strokeWidth={2.4} />
								</Box>

								<Heading className="mt-8 text-center text-2xl font-bold">
								{t("theory.alert.unansweredTitle", "Questions remain")}
							</Heading>
								<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
									{`${t("theory.alert.unansweredMessagePrefix", "Unanswered question:")} ${(firstUnansweredIndex ?? 0) + 1}`}
								</Text>

								<Pressable
									className="mt-6 w-full"
									onPress={() => setIsUnansweredModalOpen(false)}
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

				<Modal
					isOpen={isExitModalOpen}
					onClose={() => {
						if (!isAbandoningSession) {
							setExitError("");
							setIsExitModalOpen(false);
						}
					}}
					size="lg"
				>
					<ModalBackdrop className="bg-black/45" />
					<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
						<Pressable
							className="absolute right-5 top-5 z-10"
							onPress={() => {
								setExitError("");
								setIsExitModalOpen(false);
							}}
							disabled={isAbandoningSession}
							style={isAbandoningSession ? { opacity: 0.45 } : undefined}
						>
							<X size={24} color="#8f8f8f" />
						</Pressable>

						<ModalBody className="mt-0 mb-0 pt-8 pb-0">
							<Box className="items-center">
								<Box className="h-20 w-20 rounded-full border-2 border-rose-400 items-center justify-center">
									<Power size={34} color="#e11d48" strokeWidth={2.4} />
								</Box>

								<Heading className="mt-8 text-center text-2xl font-bold">
									{t("exam.exit.title", "Exit test")}
								</Heading>

								<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
									{t("exam.exit.message", "Do you want to leave?")}
								</Text>

								{exitError ? (
									<Text className="mt-3 text-center text-sm font-medium text-rose-500">
										{exitError}
									</Text>
								) : null}

								<Box className="mt-6 w-full flex-row gap-3">
									<Pressable
										className="flex-1"
										onPress={() => {
											setExitError("");
											setIsExitModalOpen(false);
										}}
										disabled={isAbandoningSession}
										style={isAbandoningSession ? { opacity: 0.5 } : undefined}
									>
										<Box className="h-12 rounded-2xl bg-card items-center justify-center">
											<Text className="text-base font-semibold">
												{t("exam.exit.cancel", "Cancel")}
											</Text>
										</Box>
									</Pressable>
									<Pressable
										className="flex-1"
										onPress={handleExitTest}
										disabled={isAbandoningSession}
									>
										<Box className="h-12 flex-row gap-2 rounded-2xl bg-[#ff9f2f] items-center justify-center">
											{isAbandoningSession ? (
												<ActivityIndicator color="#1B1203" />
											) : (
												<Text className="text-base font-bold text-[#1B1203]">
													{t("exam.exit.confirm", "Exit")}
												</Text>
											)}
										</Box>
									</Pressable>
								</Box>
							</Box>
						</ModalBody>
					</ModalContent>
				</Modal>
			</Box>
		</BottomSheet>
	);
}
