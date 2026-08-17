import React, { useState } from "react";
import { Pressable } from "react-native";
import { Coins, RotateCcw, Sparkles, X, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import {
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalContent,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { useI18n } from "@/locales/i18n-provider";

type TokenConfirmModalProps = {
	isOpen: boolean;
	testName: string;
	tokenCost: number;
	isLoading?: boolean;
	onClose: () => void;
	onConfirm: (skipFuture: boolean) => void;
};

type RuleRowProps = {
	icon: React.ReactNode;
	label: string;
	value: string;
	isLast?: boolean;
};

function RuleRow({ icon, label, value, isLast }: RuleRowProps) {
	return (
		<Box
			className={[
				"flex-row items-center px-4 py-3",
				isLast ? "" : "border-b border-border/50",
			].join(" ")}
		>
			{icon}
			<Text className="ml-3 flex-1 text-sm font-medium">{label}</Text>
			<Text className="text-sm font-semibold text-muted-foreground">{value}</Text>
		</Box>
	);
}

export function TokenConfirmModal({
	isOpen,
	testName,
	tokenCost,
	isLoading,
	onClose,
	onConfirm,
}: TokenConfirmModalProps) {
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const [skipFuture, setSkipFuture] = useState(false);

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="mt-0 mb-0 pt-6 pb-0">
					<Box className="items-center">
						{/* Gold coin icon */}
						<Box
							style={{
								width: 76,
								height: 76,
								borderRadius: 38,
								overflow: "hidden",
								borderWidth: 2,
								borderColor: "rgba(255,184,0,0.38)",
							}}
						>
							<LinearGradient
								colors={["#ffc85a", "#ff9f2f", "#ff784b"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={{
									flex: 1,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Coins size={34} color="#FFFFFF" strokeWidth={2} />
							</LinearGradient>
						</Box>

						<Heading className="mt-5 text-center text-2xl font-bold">
							{t("tokenConfirm.title", "Testni boshlash")}
						</Heading>
						<Text className="mt-1 text-center text-sm text-muted-foreground">
							{testName}
						</Text>

						{/* Token rules card */}
						<Box className="mt-5 w-full rounded-2xl bg-card overflow-hidden">
							<RuleRow
								icon={
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
										<Zap size={15} color="#ff9f2f" strokeWidth={2.3} />
									</Box>
								}
								label={t("tokenConfirm.costLabel", "Yechiladi")}
								value={`${tokenCost} ${t("tokenConfirm.tokenWord", "token")}`}
							/>
							<RuleRow
								icon={
									<Box
										style={{
											width: 32,
											height: 32,
											borderRadius: 16,
											backgroundColor: isDark
												? "rgba(59,130,246,0.18)"
												: "rgba(59,130,246,0.10)",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<RotateCcw size={15} color="#3b82f6" strokeWidth={2.3} />
									</Box>
								}
								label={t("tokenConfirm.refundLabel", "Qaytariladi")}
								value={t("tokenConfirm.refundCondition", "80%+ natijada")}
							/>
							<RuleRow
								icon={
									<Box
										style={{
											width: 32,
											height: 32,
											borderRadius: 16,
											backgroundColor: isDark
												? "rgba(16,185,129,0.18)"
												: "rgba(16,185,129,0.10)",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Sparkles size={15} color="#10b981" strokeWidth={2.3} />
									</Box>
								}
								label={t("tokenConfirm.bonusLabel", "Bonus tokenlar")}
								value={t("tokenConfirm.bonusCondition", "Muvaffaqiyatda")}
								isLast
							/>
						</Box>

						{/* Description */}
						<Text className="mt-3 text-center text-xs leading-[18px] text-muted-foreground px-1">
							{t(
								"tokenConfirm.description",
								"Test boshlanishida tokenlar yechiladi. 80% va undan yuqori natija olsangiz — tokenlar qaytariladi va bonus tokenlar ham beriladi.",
							)}
						</Text>

						{/* Don't show again checkbox */}
						<Pressable
							className="mt-4 flex-row items-center gap-3 self-stretch"
							onPress={() => setSkipFuture((prev) => !prev)}
						>
							<Box
								style={{
									width: 22,
									height: 22,
									borderRadius: 6,
									borderWidth: 1.5,
									borderColor: skipFuture
										? "#ff9f2f"
										: isDark
											? "#5a5a5a"
											: "#d0d0d0",
									backgroundColor: skipFuture ? "#ff9f2f" : "transparent",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{skipFuture ? (
									<Text
										style={{
											color: "#FFFFFF",
											fontSize: 12,
											fontWeight: "700",
											lineHeight: 14,
										}}
									>
										✓
									</Text>
								) : null}
							</Box>
							<Text className="text-sm text-muted-foreground flex-1">
								{t("tokenConfirm.dontShowAgain", "Keyingi safar ko'rsatma")}
							</Text>
						</Pressable>

						{/* Start button */}
						<Pressable
							className="mt-5 w-full"
							onPress={() => onConfirm(skipFuture)}
							disabled={isLoading}
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							<LinearGradient
								colors={["#ffc85a", "#ff9f2f", "#ff784b"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={{
									height: 52,
									borderRadius: 26,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Text
									style={{
										color: "#1B1203",
										fontSize: 16,
										fontWeight: "700",
									}}
								>
									{t("tokenConfirm.confirmButton", "Boshlash")}
								</Text>
							</LinearGradient>
						</Pressable>

						{/* Cancel */}
						<Pressable
							className="mt-2 w-full items-center py-3"
							onPress={onClose}
						>
							<Text className="text-sm font-semibold text-muted-foreground">
								{t("common.cancel", "Bekor qilish")}
							</Text>
						</Pressable>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
