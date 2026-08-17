import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
	ChevronLeft,
	CircleHelp,
	Clock3,
	Coins,
	Dices,
	MedalIcon,
	RotateCcw,
	Sparkles,
	Zap,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomSwitch } from "@/components/CustomSwitch";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Image } from "@/components/ui/image";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import {
	useStartQuizPracticeSessionMutation,
	useQuizModeCostsQuery,
	type StartQuizPracticeSessionInput,
} from "@/features/quiz/api";
import { useAutoAdvance } from "@/hooks/useAutoAdvance";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import {
	getFloatingActionBottomOffset,
	getFloatingActionContentPadding,
} from "@/lib/safe-area";

const RANDOM_COUNT = 10 as const;
const MARATHON_COUNTS = [50, 100, 150] as const;

type PracticeCount = StartQuizPracticeSessionInput["count"];

type PracticeOptionRowProps = {
	description: string;
	isLast: boolean;
	isSelected: boolean;
	label: string;
	onPress: () => void;
};

type StatItemProps = {
	label: string;
	value: string;
	icon: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
	iconColor: string;
};

function StatItem({ label, value, icon, iconColor }: StatItemProps) {
	const StatIcon = icon;

	return (
		<Box className="flex-1">
			<Box className="flex-row items-center gap-2">
				<StatIcon size={16} color={iconColor} strokeWidth={2} />
				<Text className="text-sm text-muted-foreground">{label}</Text>
			</Box>
			<Heading className="mt-1 text-3xl font-semibold">{value}</Heading>
		</Box>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
			<Text className="text-base font-normal">{label}</Text>
			<Text className="text-sm font-semibold text-muted-foreground">
				{value}
			</Text>
		</Box>
	);
}

function PracticeOptionRow({
	description,
	isLast,
	isSelected,
	label,
	onPress,
}: PracticeOptionRowProps) {
	return (
		<Pressable onPress={onPress}>
			<Box
				className={[
					"min-h-[72px] flex-row items-center justify-between py-3",
					isLast ? "" : "border-b border-foreground/10",
				].join(" ")}
			>
				<Box className="flex-1 pr-4">
					<Heading className="text-lg font-semibold">{label}</Heading>
					<Text className="mt-1 text-base text-muted-foreground">
						{description}
					</Text>
				</Box>
				<CustomSwitch
					value={isSelected}
					onValueChange={(next) => {
						if (next) onPress();
					}}
				/>
			</Box>
		</Pressable>
	);
}

export default function MarathonScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ mode?: string; count?: string }>();
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const panelBg = isDark ? "#202020" : "#f4f4f4";
	const optionCardBg = isDark ? "#171717" : "#ffffff";
	const primaryButtonText = isDark ? "#111111" : "#ffffff";
	const bottomActionOffset = getFloatingActionBottomOffset(insets.bottom);
	const isRandomMode = params.mode === "random" || params.count === "10";
	const counts = useMemo<PracticeCount[]>(
		() => (isRandomMode ? [RANDOM_COUNT] : [...MARATHON_COUNTS]),
		[isRandomMode],
	);
	const [selectedCount, setSelectedCount] = useState<PracticeCount>(counts[0]);
	const startPracticeMutation = useStartQuizPracticeSessionMutation();
	const mountReady = useDeferredMount();
	const { data: modeCosts } = useQuizModeCostsQuery(mountReady);
	const randomCost = modeCosts?.practice ?? null;
	const marathonCost = modeCosts?.marathon ?? null;
	const tokenCost = isRandomMode ? randomCost : marathonCost;
	const {
		value: autoAdvance,
		setValue: setAutoAdvance,
		isReady: isAutoAdvanceReady,
	} = useAutoAdvance(isRandomMode ? "random-practice" : "marathon-practice");
	const isStartingRef = useRef(false);
	const [startError, setStartError] = useState("");

	const MARATHON_TOKEN_COSTS: Record<number, number> = { 50: 40, 100: 70, 150: 90 };
	const RANDOM_TOKEN_COST = 10;
	const resolvedTokenCost = isRandomMode
		? (randomCost ?? RANDOM_TOKEN_COST)
		: (marathonCost ?? MARATHON_TOKEN_COSTS[selectedCount] ?? 40);

	const title = isRandomMode
		? t("practice.explore.random.title", "Random Questions")
		: t("practice.explore.marathon.title", "Marathon");
	const subtitle = isRandomMode
		? `10 ${t("common.questionsWord", "savol")} · 10 ${t("practice.minutes", "daqiqa")}`
		: `50 / 100 / 150 ${t("common.questionsWord", "savol")}`;

	React.useEffect(() => {
		setSelectedCount(counts[0]);
	}, [counts]);

	const handleStart = async () => {
		if (isStartingRef.current) return;
		isStartingRef.current = true;
		setStartError("");

		try {
			const session = await startPracticeMutation.mutateAsync({
				count: selectedCount,
				mode: isRandomMode ? "practice" : "marathon",
			});
			router.replace({
				pathname: "/tabs/(questions)/theory/test/[sessionId]",
				params: {
					sessionId: String(session.id),
					slug: isRandomMode ? "random" : "marathon",
					title,
					auto: autoAdvance ? "1" : "0",
					tokenCost: String(resolvedTokenCost),
				},
			});
		} catch (err) {
			setStartError(
				err instanceof Error
					? err.message
					: t("common.error", "Something went wrong."),
			);
		} finally {
			isStartingRef.current = false;
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
						{title}
					</Heading>
					<Text className="text-sm" style={{ color: muted }}>
						{subtitle}
					</Text>
				</Box>

				<GradientIconFrame
					size={48}
					borderRadius={999}
					innerBorderRadius={999}
				>
					{isRandomMode ? (
						<Dices size={24} color={palette.text} />
					) : (
						<MedalIcon size={24} color={palette.text} />
					)}
				</GradientIconFrame>
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
						className="self-center mt-4 w-[230px] h-[230px]"
						source={
							isRandomMode
								? require("../../../../assets/images/practice/marafon.png")
								: require("../../../../assets/images/practice/medal.webp")
						}
						alt={title}
						resizeMode="contain"
					/>

					<Heading
						numberOfLines={2}
						ellipsizeMode="tail"
						className="mt-1 text-center text-3xl font-semibold"
						style={{ color: text }}
					>
						{title}
					</Heading>
				</Box>

				<Box
					className="mt-6 rounded-t-[34px] h-full px-4 pt-5 pb-7"
					style={{ backgroundColor: panelBg }}
				>
					{isRandomMode ? (
						<>
							<Text className="text-sm uppercase tracking-wide text-muted-foreground">
								{t("practice.testInfo", "Test ma'lumotlari")}
							</Text>

							<Box className="rounded-2xl py-4">
								<Box className="flex-row items-center">
									<StatItem
										label={t("practice.questions.title", "Savollar")}
										value={String(selectedCount)}
										icon={CircleHelp}
										iconColor={palette.tabIconDefault}
									/>
									<Box className="mx-2 h-16 w-[1px] bg-border/70" />
									<StatItem
										label={t("practice.minutes", "Daqiqa")}
										value={String(selectedCount)}
										icon={Clock3}
										iconColor={palette.tint}
									/>
									<Box className="mx-2 h-16 w-[1px] bg-border/70" />
									<StatItem
										label={t("practice.coin", "Tanga")}
										value={String(resolvedTokenCost)}
										icon={Coins}
										iconColor="#ff9f2f"
									/>
								</Box>
							</Box>

							<Text className="text-sm uppercase tracking-wide text-muted-foreground">
								{t("practice.testSettings", "Test sozlamalari")}
							</Text>

							<Box
								className="mt-3 rounded-3xl px-4"
								style={{ backgroundColor: optionCardBg }}
							>
								{isAutoAdvanceReady ? (
									<Pressable onPress={() => setAutoAdvance(!autoAdvance)}>
										<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
											<Text className="text-base font-normal">
												{t(
													"theory.settings.autoAdvance",
													"Keyingi savolga avtomatik o'tish",
												)}
											</Text>
											<CustomSwitch
												value={autoAdvance}
												onValueChange={setAutoAdvance}
											/>
										</Box>
									</Pressable>
								) : null}

								<InfoRow
									label={t("practice.questionOrder", "Savollar tartibi")}
									value={t("practice.questionOrderRandom", "Tasodifiy")}
								/>
								<InfoRow
									label={t("practice.price", "Narx")}
									value={randomCost !== null ? `${randomCost} ${t("practice.coin", "tanga").toLowerCase()}` : "—"}
								/>

								<Box className="h-14 flex-row items-center justify-between">
									<Text className="text-base font-normal">
										{t("practice.time", "Vaqt")}
									</Text>
									<Text className="text-sm font-semibold text-muted-foreground">
										{selectedCount}:00
									</Text>
								</Box>
							</Box>

							<Text className="text-sm uppercase tracking-wide text-muted-foreground mt-5">
								{t("tokenConfirm.rulesTitle", "Token qoidalari")}
							</Text>

							<Box
								className="mt-3 rounded-3xl px-4"
								style={{ backgroundColor: optionCardBg }}
							>
								<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
									<Box className="flex-row items-center gap-3">
										<Zap size={16} color="#ff9f2f" strokeWidth={2.2} />
										<Text className="text-base font-normal">
											{t("tokenConfirm.costLabel", "Yechiladi")}
										</Text>
									</Box>
									<Text className="text-sm font-semibold" style={{ color: "#ff9f2f" }}>
										{resolvedTokenCost} {t("tokenConfirm.tokenWord", "tanga")}
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
						</>
					) : (
						<>
							<Text className="text-sm uppercase tracking-wide text-muted-foreground">
								{t("practice.testInfo", "Test ma'lumotlari")}
							</Text>

							<Box className="rounded-2xl py-4">
								<Box className="flex-row items-center">
									<StatItem
										label={t("practice.questions.title", "Savollar")}
										value={String(selectedCount)}
										icon={CircleHelp}
										iconColor={palette.tabIconDefault}
									/>
									<Box className="mx-2 h-16 w-[1px] bg-border/70" />
									<StatItem
										label={t("practice.minutes", "Daqiqa")}
										value={String(selectedCount)}
										icon={Clock3}
										iconColor={palette.tint}
									/>
									<Box className="mx-2 h-16 w-[1px] bg-border/70" />
									<StatItem
										label={t("practice.coin", "Tanga")}
										value={String(resolvedTokenCost)}
										icon={Coins}
										iconColor="#ff9f2f"
									/>
								</Box>
							</Box>

							<Text className="text-sm uppercase tracking-wide text-muted-foreground">
								{t("practice.marathonOptions", "Marafon variantlari")}
							</Text>

							<Box
								className="mt-3 rounded-3xl px-4"
								style={{ backgroundColor: optionCardBg }}
							>
								{counts.map((count, index) => (
									<PracticeOptionRow
										key={count}
										label={`${count} talik marafon`}
										description={`${count} daqiqa`}
										isSelected={selectedCount === count}
										isLast={index === counts.length - 1}
										onPress={() => setSelectedCount(count)}
									/>
								))}
							</Box>

							<Text className="mt-5 text-sm uppercase tracking-wide text-muted-foreground">
								{t("practice.testSettings", "Test sozlamalari")}
							</Text>

							<Box
								className="mt-3 rounded-3xl px-4"
								style={{ backgroundColor: optionCardBg }}
							>
								{isAutoAdvanceReady ? (
									<Pressable onPress={() => setAutoAdvance(!autoAdvance)}>
										<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
											<Text className="text-base font-normal">
												{t(
													"theory.settings.autoAdvance",
													"Keyingi savolga avtomatik o'tish",
												)}
											</Text>
											<CustomSwitch
												value={autoAdvance}
												onValueChange={setAutoAdvance}
											/>
										</Box>
									</Pressable>
								) : null}

								<InfoRow
									label={t("practice.questionOrder", "Savollar tartibi")}
									value={t("practice.questionOrderRandom", "Tasodifiy")}
								/>
								<InfoRow
									label={t("practice.price", "Narx")}
									value={marathonCost !== null ? `${marathonCost} ${t("practice.coin", "tanga").toLowerCase()}` : "—"}
								/>

								<Box className="h-14 flex-row items-center justify-between">
									<Text className="text-base font-normal">
										{t("practice.time", "Vaqt")}
									</Text>
									<Text className="text-sm font-semibold text-muted-foreground">
										{selectedCount}:00
									</Text>
								</Box>
							</Box>

							<Text className="text-sm uppercase tracking-wide text-muted-foreground mt-5">
								{t("tokenConfirm.rulesTitle", "Token qoidalari")}
							</Text>

							<Box
								className="mt-3 rounded-3xl px-4"
								style={{ backgroundColor: optionCardBg }}
							>
								<Box className="h-14 flex-row items-center justify-between border-b border-foreground/10">
									<Box className="flex-row items-center gap-3">
										<Zap size={16} color="#ff9f2f" strokeWidth={2.2} />
										<Text className="text-base font-normal">
											{t("tokenConfirm.costLabel", "Yechiladi")}
										</Text>
									</Box>
									<Text className="text-sm font-semibold" style={{ color: "#ff9f2f" }}>
										{resolvedTokenCost} {t("tokenConfirm.tokenWord", "tanga")}
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
						</>
					)}

					{startError ? (
						<Box className="mt-4 rounded-2xl border border-destructive/30 px-3 py-3">
							<Text className="text-sm text-destructive">{startError}</Text>
						</Box>
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
				style={{ bottom: bottomActionOffset }}
			>
				<Pressable
					onPress={handleStart}
					disabled={startPracticeMutation.isPending}
				>
					<Box
						className={[
							"h-[52px] rounded-[26px] flex-row items-center justify-center bg-primary",
							startPracticeMutation.isPending ? "opacity-70" : "",
						].join(" ")}
					>
						{startPracticeMutation.isPending ? (
							<ActivityIndicator color={primaryButtonText} />
						) : (
							<Text className="text-base font-semibold text-primary-foreground">
								{isRandomMode
									? t("practice.startPractice", "Mashqni boshlash")
									: t("practice.marathonStart", "Marafonni boshlash")}
							</Text>
						)}
					</Box>
				</Pressable>
			</Box>

		</Box>
	);
}
