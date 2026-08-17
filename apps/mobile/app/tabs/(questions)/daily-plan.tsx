import React from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	TextInput,
	type TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
	ChevronLeft,
	CircleHelp,
	Clock3,
	Minus,
	Plus,
	Save,
	Zap,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import {
	DEFAULT_DAILY_PLAN_GOALS,
	useDailyPlanGoals,
} from "@/features/daily-plan/goals";
import { useI18n } from "@/locales/i18n-provider";
import {
	getFloatingActionBottomOffset,
	getFloatingActionContentPadding,
} from "@/lib/safe-area";

type PlanNumberFieldProps = {
	description: string;
	icon: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
	iconColor: string;
	inputStyle: TextStyle;
	max: number;
	min: number;
	onChangeText: (value: string) => void;
	onStep: (delta: number) => void;
	step: number;
	suffix: string;
	title: string;
	value: string;
};

type TimeGoalFieldProps = {
	hours: string;
	hoursLabel: string;
	inputStyle: TextStyle;
	minutes: string;
	minutesLabel: string;
	onHoursChange: (value: string) => void;
	onHoursStep: (delta: number) => void;
	onMinutesChange: (value: string) => void;
	onMinutesStep: (delta: number) => void;
	description: string;
	title: string;
};

const numericOnly = (value: string, maxLength = 4) =>
	value.replace(/\D/g, "").slice(0, maxLength);

function colorWithAlpha(color: string, alpha: number) {
	const normalized = color.trim();
	if (!normalized.startsWith("#")) return color;

	const hex = normalized.slice(1);
	const fullHex =
		hex.length === 3
			? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
			: hex;

	if (fullHex.length !== 6) return color;

	const red = Number.parseInt(fullHex.slice(0, 2), 16);
	const green = Number.parseInt(fullHex.slice(2, 4), 16);
	const blue = Number.parseInt(fullHex.slice(4, 6), 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function parseNumber(value: string, fallback: number) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, Math.round(value)));
}

function setSteppedValue(
	value: string,
	fallback: number,
	min: number,
	max: number,
	delta: number,
	onChange: (nextValue: string) => void,
) {
	onChange(String(clamp(parseNumber(value, fallback) + delta, min, max)));
}

function StepButton({
	children,
	onPress,
}: {
	children: React.ReactNode;
	onPress: () => void;
}) {
	return (
		<YandexRippleButton
			onPress={onPress}
			borderRadius={999}
			rippleOpacity={0.05}>
			<GradientIconFrame
				size={48}
				borderRadius={999}
				innerBorderRadius={999}
			>
				{children}
			</GradientIconFrame>
		</YandexRippleButton>
	);
}

function PlanNumberField({
	description,
	icon,
	iconColor,
	inputStyle,
	max,
	min,
	onChangeText,
	onStep,
	step,
	suffix,
	title,
	value,
}: PlanNumberFieldProps) {
	const FieldIcon = icon;

	return (
		<Box className="rounded-[28px] px-5 pt-5 pb-4 bg-card">
			<Box className="flex-row items-center gap-3">
				<Box
					className="rounded-[18px] items-center justify-center"
					style={{
						backgroundColor: colorWithAlpha(iconColor, 0.14),
						height: 52,
						width: 52,
					}}
				>
					<FieldIcon size={20} color={iconColor} strokeWidth={2.2} />
				</Box>
				<Box className="flex-1">
					<Heading className="text-xl font-semibold">{title}</Heading>
					<Text className="mt-1 text-sm text-muted-foreground">
						{description}
					</Text>
				</Box>
			</Box>

			<Box className="mt-5 flex-row items-center justify-between">
				<StepButton onPress={() => onStep(-step)}>
					<Minus size={19} color={iconColor} strokeWidth={2.4} />
				</StepButton>

				<Box className="flex-1 flex-row items-center justify-center px-3">
					<TextInput
						value={value}
						onChangeText={(nextValue) => onChangeText(numericOnly(nextValue))}
						keyboardType="number-pad"
						maxLength={4}
						placeholder={String(min)}
						placeholderTextColor="#9BA1A6"
						style={inputStyle}
					/>
					<Text className="ml-2 text-base text-muted-foreground">{suffix}</Text>
				</Box>

				<StepButton onPress={() => onStep(step)}>
					<Plus size={21} color={iconColor} strokeWidth={2.4} />
				</StepButton>
			</Box>

		</Box>
	);
}

function TimeInput({
	label,
	value,
	onChangeText,
	onStep,
	inputStyle,
}: {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	onStep: (delta: number) => void;
	inputStyle: TextStyle;
}) {
	return (
		<Box className="w-full">
			<Text className="mb-2 text-sm text-muted-foreground">{label}</Text>
			<Box className="flex-row items-center justify-between">
				<StepButton onPress={() => onStep(-1)}>
					<Minus size={19} color="#51A776" strokeWidth={2.4} />
				</StepButton>
				<Box className="flex-1 items-center justify-center px-3">
					<TextInput
						value={value}
						onChangeText={(nextValue) => onChangeText(numericOnly(nextValue, 2))}
						keyboardType="number-pad"
						maxLength={2}
						placeholder="0"
						placeholderTextColor="#9BA1A6"
						style={inputStyle}
					/>
				</Box>
				<StepButton onPress={() => onStep(1)}>
					<Plus size={21} color="#51A776" strokeWidth={2.4} />
				</StepButton>
			</Box>
		</Box>
	);
}

function TimeGoalField({
	hours,
	hoursLabel,
	inputStyle,
	minutes,
	minutesLabel,
	onHoursChange,
	onHoursStep,
	onMinutesChange,
	onMinutesStep,
	description,
	title,
}: TimeGoalFieldProps) {
	return (
		<Box className="rounded-[28px] px-5 pt-5 pb-5 bg-card">
			<Box className="flex-row items-center gap-3">
				<Box
					className="rounded-[18px] items-center justify-center"
					style={{
						backgroundColor: colorWithAlpha("#51A776", 0.14),
						height: 52,
						width: 52,
					}}
				>
					<Clock3 size={20} color="#51A776" strokeWidth={2.2} />
				</Box>
				<Box className="flex-1">
					<Heading className="text-xl font-semibold">{title}</Heading>
					<Text className="mt-1 text-sm text-muted-foreground">
						{description}
					</Text>
				</Box>
			</Box>

			<Box className="mt-5 gap-4">
				<TimeInput
					label={hoursLabel}
					value={hours}
					onChangeText={onHoursChange}
					onStep={onHoursStep}
					inputStyle={inputStyle}
				/>
				<TimeInput
					label={minutesLabel}
					value={minutes}
					onChangeText={onMinutesChange}
					onStep={onMinutesStep}
					inputStyle={inputStyle}
				/>
			</Box>
		</Box>
	);
}

export default function DailyPlanScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const { goals, isReady, save } = useDailyPlanGoals();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const primaryButtonText = isDark ? "#111111" : "#ffffff";
	const bottomActionOffset = getFloatingActionBottomOffset(insets.bottom);
	const inputStyle: TextStyle = {
		color: text,
		fontSize: 28,
		fontWeight: "700",
		minWidth: 48,
		paddingHorizontal: 0,
		paddingVertical: 0,
		textAlign: "center",
	};

	const [questionGoal, setQuestionGoal] = React.useState(
		String(DEFAULT_DAILY_PLAN_GOALS.questionGoal),
	);
	const [accuracyGoal, setAccuracyGoal] = React.useState(
		String(DEFAULT_DAILY_PLAN_GOALS.accuracyGoal),
	);
	const [hoursGoal, setHoursGoal] = React.useState("1");
	const [minutesGoal, setMinutesGoal] = React.useState("0");
	const [isSaving, setIsSaving] = React.useState(false);

	React.useEffect(() => {
		if (!isReady) return;

		setQuestionGoal(String(goals.questionGoal));
		setAccuracyGoal(String(goals.accuracyGoal));
		setHoursGoal(String(Math.floor(goals.activeMinutesGoal / 60)));
		setMinutesGoal(String(goals.activeMinutesGoal % 60));
	}, [goals, isReady]);

	const handleSave = async () => {
		if (isSaving) return;

		const totalMinutes =
			parseNumber(hoursGoal, 0) * 60 + parseNumber(minutesGoal, 0);

		setIsSaving(true);
		try {
			await save({
				questionGoal: clamp(
					parseNumber(questionGoal, DEFAULT_DAILY_PLAN_GOALS.questionGoal),
					1,
					500,
				),
				accuracyGoal: clamp(
					parseNumber(accuracyGoal, DEFAULT_DAILY_PLAN_GOALS.accuracyGoal),
					1,
					100,
				),
				activeMinutesGoal: clamp(
					totalMinutes || DEFAULT_DAILY_PLAN_GOALS.activeMinutesGoal,
					1,
					24 * 60,
				),
			});
			router.replace("/tabs/(tabs)/home");
		} catch {
			setIsSaving(false);
		}
	};

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
						{t("dailyPlan.title", "Reja qo'shish")}
					</Heading>
					<Text className="text-sm" style={{ color: muted }}>
						{t("home.todayPlan", "Kunlik reja")}
					</Text>
				</Box>

				<GradientIconFrame
					size={48}
					borderRadius={999}
					innerBorderRadius={999}
				>
					<Save size={22} color={palette.text} />
				</GradientIconFrame>
			</Box>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1"
			>
				<ScrollView
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					overScrollMode="never"
					decelerationRate="normal"
					contentContainerStyle={{
						paddingHorizontal: 16,
						paddingTop: 16,
						paddingBottom: getFloatingActionContentPadding(insets.bottom, 150),
					}}
				>
					<Box className="gap-4">
						<PlanNumberField
							title={t("dailyPlan.questions.title", "Savol maqsadi")}
							description={t(
								"dailyPlan.questions.description",
								"Kuniga yechiladigan savollar",
							)}
							icon={CircleHelp}
							iconColor="#F6B81D"
							value={questionGoal}
							min={1}
							max={500}
							step={5}
							suffix={t("home.metric.unit.questionShort", "ta")}
							inputStyle={inputStyle}
							onChangeText={setQuestionGoal}
							onStep={(delta) =>
								setSteppedValue(
									questionGoal,
									DEFAULT_DAILY_PLAN_GOALS.questionGoal,
									1,
									500,
									delta,
									setQuestionGoal,
								)
							}
						/>

						<PlanNumberField
							title={t("dailyPlan.accuracy.title", "Aniqlik minimumi")}
							description={t(
								"dailyPlan.accuracy.description",
								"Kerakli to'g'ri javob ulushi",
							)}
							icon={Zap}
							iconColor="#ef4444"
							value={accuracyGoal}
							min={1}
							max={100}
							step={5}
							suffix="%"
							inputStyle={inputStyle}
							onChangeText={setAccuracyGoal}
							onStep={(delta) =>
								setSteppedValue(
									accuracyGoal,
									DEFAULT_DAILY_PLAN_GOALS.accuracyGoal,
									1,
									100,
									delta,
									setAccuracyGoal,
								)
							}
						/>

						<TimeGoalField
							hours={hoursGoal}
							minutes={minutesGoal}
							title={t("dailyPlan.time.title", "Kunlik faoliyat")}
							description={t(
								"dailyPlan.time.description",
								"Kuniga ajratiladigan vaqt",
							)}
							hoursLabel={t("dailyPlan.time.hours", "Soat")}
							minutesLabel={t("dailyPlan.time.minutes", "Daqiqa")}
							inputStyle={inputStyle}
							onHoursChange={(value) => {
								setHoursGoal(String(clamp(parseNumber(value, 0), 0, 24)));
							}}
							onMinutesChange={(value) => {
								setMinutesGoal(String(clamp(parseNumber(value, 0), 0, 59)));
							}}
							onHoursStep={(delta) =>
								setSteppedValue(hoursGoal, 0, 0, 24, delta, setHoursGoal)
							}
							onMinutesStep={(delta) =>
								setSteppedValue(minutesGoal, 0, 0, 59, delta, setMinutesGoal)
							}
						/>
					</Box>
				</ScrollView>
			</KeyboardAvoidingView>

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
				<Pressable onPress={handleSave} disabled={isSaving || !isReady}>
					<Box
						className={[
							"h-[52px] rounded-[26px] flex-row items-center justify-center bg-primary",
							isSaving || !isReady ? "opacity-70" : "",
						].join(" ")}
					>
						{isSaving ? (
							<ActivityIndicator color={primaryButtonText} />
						) : (
							<Text
								className="text-lg font-semibold"
								style={{ color: primaryButtonText }}
							>
								{t("dailyPlan.save", "Saqlash")}
							</Text>
						)}
					</Box>
				</Pressable>
			</Box>
		</Box>
	);
}
