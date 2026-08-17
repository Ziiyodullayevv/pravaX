import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, type DimensionValue } from "react-native";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
	ChevronDown,
	ChevronLeft,
	ChevronUp,
	RotateCcw,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import {
	Accordion,
	AccordionContent,
	AccordionHeader,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Box } from "@/components/ui/box";
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
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/ui/image";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { ANONYMOUS_USER_ID } from "@/features/theory/constants";
import { useTheorySession, useTheoryTestSettings } from "@/features/theory/hooks";
import {
	useQuizCategoriesPayloadQuery,
	useStartQuizPracticeSessionMutation,
	useStartQuizSessionMutation,
	useStartQuizTestSessionMutation,
} from "@/features/quiz/api";
import {
	getCategorySlug,
	getCategoryTitle,
	toNumber,
} from "@/features/theory/backend-mappers";
import { useI18n } from "@/locales/i18n-provider";
import {
	getFloatingActionBottomOffset,
	getFloatingActionContentPadding,
} from "@/lib/safe-area";

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

type ReviewAccordionHeaderProps = {
	index: number;
	metaText: string;
	prompt: string;
	isExpanded: boolean;
	arrowColor: string;
	statusColor?: string;
};

function ReviewAccordionHeader({
	index,
	metaText,
	prompt,
	isExpanded,
	arrowColor,
	statusColor,
}: ReviewAccordionHeaderProps) {
	const progress = useSharedValue(isExpanded ? 1 : 0);

	React.useEffect(() => {
		progress.value = withTiming(isExpanded ? 1 : 0, {
			duration: 230,
			easing: Easing.out(Easing.cubic),
		});
	}, [isExpanded, progress]);

	const titleMoveStyle = useAnimatedStyle(() => {
		return {
			marginLeft: interpolate(progress.value, [0, 1], [42, 0]),
			marginTop: interpolate(progress.value, [0, 1], [2, 8]),
		};
	});

	return (
		<Box className="w-full">
			<Box className="flex-row w-full items-center">
				<Box
					className={[
						"h-[34px] w-[34px] rounded-full items-center justify-center",
						statusColor ? "" : "bg-card",
					].join(" ")}
					style={statusColor ? { backgroundColor: statusColor + "20" } : undefined}
				>
					<Text
						className="text-xs font-semibold"
						style={statusColor ? { color: statusColor } : undefined}
					>
						{index + 1}
					</Text>
				</Box>

				<Box className="ml-2 flex-1">
					<Text
						className="text-xs font-medium"
						style={{ color: statusColor ?? undefined }}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{metaText}
					</Text>
				</Box>

				<Box className="ml-2">
					{isExpanded ? (
						<ChevronUp size={22} color={arrowColor} />
					) : (
						<ChevronDown size={22} color={arrowColor} />
					)}
				</Box>
			</Box>

			<Animated.View style={titleMoveStyle}>
				<Text
					className="text-sm font-medium leading-5 text-foreground"
					numberOfLines={isExpanded ? undefined : 1}
					ellipsizeMode="tail"
				>
					{prompt}
				</Text>
			</Animated.View>
		</Box>
	);
}

export default function TheoryResultScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colorMode } = useAppTheme();
	const { user } = useAuth();
	const { language, t } = useI18n();
	const effectiveUserId = user?.id ?? ANONYMOUS_USER_ID;
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const bottomActionOffset = getFloatingActionBottomOffset(insets.bottom);
	const footerBorderGradientColors: [string, string, string] = isDark
		? [
				"rgba(92,92,92,0.56)",
				"rgba(37,37,37,0.72)",
				"rgba(82,82,82,0.5)",
			]
		: [
				"rgba(232,232,232,0.58)",
				"rgba(245,245,245,0.98)",
				"rgba(232,232,232,0.46)",
			];

	const params = useLocalSearchParams<{
		slug?: string;
		title?: string;
		topicId?: string;
		sessionId?: string;
		reason?: string;
		auto?: string;
		tokenCost?: string;
	}>();

	const currentSlug = params.slug ?? "road-and-traffic-signs";
	const sessionId =
		typeof params.sessionId === "string" ? params.sessionId : "";
	const { settings: testSettings } = useTheoryTestSettings();
	const isTimeout = params.reason === "timeout";
	const isMistakeLimit = params.reason === "mistake_limit";
	const restartAutoAdvance =
		params.auto === "1"
			? true
			: params.auto === "0"
				? false
				: testSettings.autoAdvance;
	const topicTitle = params.title ?? t("theory.title", "Theory");
	const reviewSheetRef = useRef<BottomSheetController | null>(null);
	const [expandedReviewItems, setExpandedReviewItems] = useState<string[]>([]);
	const [restartError, setRestartError] = useState("");
	const startQuizSessionMutation = useStartQuizSessionMutation();
	const startQuizTestSessionMutation = useStartQuizTestSessionMutation();
	const startQuizPracticeSessionMutation = useStartQuizPracticeSessionMutation();
	const categoriesQuery = useQuizCategoriesPayloadQuery(Boolean(user?.id));
	const {
		session: reviewSession,
		isLoading: reviewLoading,
		error: reviewError,
	} = useTheorySession(effectiveUserId, sessionId, language);
	const hasBackendResult = Boolean(reviewSession);
	const backendPercent =
		typeof reviewSession?.percentage === "number"
			? Math.round(reviewSession.percentage)
			: null;
	const percent = clamp(backendPercent ?? 0, 0, 100);
	const passed =
		typeof reviewSession?.isPassed === "boolean"
			? reviewSession.isPassed
			: false;
	const isMockResult =
		reviewSession?.mode === "mock_exam" || currentSlug === "mock-exam";
	const isMarathonResult =
		reviewSession?.mode === "marathon" || currentSlug === "marathon";
	const isRandomResult = currentSlug === "random";
	const isMistakesResult =
		reviewSession?.mode === "mistakes_practice" || currentSlug === "mistakes";
	const isExamStyleResult =
		isMockResult || isMarathonResult || isMistakesResult;
	const isRestarting =
		startQuizSessionMutation.isPending ||
		startQuizTestSessionMutation.isPending ||
		startQuizPracticeSessionMutation.isPending;

	const tokenCost = params.tokenCost ? Number(params.tokenCost) : null;
	const tokenPassed = passed && percent >= 80;
	const showTokenSummary = tokenCost !== null && tokenCost > 0 && hasBackendResult;

	const scoreWidth = useMemo<DimensionValue>(
		() => `${clamp(percent, 0, 100)}%`,
		[percent],
	);
	const reviewQuestions = useMemo(
		() =>
			[...(reviewSession?.questions ?? [])].sort(
				(a, b) => a.position - b.position,
			),
		[reviewSession?.questions],
	);
	const nextTheoryTopic = useMemo(() => {
		if (isExamStyleResult || isRandomResult || !reviewSession?.topicId) {
			return null;
		}

		const categories = [...(categoriesQuery.data?.sections ?? [])].sort(
			(a, b) =>
				toNumber(a.order) - toNumber(b.order) ||
				String(a.id).localeCompare(String(b.id)),
		);
		const currentIndex = categories.findIndex(
			(category) => String(category.id) === String(reviewSession.topicId),
		);
		if (currentIndex < 0) return null;

		const nextCategory = categories[currentIndex + 1];
		if (!nextCategory) return null;

		const title =
			getCategoryTitle(nextCategory, language) ??
			`${t("theory.sectionSubtitle", "Bo'lim")} ${currentIndex + 2}`;

		return {
			slug: getCategorySlug(nextCategory, title),
			title,
		};
	}, [
		categoriesQuery.data?.sections,
		isExamStyleResult,
		isRandomResult,
		language,
		reviewSession?.topicId,
		t,
	]);

	const restartCurrentTopic = async () => {
		if (isRestarting) {
			return;
		}

		setRestartError("");

		try {
			if (isMockResult) {
				const session = await startQuizTestSessionMutation.mutateAsync();
				router.replace({
					pathname: "/tabs/(questions)/theory/test/[sessionId]",
					params: {
						sessionId: String(session.id),
						auto: restartAutoAdvance ? "1" : "0",
					},
				});
				return;
			}

			if (isRandomResult || isMarathonResult) {
				const count = reviewSession?.totalQuestions || (isRandomResult ? 10 : 50);
				const session = await startQuizPracticeSessionMutation.mutateAsync({
					count: count === 100 || count === 150 ? count : isRandomResult ? 10 : 50,
					mode: isRandomResult ? "practice" : "marathon",
				});
				router.replace({
					pathname: "/tabs/(questions)/theory/test/[sessionId]",
					params: {
						sessionId: String(session.id),
						slug: isRandomResult ? "random" : "marathon",
						title: topicTitle,
						auto: restartAutoAdvance ? "1" : "0",
					},
				});
				return;
			}

			if (reviewSession?.topicId) {
				const session = await startQuizSessionMutation.mutateAsync({
					categoryId: reviewSession.topicId,
				});
				router.replace({
					pathname: "/tabs/(questions)/theory/test/[sessionId]",
					params: {
						sessionId: String(session.id),
						auto: restartAutoAdvance ? "1" : "0",
					},
				});
				return;
			}

			router.replace({
				pathname: "/tabs/(questions)/theory/[slug]",
				params: {
					slug: currentSlug,
					title: topicTitle,
				},
			});
		} catch (err) {
			setRestartError(
				err instanceof Error
					? err.message
					: t("common.error", "Something went wrong."),
			);
		}
	};

	const reviewAnswers = () => {
		reviewSheetRef.current?.open();
	};

	const handleBackPress = () => {
		if (isRandomResult) {
			router.replace({
				pathname: "/tabs/(questions)/marathon",
				params: { mode: "random", count: "10" },
			});
			return;
		}

		if (isMarathonResult) {
			router.replace({
				pathname: "/tabs/(questions)/marathon",
				params: { mode: "marathon" },
			});
			return;
		}

		if (isMockResult) {
			router.replace("/tabs/(questions)/exam");
			return;
		}

		if (isMistakesResult) {
			router.replace("/tabs/(questions)/mistakes");
			return;
		}

		router.replace("/tabs/(questions)/theory");
	};

	const goToNextTheoryTopic = () => {
		if (nextTheoryTopic) {
			router.replace({
				pathname: "/tabs/(questions)/theory/[slug]",
				params: {
					slug: nextTheoryTopic.slug,
					title: nextTheoryTopic.title,
				},
			});
			return;
		}

		router.replace("/tabs/(questions)/theory");
	};

	const statusImage = isExamStyleResult
		? passed
			? require("../../../../../assets/images/status/status-success-2.png")
			: require("../../../../../assets/images/status/status-mistake-2.png")
		: passed
			? require("../../../../../assets/images/status/status-success-1.webp")
			: require("../../../../../assets/images/status/status-mistake-1.avif");

	return (
		<BottomSheet ref={reviewSheetRef} snapToIndex={0}>
			<Box className="flex-1 bg-background pt-safe">
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

					<Heading className="text-lg font-semibold">
						{t("common.results", "Results")}
					</Heading>

					<Box>
						<YandexRippleButton
							onPress={() => {
								restartCurrentTopic().catch(() => {});
							}}
							disabled={isRestarting}
							borderRadius={9999}
						>
							<GradientIconFrame
								size={48}
								borderRadius={999}
								innerBorderRadius={999}
								style={isRestarting ? { opacity: 0.5 } : undefined}
							>
								<RotateCcw size={24} color={palette.text} />
							</GradientIconFrame>
						</YandexRippleButton>
					</Box>
				</Box>

				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{
						paddingHorizontal: 16,
						paddingBottom: getFloatingActionContentPadding(insets.bottom, 116),
					}}
				>
					<Box className="items-center mt-3">
						{restartError ? (
							<Box className="mb-3 rounded-2xl border border-destructive/30 px-3 py-2">
								<Text className="text-sm text-destructive">{restartError}</Text>
							</Box>
						) : null}

						<Image
							className="h-[210px] w-[210px]"
							source={statusImage}
							alt="result"
							resizeMode="contain"
						/>

						<Heading className="mt-4 text-3xl font-semibold">
							{!hasBackendResult && reviewLoading
								? t("common.loading", "Loading...")
								: !hasBackendResult
									? t("theory.result.notFoundTitle", "Natija topilmadi")
								: passed
									? t("theory.result.passedTitle", "Test passed!")
									: t("theory.result.failedTitle", "Test failed")}
						</Heading>

						<Text className="mt-2 text-base text-center text-muted-foreground px-10">
							{!hasBackendResult && reviewLoading
								? t(
										"theory.result.loadingDescription",
										"Natija yuklanmoqda.",
									)
								: !hasBackendResult
									? reviewError ||
										t(
											"theory.result.notFoundDescription",
											"Sessiya natijasi topilmadi.",
										)
								: passed
									? t(
											"theory.result.passedDescription",
											"You've passed this test and unlocked your next learning step",
										)
									: isMistakeLimit
										? t(
												"theory.result.mistakeLimitDescription",
												"You reached 3 incorrect answers. The test ended automatically.",
											)
										: isTimeout
											? t(
													"theory.result.timeoutDescription",
													"Time is over. Review your answers and try again.",
												)
											: t(
													"theory.result.failedDescription",
													"You did not reach the pass mark. Review and retry.",
												)}
						</Text>
					</Box>

					<Box className="mt-9">
						<Heading className="text-center text-3xl font-semibold">
							{percent}%
						</Heading>

						<Box className="mt-4 px-1">
							<Box className="flex-row items-center justify-between">
								<Text className="text-sm text-muted-foreground">0</Text>
								<Text className="text-sm text-muted-foreground">100</Text>
							</Box>

							<Box className="mt-2 relative">
								<Box className="p-1.5 bg-foreground/10 rounded-full">
									<Box className="h-2 rounded-full bg-white overflow-hidden">
										<Box
											className={[
												"h-full rounded-full",
												passed ? "bg-brand" : "bg-destructive",
											].join(" ")}
											style={{ width: scoreWidth }}
										/>
									</Box>
								</Box>
							</Box>
						</Box>
					</Box>

					{showTokenSummary ? (
						<Box className="mt-5 mx-1 rounded-2xl bg-card overflow-hidden">
							{/* Spent row */}
							<Box className="flex-row items-center px-4 py-3 border-b border-border/50">
								<Box
									style={{
										width: 32,
										height: 32,
										borderRadius: 16,
										backgroundColor: isDark
											? "rgba(255,159,47,0.18)"
											: "rgba(255,159,47,0.12)",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Text style={{ fontSize: 14 }}>⚡</Text>
								</Box>
								<Text className="ml-3 flex-1 text-sm font-medium">
									{t("tokenResult.spent", "Sarflandi")}
								</Text>
								<Text
									className="text-sm font-bold"
									style={{ color: "#ff9f2f" }}
								>
									{tokenCost} {t("tokenConfirm.tokenWord", "token")}
								</Text>
							</Box>

							{/* Refund row */}
							<Box className="flex-row items-center px-4 py-3 border-b border-border/50">
								<Box
									style={{
										width: 32,
										height: 32,
										borderRadius: 16,
										backgroundColor: tokenPassed
											? isDark
												? "rgba(16,185,129,0.18)"
												: "rgba(16,185,129,0.12)"
											: isDark
												? "rgba(244,67,54,0.14)"
												: "rgba(244,67,54,0.08)",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Text style={{ fontSize: 14 }}>
										{tokenPassed ? "✅" : "❌"}
									</Text>
								</Box>
								<Text className="ml-3 flex-1 text-sm font-medium">
									{t("tokenResult.refund", "Qaytarildi")}
								</Text>
								<Text
									className="text-sm font-semibold"
									style={{ color: tokenPassed ? "#10b981" : "#ef4444" }}
								>
									{tokenPassed
										? `+${tokenCost} ${t("tokenConfirm.tokenWord", "token")}`
										: t("tokenResult.noRefund", "Qaytarilmadi")}
								</Text>
							</Box>

							{/* Bonus row */}
							<Box className="flex-row items-center px-4 py-3">
								<Box
									style={{
										width: 32,
										height: 32,
										borderRadius: 16,
										backgroundColor: tokenPassed
											? isDark
												? "rgba(59,130,246,0.18)"
												: "rgba(59,130,246,0.10)"
											: isDark
												? "rgba(100,100,100,0.14)"
												: "rgba(100,100,100,0.08)",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Text style={{ fontSize: 14 }}>🎁</Text>
								</Box>
								<Text className="ml-3 flex-1 text-sm font-medium">
									{t("tokenResult.bonus", "Bonus")}
								</Text>
								<Text
									className="text-sm font-semibold"
									style={{
										color: tokenPassed ? "#3b82f6" : (isDark ? "#666" : "#aaa"),
									}}
								>
									{tokenPassed
										? t("tokenResult.bonusEarned", "Berildi ✨")
										: t("tokenResult.bonusNotEarned", "—")}
								</Text>
							</Box>
						</Box>
					) : null}
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
						height: 116,
					}}
				/>

				<Box
					className="absolute left-0 right-0 px-7"
					style={{ bottom: bottomActionOffset }}
				>
					<Box className="flex-row items-center gap-3">
						<Pressable className="flex-1" onPress={reviewAnswers}>
							<LinearGradient
								colors={footerBorderGradientColors}
								start={{ x: 1, y: 1 }}
								end={{ x: 0, y: 0 }}
								style={{
									borderRadius: 18,
									height: 56,
									padding: 0.7,
								}}
							>
								<Box
									className="flex-1 items-center justify-center bg-card"
									style={{ borderRadius: 17.3 }}
								>
									<Text
										className="text-base font-semibold text-foreground text-center px-2"
										numberOfLines={1}
										ellipsizeMode="tail"
									>
										{t("common.reviewAnswers", "Review answers")}
									</Text>
								</Box>
							</LinearGradient>
						</Pressable>
						{!isExamStyleResult && !isRandomResult ? (
							<Pressable className="flex-1" onPress={goToNextTheoryTopic}>
								<Box className="h-14 rounded-2xl bg-primary items-center justify-center">
									<Text
										className="text-base font-semibold text-primary-foreground text-center px-2"
										numberOfLines={1}
										ellipsizeMode="tail"
									>
										{nextTheoryTopic
											? t("common.nextTest", "Keyingi test")
											: t("theory.title", "Nazariya")}
									</Text>
								</Box>
							</Pressable>
						) : null}
					</Box>
				</Box>

				<BottomSheetPortal
					backgroundStyle={{
						borderTopLeftRadius: 30,
						borderTopRightRadius: 30,
						opacity: 0,
					}}
					snapPoints={["72%", "100%"]}
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
							indicatorStyle={{
								backgroundColor: isDark ? "#ffffff" : "#111111",
							}}
						>
							<Text className="text-lg mt-4 font-medium">
								{t("common.reviewAnswers", "Review answers")}
							</Text>
						</BottomSheetDragIndicator>
					)}
				>
					<BottomSheetContent className=" pb-0 bg-card h-full">
						<BottomSheetScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingBottom: Math.max(insets.bottom, 20),
							}}
						>
							{reviewLoading ? (
								<Text className="mt-1 text-sm text-muted-foreground">
									{t("common.loading", "Loading...")}
								</Text>
							) : reviewQuestions.length === 0 ? (
								<Text className="mt-1 text-sm text-muted-foreground">
									{t("theory.review.empty", "Javoblar ro'yxati topilmadi.")}
								</Text>
							) : (
								<Accordion
									type="single"
									isCollapsible
									isDisabled={false}
									value={expandedReviewItems}
									onValueChange={setExpandedReviewItems}
									className="w-full"
								>
									{reviewQuestions.map((question, questionIndex) => {
										const selectedOptionIndex = question.options.findIndex(
											(option) => option.id === question.selectedOptionId,
										);
										const itemId = question.sessionQuestionId;
										const isExpanded = expandedReviewItems.includes(itemId);
										const questionMetaLabel = `${t(
											"common.question",
											"Savol",
										)} ${questionIndex + 1}`;
										const isAnswered = selectedOptionIndex >= 0;
										const isCorrectAnswer =
											isAnswered && question.isCorrect === true;
										const answerSummary = isAnswered
											? `F${selectedOptionIndex + 1} — ${isCorrectAnswer ? t("theory.correct", "To'g'ri") : t("theory.incorrect", "Noto'g'ri")}`
											: t(
													"theory.alert.unansweredMessagePrefix",
													"Hali javob berilmagan savol:",
												).replace(/:\s*$/, "");
										const statusColor = isAnswered
											? isCorrectAnswer
												? "#0f8b5f"
												: "#ef4444"
											: "#f59e0b";

										return (
											<AccordionItem
												key={itemId}
												value={itemId}
												className="mt-3 rounded-3xl mx-4 bg-background px-3 shadow-md/20"
											>
												<AccordionHeader className="py-3 items-center">
													<AccordionTrigger className="gap-0">
														<ReviewAccordionHeader
															index={questionIndex}
															metaText={`${questionMetaLabel} • ${answerSummary}`}
															prompt={question.prompt}
															isExpanded={isExpanded}
															arrowColor={palette.tabIconDefault}
															statusColor={statusColor}
														/>
													</AccordionTrigger>
												</AccordionHeader>
												<AccordionContent className="pt-1 pb-4">
													{question.imageUrl ? (
														<Box className="rounded-2xl overflow-hidden border border-border/40 bg-card">
															<Image
																source={{ uri: question.imageUrl }}
																alt={question.prompt}
																className="w-full h-[190px]"
																resizeMode="contain"
															/>
														</Box>
													) : null}

													<Box className="mt-3 gap-2">
														{question.options.map((option, optionIndex) => {
															const isSelected =
																question.selectedOptionId === option.id;
															const isWrongSelection =
																isSelected && !option.isCorrect;
															const isCorrectSelection =
																isSelected && option.isCorrect;
															const isMissedCorrect =
																!isSelected && option.isCorrect;

															return (
																<Box
																	key={option.id}
																	className={[
																		"rounded-2xl border px-3 py-3",
																		isWrongSelection
																			? "border-destructive bg-destructive/10"
																			: isCorrectSelection
																				? "border-brand bg-brand/15"
																				: isMissedCorrect
																					? "border-brand/60 bg-brand/5"
																					: "border-border bg-card",
																	].join(" ")}
																>
																	<Text className="text-sm font-medium text-foreground">
																		{`F${optionIndex + 1}. ${option.text}`}
																	</Text>
																	{isSelected ? (
																		<Text className="mt-1 text-xs text-muted-foreground">
																			{t(
																				"theory.review.yourAnswer",
																				"Sizning javobingiz",
																			)}
																		</Text>
																	) : null}
																	{isMissedCorrect ? (
																		<Text className="mt-1 text-xs text-brand">
																			{t(
																				"theory.review.correctAnswer",
																				"To'g'ri javob",
																			)}
																		</Text>
																	) : null}
																</Box>
															);
														})}
													</Box>
												</AccordionContent>
											</AccordionItem>
										);
									})}
								</Accordion>
							)}
						</BottomSheetScrollView>
					</BottomSheetContent>
				</BottomSheetPortal>
			</Box>
		</BottomSheet>
	);
}
