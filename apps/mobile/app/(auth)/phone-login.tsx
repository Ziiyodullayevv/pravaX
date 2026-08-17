import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
	ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import {
	getCurrentUser,
	useTelegramVerifyMutation,
} from "@/features/auth/api";
import { getErrorMessage } from "@/lib/api";

const BRAND_ACCENT = "#ff7a45";
const OTP_LENGTH = 6;
const BOT_USERNAME = "@pravaX_bot";
const PHONE_PREFIX = "+998";

// Apple-style entering animation — runs only once per session
let HAS_SEEN_PHONE_ANIM = false;
let HAS_SEEN_OTP_ANIM = false;

const APPLE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const APPLE_DURATION = 720;
const APPLE_OFFSET_Y = 24;

function useAppleEnter(delay: number, skip: boolean) {
	const opacity = useSharedValue(skip ? 1 : 0);
	const translateY = useSharedValue(skip ? 0 : APPLE_OFFSET_Y);

	useEffect(() => {
		if (skip) return;
		opacity.value = withDelay(
			delay,
			withTiming(1, { duration: APPLE_DURATION, easing: APPLE_EASING }),
		);
		translateY.value = withDelay(
			delay,
			withTiming(0, { duration: APPLE_DURATION, easing: APPLE_EASING }),
		);
	}, [delay, skip, opacity, translateY]);

	return useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }],
	}));
}

type Step = "phone" | "otp";

// ─── OTP 6-box input ─────────────────────────────────────────────────────────

type OtpInputProps = {
	value: string;
	onChange: (v: string) => void;
	disabled?: boolean;
	isDark: boolean;
	autoFocus?: boolean;
};

function OtpInput({ value, onChange, disabled, isDark, autoFocus }: OtpInputProps) {
	const refs = useRef<(TextInput | null)[]>([]);
	const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

	const textColor = isDark ? "#f5f5f5" : "#141414";
	const bg = isDark ? "#1e1e1e" : "#f0f4f8";
	const borderIdle = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";

	useEffect(() => {
		if (autoFocus) {
			const timer = setTimeout(() => refs.current[0]?.focus(), 300);
			return () => clearTimeout(timer);
		}
	}, [autoFocus]);

	const handleChange = (text: string, i: number) => {
		const cleaned = text.replace(/\D/g, "");
		if (cleaned.length > 1) {
			const next = cleaned.slice(0, OTP_LENGTH);
			const padded = next.padEnd(OTP_LENGTH, "").slice(0, OTP_LENGTH);
			onChange(padded.replace(/\s/g, ""));
			const focusIdx = Math.min(next.length, OTP_LENGTH - 1);
			refs.current[focusIdx]?.focus();
			return;
		}
		const lastChar = cleaned.slice(-1);
		const newDigits = [...digits];
		newDigits[i] = lastChar;
		onChange(newDigits.join(""));
		if (lastChar && i < OTP_LENGTH - 1) {
			refs.current[i + 1]?.focus();
		}
	};

	const handleKeyPress = (key: string, i: number) => {
		if (key !== "Backspace") return;
		if (digits[i]) {
			const newDigits = [...digits];
			newDigits[i] = "";
			onChange(newDigits.join(""));
		} else if (i > 0) {
			const newDigits = [...digits];
			newDigits[i - 1] = "";
			onChange(newDigits.join(""));
			refs.current[i - 1]?.focus();
		}
	};

	return (
		<View style={styles.otpRow}>
			{digits.map((digit, i) => (
				<TextInput
					key={i}
					ref={(r) => {
						refs.current[i] = r;
					}}
					value={digit}
					editable={!disabled}
					keyboardType="number-pad"
					maxLength={6}
					caretHidden
					selectTextOnFocus
					style={[
						styles.otpBox,
						{
							backgroundColor: bg,
							borderColor: digit ? BRAND_ACCENT : borderIdle,
							color: textColor,
							borderWidth: digit ? 2 : 1.5,
						},
					]}
					onChangeText={(text) => handleChange(text, i)}
					onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
				/>
			))}
		</View>
	);
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PhoneLoginScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { completeTelegramAuth } = useAuth();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;

	const textColor = isDark ? "#f5f5f5" : "#141414";
	const mutedColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
	const inputBg = isDark ? "#1e1e1e" : "#f0f4f8";
	const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";

	const [step, setStep] = useState<Step>("phone");
	// Stores only the suffix after +998 (e.g. "901234567")
	const [phoneSuffix, setPhoneSuffix] = useState("");
	const [otp, setOtp] = useState("");
	const [errorMsg, setErrorMsg] = useState("");

	const verifyMutation = useTelegramVerifyMutation();
	const isBusy = verifyMutation.isPending;

	const fullPhone = `${PHONE_PREFIX}${phoneSuffix}`;

	useEffect(() => {
		const filled = otp.replace(/\s/g, "");
		if (step === "otp" && filled.length === OTP_LENGTH && !isBusy) {
			handleVerify(filled);
		}
	}, [otp, step]);

	const handleContinue = () => {
		const digits = phoneSuffix.replace(/\D/g, "");
		if (digits.length < 9) {
			setErrorMsg("To'liq telefon raqamni kiriting");
			return;
		}
		setErrorMsg("");
		setOtp("");
		setStep("otp");
	};

	const handleVerify = async (code: string) => {
		setErrorMsg("");
		try {
			await verifyMutation.mutateAsync({ phoneNumber: fullPhone, code });

			let user = null;
			try {
				user = await getCurrentUser();
			} catch {
				// proceed without enriched user
			}

			const tokens = { accessToken: null } as { accessToken: string | null };
			const { getAccessToken } = await import("@/lib/api");
			tokens.accessToken = await getAccessToken();

			if (!tokens.accessToken) throw new Error("Access token topilmadi.");

			await completeTelegramAuth({
				accessToken: tokens.accessToken,
				user: user ?? { id: "" },
			});
			router.replace("/tabs/home");
		} catch (err) {
			setErrorMsg(getErrorMessage(err));
			setOtp("");
		}
	};

	const goBack = () => {
		if (step === "otp") {
			setStep("phone");
			setErrorMsg("");
		} else {
			router.back();
		}
	};

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<Box className="flex-1 bg-background">
				<Box style={{ paddingTop: insets.top + 8 }} className="px-4 pb-2">
					<Box style={{ alignSelf: "flex-start" }}>
						<YandexRippleButton onPress={goBack} borderRadius={9999}>
							<GradientIconFrame size={48} borderRadius={999} innerBorderRadius={999}>
								<ChevronLeft size={24} color={palette.text} />
							</GradientIconFrame>
						</YandexRippleButton>
					</Box>
				</Box>

				<ScrollView
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{
						flexGrow: 1,
						paddingHorizontal: 28,
						paddingBottom: Math.max(insets.bottom, 32) + 16,
					}}
				>
					{step === "phone" ? (
						<PhoneStep
							isDark={isDark}
							textColor={textColor}
							mutedColor={mutedColor}
							inputBg={inputBg}
							inputBorder={inputBorder}
							phoneSuffix={phoneSuffix}
							setPhoneSuffix={setPhoneSuffix}
							errorMsg={errorMsg}
							onContinue={handleContinue}
						/>
					) : (
						<OtpStep
							isDark={isDark}
							textColor={textColor}
							mutedColor={mutedColor}
							phone={fullPhone}
							otp={otp}
							setOtp={setOtp}
							errorMsg={errorMsg}
							isBusy={isBusy}
						/>
					)}
				</ScrollView>
			</Box>
		</KeyboardAvoidingView>
	);
}

// ─── Phone step ───────────────────────────────────────────────────────────────

type PhoneStepProps = {
	isDark: boolean;
	textColor: string;
	mutedColor: string;
	inputBg: string;
	inputBorder: string;
	phoneSuffix: string;
	setPhoneSuffix: (v: string) => void;
	errorMsg: string;
	onContinue: () => void;
};

function PhoneStep({
	isDark,
	textColor,
	mutedColor,
	inputBg,
	inputBorder,
	phoneSuffix,
	setPhoneSuffix,
	errorMsg,
	onContinue,
}: PhoneStepProps) {
	const skipAnim = useMemo(() => {
		const seen = HAS_SEEN_PHONE_ANIM;
		HAS_SEEN_PHONE_ANIM = true;
		return seen;
	}, []);

	const headerStyle = useAppleEnter(0, skipAnim);
	const inputStyle = useAppleEnter(140, skipAnim);
	const buttonStyle = useAppleEnter(280, skipAnim);

	return (
		<>
			<Animated.View style={headerStyle}>
				<Heading
					className="mt-8 text-[32px] leading-[38px] font-bold"
					style={{ color: textColor }}
				>
					Botni qo'lda ochish
				</Heading>
				<Text className="mt-3 text-base leading-6" style={{ color: mutedColor }}>
					Telefon raqamingizni kiriting, so'ng{" "}
					<Text className="font-semibold" style={{ color: BRAND_ACCENT }}>
						{BOT_USERNAME}
					</Text>{" "}
					ga o'tib /start bosing va kontaktingizni ulashing — bot tasdiqlash kodini yuboradi.
				</Text>
			</Animated.View>

			<Animated.View style={[{ marginTop: 32 }, inputStyle]}>
				<Text
					className="mb-2 text-xs uppercase tracking-wider"
					style={{ color: mutedColor }}
				>
					Telefon raqam
				</Text>
				<View
					style={[
						styles.inputRow,
						{ backgroundColor: inputBg, borderColor: inputBorder },
					]}
				>
					<Text style={[styles.prefix, { color: textColor }]}>
						{PHONE_PREFIX}
					</Text>
					<View style={styles.divider} />
					<TextInput
						value={phoneSuffix}
						onChangeText={(text) => setPhoneSuffix(text.replace(/[^0-9\s]/g, ""))}
						placeholder="90 123 45 67"
						placeholderTextColor={mutedColor}
						keyboardType="number-pad"
						autoComplete="tel"
						returnKeyType="done"
						onSubmitEditing={onContinue}
						autoFocus
						maxLength={12}
						style={[styles.inputField, { color: textColor }]}
					/>
				</View>

				{errorMsg ? (
					<Text className="mt-3 text-sm text-red-500">{errorMsg}</Text>
				) : null}
			</Animated.View>

			<Box className="flex-1" />

			<Animated.View style={[{ marginTop: 32 }, buttonStyle]}>
				<Pressable
					onPress={onContinue}
					style={({ pressed }) => ({
						opacity: pressed ? 0.88 : 1,
						transform: [{ scale: pressed ? 0.997 : 1 }],
					})}
				>
					<Box className="h-[52px] rounded-[26px] flex-row items-center justify-center bg-primary">
						<Text className="text-base font-semibold text-primary-foreground">
							Davom etish
						</Text>
					</Box>
				</Pressable>
			</Animated.View>
		</>
	);
}

// ─── OTP step ─────────────────────────────────────────────────────────────────

type OtpStepProps = {
	isDark: boolean;
	textColor: string;
	mutedColor: string;
	phone: string;
	otp: string;
	setOtp: (v: string) => void;
	errorMsg: string;
	isBusy: boolean;
};

function OtpStep({
	isDark,
	textColor,
	mutedColor,
	phone,
	otp,
	setOtp,
	errorMsg,
	isBusy,
}: OtpStepProps) {
	const skipAnim = useMemo(() => {
		const seen = HAS_SEEN_OTP_ANIM;
		HAS_SEEN_OTP_ANIM = true;
		return seen;
	}, []);

	const headerStyle = useAppleEnter(0, skipAnim);
	const inputStyle = useAppleEnter(140, skipAnim);

	return (
		<>
			<Animated.View style={headerStyle}>
				<Heading
					className="mt-8 text-[32px] leading-[38px] font-bold"
					style={{ color: textColor }}
				>
					Tasdiqlash kodi
				</Heading>
				<Text className="mt-3 text-base leading-6" style={{ color: mutedColor }}>
					<Text className="font-semibold" style={{ color: BRAND_ACCENT }}>
						{phone}
					</Text>{" "}
					raqami uchun{" "}
					<Text className="font-semibold" style={{ color: BRAND_ACCENT }}>
						{BOT_USERNAME}
					</Text>{" "}
					dan 6 xonali kod oling va kiriting.
				</Text>
			</Animated.View>

			<Animated.View style={[{ marginTop: 40 }, inputStyle]}>
				<OtpInput
					value={otp}
					onChange={setOtp}
					disabled={isBusy}
					isDark={isDark}
					autoFocus
				/>

				{errorMsg ? (
					<Text className="mt-4 text-sm text-center text-red-500">
						{errorMsg}
					</Text>
				) : null}

				{isBusy ? (
					<Box className="mt-8 items-center gap-2">
						<ActivityIndicator color={BRAND_ACCENT} />
						<Text className="text-sm" style={{ color: mutedColor }}>
							Tekshirilmoqda...
						</Text>
					</Box>
				) : null}
			</Animated.View>

			<Box className="flex-1" />
		</>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	otpRow: {
		flexDirection: "row",
		gap: 10,
		justifyContent: "center",
	},
	otpBox: {
		width: 48,
		height: 56,
		borderRadius: 14,
		fontSize: 22,
		fontWeight: "700",
		textAlign: "center",
	},
	inputRow: {
		flexDirection: "row",
		alignItems: "center",
		height: 52,
		borderRadius: 16,
		borderWidth: 1.5,
		paddingHorizontal: 14,
		gap: 10,
	},
	prefix: {
		fontSize: 16,
		fontWeight: "600",
	},
	divider: {
		width: 1,
		height: 20,
		backgroundColor: "rgba(128,128,128,0.3)",
	},
	inputField: {
		flex: 1,
		fontSize: 16,
	},
});
