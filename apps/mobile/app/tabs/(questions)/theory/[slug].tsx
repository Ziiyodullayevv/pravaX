import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
	ChevronLeft,
	ChevronRight,
	CircleCheck,
	CircleHelp,
	CircleX,
	RotateCcw,
	Sparkles,
	Zap,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { ProgressRing, ToggleRow } from "@/features/theory/components";
import {
	useTheoryTopicDetail,
	useTheoryTestSettings,
} from "@/features/theory/hooks";
import { getTopicIllustration } from "@/features/theory/ui-mappers";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import { Icon } from "@/components/ui/icon";
import { useStartQuizSessionMutation } from "@/features/quiz/api";
import {
	getFloatingActionBottomOffset,
	getFloatingActionContentPadding,
} from "@/lib/safe-area";

type StatItemProps = {
	label: string;
	value: number | string;
	icon: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
	className: string;
	isLoading?: boolean;
};

function StatItem({ label, value, icon, className, isLoading }: StatItemProps) {
	const StatIcon = icon;

	return (
		<Box className="flex-1">
			<Box className="flex-row items-center gap-2">
				<Icon className={[className].join(" ")} as={StatIcon} size={"sm"} />
				<Text
					className={["text-sm text-muted-foreground", className].join(" ")}
				>
					{label}
				</Text>
			</Box>
			{isLoading ? (
				<Skeleton className="mt-2 h-8 w-14 rounded-md" />
			) : (
				<Heading className="mt-1 text-3xl font-semibold">{value}</Heading>
			)}
		</Box>
	);
}

type SettingsInfoRowProps = {
	label: string;
	value: number | string;
	isLoading?: boolean;
	withDivider?: boolean;
};

function SettingsInfoRow({
	label,
	value,
	isLoading,
	withDivider = true,
}: SettingsInfoRowProps) {
	return (
		<Box
			className={[
				"min-h-14 flex-row items-center justify-between py-3",
				withDivider ? "border-b border-foreground/10" : "",
			].join(" ")}
		>
			<Text className="flex-1 pr-4 text-base font-normal">{label}</Text>
			{isLoading ? (
				<Skeleton className="h-5 w-14 rounded-md" />
			) : (
				<Text className="text-sm font-semibold text-muted-foreground">
					{value}
				</Text>
			)}
		</Box>
	);
}

export default function TheoryTopicDetailsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colorMode } = useAppTheme();
	const { user } = useAuth();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const primaryForegroundColor = isDark ? "#171717" : "#FAFAFA";
	const panelBg = isDark ? "#202020" : "#f4f4f4";
	const settingsCardBg = isDark ? "#171717" : "#ffffff";
	const bottomActionOffset = getFloatingActionBottomOffset(insets.bottom);
	const [startLoading, setStartLoading] = useState(false);
	const [startError, setStartError] = useState("");
	const startQuizSessionMutation = useStartQuizSessionMutation();

	const params = useLocalSearchParams<{ slug?: string }>();
	const slug = typeof params.slug === "string" ? params.slug : "";

	const mountReady = useDeferredMount();
	const { detail, isLoading, error, reload } = useTheoryTopicDetail(
		user?.id,
		slug,
		language,
		mountReady,
	);
	const {
		settings,
		isReady,
		setAutoAdvance,
	} = useTheoryTestSettings();
	const autoAdvanceRef = useRef(settings.autoAdvance);

	useEffect(() => {
		autoAdvanceRef.current = settings.autoAdvance;
	}, [settings.autoAdvance]);

	const handleAutoAdvanceChange = useCallback(
		(value: boolean) => {
			autoAdvanceRef.current = value;
			setAutoAdvance(value);
		},
		[setAutoAdvance],
	);

	const topic = detail?.topic ?? null;
	const topicTitle = topic?.title ?? t("theory.title", "Theory");
	const topicDescription =
		topic?.subtitle || t("theory.sectionSubtitle", "Theory section");
	const progressPercent = topic?.progressPercent ?? 0;
	const questionCount = topic?.totalQuestions ?? 0;
	const timeLimitMinutes =
		topic?.timeLimitMinutes ??
		(questionCount > 0 ? Math.ceil((questionCount * 40) / 60) : 0);
	const tokenCost = topic?.tokenCost ?? Math.max(1, Math.ceil(questionCount / 10)) * 8;

	useFocusEffect(
		useCallback(() => {
			let isCancelled = false;

			const refreshOnFocus = async () => {
				if (!slug) return;

				if (isCancelled) return;
				await reload();
			};

			refreshOnFocus().catch(() => {});

			return () => {
				isCancelled = true;
			};
		}, [reload, slug]),
	);

	const handleStartTest = async () => {
		if (!topic || startLoading) return;

		setStartError("");
		setStartLoading(true);
		try {
			const session = await startQuizSessionMutation.mutateAsync({
				categoryId: topic.id,
			});

			router.push({
				pathname: "/tabs/(questions)/theory/test/[sessionId]",
				params: {
					sessionId: String(session.id),
					auto: autoAdvanceRef.current ? "1" : "0",
					tokenCost: String(tokenCost),
				},
			});
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Testni boshlashda xatolik yuz berdi.";
			setStartError(message);
		} finally {
			setStartLoading(false);
		}
	};

	return (
		<Box
			className="flex-1 pt-safe"
			style={{ backgroundColor: isDark ? palette.background : "#ffffff" }}
		>
			{isDark ? null : (
				<LinearGradient
					pointerEvents="none"
					colors={[
						"rgb(255,255,255)",
						"rgba(255,255,255,0.5)",
						"rgba(255,255,255,0)",
					]}
					start={{ x: 0.5, y: 0 }}
					end={{ x: 0.5, y: 1 }}
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: 0,
						height: 120,
					}}
				/>
			)}

			<Box className="px-4 my-2 flex-row items-center justify-between">
				<Box>
					<YandexRippleButton
						onPress={() => router.replace("/tabs/(questions)/theory")}
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
						{t("theory.practice", "Practice")}
					</Heading>
					<Text className="text-sm" style={{ color: muted }}>
						{t("theory.testOptions", "Test options")}
					</Text>
				</Box>

				<ProgressRing progress={progressPercent} />
			</Box>

			<ScrollView
				showsVerticalScrollIndicator={false}
				overScrollMode="never"
				decelerationRate="normal"
				contentContainerStyle={{
					paddingBottom: getFloatingActionContentPadding(insets.bottom),
				}}
			>
				<Box className="pt-1">
					<Image
						className="self-center mt-4 w-[230px] h-[150px]"
						source={getTopicIllustration(topic?.imageKey)}
						alt={topicTitle}
						resizeMode="contain"
					/>

					<Heading
						numberOfLines={2}
						ellipsizeMode="tail"
						className="mt-1 text-center px-5 text-2xl font-semibold"
						style={{ color: text }}
					>
						{topicTitle}
					</Heading>

					<Box className="mt-2 self-center flex-row items-center">
						<Text className="text-base" style={{ color: muted }}>
							{topicDescription}
						</Text>
						<Box className="ml-1">
							<ChevronRight
								size={18}
								strokeWidth={2}
								color={palette.tabIconDefault}
							/>
						</Box>
					</Box>
				</Box>

				{error ? (
					<Box className="px-4 mt-4">
						<Box className="rounded-2xl bg-card px-3 py-3 border border-destructive/30">
							<Text className="text-xs text-destructive">{error}</Text>
							<Pressable className="mt-2" onPress={() => reload()}>
								<Text className="text-sm font-semibold text-primary">
									{t("common.retry", "Retry")}
								</Text>
							</Pressable>
						</Box>
					</Box>
				) : null}

				<Box
					className="mt-6 rounded-t-[34px] h-full px-4 pt-5 pb-7"
					style={{ backgroundColor: panelBg }}
				>
					<Text className="text-sm uppercase tracking-wide text-muted-foreground">
						{t("theory.statsTitle", "Your answer stats")}
					</Text>

					<Box className="rounded-2xl py-4">
						<Box className="flex-row items-center">
							<StatItem
								className=""
								label={t("theory.questions", "Questions")}
								value={questionCount}
								icon={CircleHelp}
								isLoading={isLoading}
							/>
							<Box className="mx-2 h-16 w-[1px] bg-border/70" />
							<StatItem
								className=""
								label={t("theory.correct", "Correct")}
								value={topic?.correctCount ?? 0}
								icon={CircleCheck}
								isLoading={isLoading}
							/>
							<Box className="mx-2 h-16 w-[1px] bg-border/70" />
							<StatItem
								label={t("theory.incorrect", "Incorrect")}
								value={topic?.incorrectCount ?? 0}
								icon={CircleX}
								className=""
								isLoading={isLoading}
							/>
						</Box>
					</Box>

					<Text className="text-sm uppercase tracking-wide text-muted-foreground">
						{t("practice.testSettings", "Test sozlamalari")}
					</Text>

					<Box
						className="mt-3 rounded-3xl px-4"
						style={{ backgroundColor: settingsCardBg }}
					>
						{isReady ? (
							<ToggleRow
								label={t(
									"theory.settings.autoAdvance",
									"Auto-advance to next question",
								)}
								value={settings.autoAdvance}
								onValueChange={handleAutoAdvanceChange}
								withDivider
							/>
						) : (
							<Box className="min-h-14 flex-row items-center justify-between border-b border-foreground/10 py-3">
								<Text className="text-base font-normal text-muted-foreground">
									{t("theory.settings.loading", "Settings are loading...")}
								</Text>
							</Box>
						)}
						<SettingsInfoRow
							label={t("practice.price", "Narx")}
							value={tokenCost}
							isLoading={isLoading}
						/>
						<SettingsInfoRow
							label={t("practice.minutes", "Daqiqa")}
							value={timeLimitMinutes}
							isLoading={isLoading}
						/>
						<SettingsInfoRow
							label={t("practice.questions.title", "Savollar")}
							value={questionCount}
							isLoading={isLoading}
							withDivider={false}
						/>
					</Box>

					<Text className="text-sm uppercase tracking-wide text-muted-foreground mt-5">
						{t("tokenConfirm.rulesTitle", "Token qoidalari")}
					</Text>

					<Box
						className="mt-3 rounded-3xl px-4"
						style={{ backgroundColor: settingsCardBg }}
					>
						<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
							<Box className="flex-row items-center gap-3">
								<Zap size={16} color="#ff9f2f" strokeWidth={2.2} />
								<Text className="text-base font-normal">
									{t("tokenConfirm.costLabel", "Yechiladi")}
								</Text>
							</Box>
							<Text
								className="text-sm font-semibold"
								style={{ color: "#ff9f2f" }}
							>
								{tokenCost} {t("tokenConfirm.tokenWord", "tanga")}
							</Text>
						</Box>

						<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
							<Box className="flex-row items-center gap-3">
								<RotateCcw size={16} color="#3b82f6" strokeWidth={2.2} />
								<Text className="text-base font-normal">
									{t("tokenConfirm.refundLabel", "Qaytariladi")}
								</Text>
							</Box>
							<Text className="text-sm font-semibold text-muted-foreground">
								{t("tokenConfirm.refundCondition", "80%+ natijada")}
							</Text>
						</Box>

						<Box className="h-14 flex-row items-center justify-between">
							<Box className="flex-row items-center gap-3">
								<Sparkles size={16} color="#10b981" strokeWidth={2.2} />
								<Text className="text-base font-normal">
									{t("tokenConfirm.bonusLabel", "Bonus tokenlar")}
								</Text>
							</Box>
							<Text className="text-sm font-semibold text-muted-foreground">
								{t("tokenConfirm.bonusCondition", "Muvaffaqiyatda")}
							</Text>
						</Box>
					</Box>

					{startError ? (
						<Text className="mt-3 text-sm text-destructive">{startError}</Text>
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
					height: 110,
				}}
			/>

			<Box
				className="absolute left-0 right-0 px-7"
				style={{ bottom: bottomActionOffset, zIndex: 20, elevation: 20 }}
			>
				{startError ? (
					<Text className="mb-2 text-sm text-destructive">{startError}</Text>
				) : null}
				<Pressable
					onPress={handleStartTest}
					disabled={!topic || startLoading}
					style={({ pressed }) => ({
						opacity: !topic || startLoading ? 0.5 : pressed ? 0.88 : 1,
						transform: [{ scale: pressed ? 0.992 : 1 }],
					})}
				>
					<Box className="h-[52px] rounded-[26px] bg-primary flex-row items-center justify-center">
						{startLoading ? (
							<ActivityIndicator color={primaryForegroundColor} />
						) : (
							<Text className="text-base font-semibold text-primary-foreground">
								{t("theory.startTest", "Start test")}
							</Text>
						)}
					</Box>
				</Pressable>
			</Box>

		</Box>
	);
}
