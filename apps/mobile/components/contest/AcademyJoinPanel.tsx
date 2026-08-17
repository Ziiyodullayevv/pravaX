import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Sparkles } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { useJoinAcademyMutation } from "@/features/contests/api";
import { getErrorMessage } from "@/lib/api";

type AcademyJoinPanelProps = {
	width: number;
	onJoined?: () => void;
};

export function AcademyJoinPanel({ width, onJoined }: AcademyJoinPanelProps) {
	const { colorMode } = useAppTheme();
	const isDark = colorMode === "dark";
	const router = useRouter();

	const [inviteCode, setInviteCode] = useState("");
	const [errorMsg, setErrorMsg] = useState("");
	const [proRequired, setProRequired] = useState(false);

	const joinMutation = useJoinAcademyMutation();

	const handleJoin = useCallback(async () => {
		const code = inviteCode.trim().toUpperCase();
		if (code.length === 0) {
			setErrorMsg("Invite kodni kiriting");
			return;
		}
		setErrorMsg("");
		setProRequired(false);
		try {
			await joinMutation.mutateAsync({ inviteCode: code });
			setInviteCode("");
			onJoined?.();
		} catch (err) {
			const axiosErr = err as {
				response?: {
					status?: number;
					data?: {
						detail?: string;
						current_academy_id?: number;
						current_academy_name?: string;
					};
				};
			};
			const status = axiosErr.response?.status;
			const data = axiosErr.response?.data;

			// 403 — Pro tarif talab qilinadi
			if (status === 403) {
				setProRequired(true);
				return;
			}

			// 400 — foydalanuvchi boshqa akademiyada bo'lsa
			if (status === 400) {
				const currentName = data?.current_academy_name;
				if (currentName) {
					setErrorMsg(`Siz allaqachon "${currentName}" akademiyasi a'zosisiz.`);
				} else {
					// current_academy_name yo'q → xuddi shu akademiyaga qayta urinish
					setInviteCode("");
					onJoined?.();
				}
				return;
			}

			const msg = getErrorMessage(err);
			const lower = msg.toLowerCase();
			// Boshqa "already a member" variantlari → muvaffaqiyat
			if (
				lower.includes("allaqachon") ||
				lower.includes("already") ||
				lower.includes("a'zo") ||
				lower.includes("member")
			) {
				setInviteCode("");
				onJoined?.();
			} else {
				setErrorMsg(msg);
			}
		}
	}, [inviteCode, joinMutation, onJoined]);

	const textColor = isDark ? "#f5f5f5" : "#141414";
	const mutedColor = isDark ? "#b0b0b0" : "#5f5f5f";
	const inputBg = isDark ? "#1a1a1a" : "#f5f5f5";
	const inputBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
	const cardBg = isDark ? "#1f1f1f" : "#ffffff";

	return (
		<Box className="overflow-hidden rounded-[32px]" style={{ width }}>
			<LinearGradient
				colors={
					isDark
						? ["rgba(255,159,47,0.20)", "rgba(255,255,255,0.06)"]
						: ["rgba(255,159,47,0.24)", "rgba(255,255,255,0.92)"]
				}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={{ borderRadius: 32, padding: 1 }}
			>
				<Box
					className="rounded-[31px] px-5 py-5"
					style={{ backgroundColor: cardBg }}
				>
					{/* Header */}
					<Box className="flex-row items-start gap-4">
						<View
							style={{
								width: 48,
								height: 48,
								borderRadius: 16,
								backgroundColor: "rgba(255,159,47,0.2)",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Crown size={24} color="#ff9f2f" strokeWidth={2.2} />
						</View>
						<Box className="flex-1">
							<Heading
								className="text-xl font-bold"
								style={{ color: textColor }}
							>
								Akademiyaga qo'shilish
							</Heading>
							<Text
								className="mt-2 text-sm leading-5"
								style={{ color: mutedColor }}
							>
								Akademiyaga qo'shilish uchun invite kodni kiriting.
							</Text>
						</Box>
					</Box>

					{/* Invite code section */}
					<Text
						className="mt-5 text-xs uppercase tracking-wider"
						style={{ color: mutedColor }}
					>
						Invite kod
					</Text>
					<TextInput
						value={inviteCode}
						onChangeText={(v) => setInviteCode(v.toUpperCase())}
						placeholder="PRAVA-2026-A1B2C3"
						placeholderTextColor={mutedColor}
						autoCapitalize="characters"
						autoCorrect={false}
						style={{
							marginTop: 8,
							height: 52,
							borderRadius: 16,
							backgroundColor: inputBg,
							borderWidth: 1,
							borderColor: inputBorder,
							paddingHorizontal: 16,
							fontSize: 16,
							fontWeight: "600",
							color: textColor,
							letterSpacing: 0.5,
						}}
					/>

					{errorMsg ? (
						<Text className="mt-2 text-xs text-red-500">{errorMsg}</Text>
					) : null}

					{proRequired ? (
						<Box
							className="mt-3 rounded-2xl px-4 py-4"
							style={{
								backgroundColor: isDark
									? "rgba(255,159,47,0.12)"
									: "rgba(255,159,47,0.1)",
								borderWidth: 1,
								borderColor: "rgba(255,159,47,0.3)",
							}}
						>
							<Box className="flex-row items-center gap-2">
								<Sparkles size={15} color="#ff9f2f" strokeWidth={2.2} />
								<Text
									className="text-sm font-semibold"
									style={{ color: "#ff9f2f" }}
								>
									Pro tarif talab qilinadi
								</Text>
							</Box>
							<Text
								className="mt-1 text-xs leading-5"
								style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)" }}
							>
								Akademiyaga qo'shilish uchun Pro tarifni faollashtiring.
							</Text>
							<Pressable
								className="mt-3"
								onPress={() => router.push("/tabs/(tabs)/settings")}
								style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
							>
								<Box
									className="rounded-full py-2.5 items-center"
									style={{
										backgroundColor: "rgba(255,159,47,0.18)",
										borderWidth: 1,
										borderColor: "rgba(255,159,47,0.4)",
									}}
								>
									<Text
										className="text-sm font-semibold"
										style={{ color: "#ff9f2f" }}
									>
										Pro tarif olish →
									</Text>
								</Box>
							</Pressable>
						</Box>
					) : null}

					{/* Submit */}
					<Pressable
						onPress={handleJoin}
						disabled={joinMutation.isPending}
						style={({ pressed }) => ({
							marginTop: 28,
							opacity: pressed || joinMutation.isPending ? 0.88 : 1,
						})}
					>
						<LinearGradient
							colors={["#ffbd57", "#ff7a45"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={{
								height: 52,
								borderRadius: 18,
								alignItems: "center",
								justifyContent: "center",
								flexDirection: "row",
							}}
						>
							{joinMutation.isPending ? (
								<ActivityIndicator color="#1B1203" />
							) : (
								<Text className="text-base font-bold text-[#1B1203]">
									Qo'shilish
								</Text>
							)}
						</LinearGradient>
					</Pressable>
				</Box>
			</LinearGradient>
		</Box>
	);
}
