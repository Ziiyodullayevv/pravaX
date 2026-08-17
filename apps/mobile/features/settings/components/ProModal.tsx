import React from "react";
import { Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import type { PlanItem } from "../types";
import { ImageBackground } from "@/components/ui/image-background";
import {
	Actionsheet,
	ActionsheetBackdrop,
	ActionsheetContent,
} from "@/components/ui/actionsheet";

type ProModalProps = {
	visible: boolean;
	onClose: () => void;
	plans: PlanItem[];
	selectedPlanId: string;
	onSelectPlan: (id: string) => void;
	onStartTrial?: () => void;
	onHowToCancel?: () => void;
	onRestorePurchase?: () => void;
	onPrivacyPolicy?: () => void;
};

export function ProModal({
	visible,
	onClose,
	plans,
	selectedPlanId,
	onSelectPlan,
	onStartTrial,
	onHowToCancel,
	onRestorePurchase,
	onPrivacyPolicy,
}: ProModalProps) {
	const insets = useSafeAreaInsets();

	const handleStartTrial = onStartTrial ?? (() => {});
	const handleHowToCancel = onHowToCancel ?? (() => {});
	const handleRestorePurchase = onRestorePurchase ?? (() => {});
	const handlePrivacyPolicy = onPrivacyPolicy ?? (() => {});
	const ctaBottomInset = Math.max(insets.bottom, 20);

	return (
		<Actionsheet
			isOpen={visible}
			onClose={onClose}
			useRNModal={false}
			snapPoints={[100]}
		>
			<ActionsheetBackdrop onPress={onClose} />
			<ActionsheetContent className="flex-1 min-h-full max-h-full w-full rounded-none border-t-0 bg-black p-0 items-stretch">
				<Box className="flex-1 bg-black">
					{/* Top image header */}
					<Box>
						<ImageBackground
							source={{
								uri: "https://avatars.mds.yandex.net/get-autoru-reviews/11380780/f5ddc3bb749e3d43a8585f51033d7f5b/1200x900",
							}}
							resizeMode="cover"
							className="w-full h-[340px]"
						>
							{/* ✅ Transparent -> black gradient (bottom fade) */}
							<LinearGradient
								colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 0, y: 1 }}
								style={{
									position: "absolute",
									left: 0,
									right: 0,
									bottom: 0,
									height: 100,
								}}
							/>
						</ImageBackground>

						{/* Close button */}
						<Pressable
							className="absolute top-6 right-6 h-12 w-12 rounded-full bg-black/60 items-center border border-border justify-center"
							onPress={onClose}
							style={({ pressed }) => ({
								top: insets.top + 12,
								opacity: pressed ? 0.7 : 1,
							})}
						>
							<X size={20} color="#fff" />
						</Pressable>
					</Box>

					{/* Content */}
					<ScrollView
						className="flex-1"
						bounces={false}
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{
							paddingHorizontal: 20,
							paddingTop: 12,
							paddingBottom: ctaBottomInset + 120,
						}}
					>
						<Box className="flex-row items-center gap-2">
							<StatusBar hidden />
							<Heading className="text-white mx-auto text-2xl font-semibold">
								Prava X
							</Heading>
						</Box>

						<Text className="mt-2 text-sm text-center text-white/70">
							Unlock all premium features and functions. No Watermark, No Ads
						</Text>

						{/* Plans */}
						<Box className="mt-5 gap-3">
							{plans.map((plan) => {
								const selected = plan.id === selectedPlanId;

								return (
									<Pressable
										key={plan.id}
										onPress={() => onSelectPlan(plan.id)}
										style={({ pressed }) => ({
											opacity: pressed ? 0.85 : 1,
										})}
									>
										<Box
											className={[
												"rounded-2xl px-4 py-4",
												selected ? "bg-white/10" : "bg-white/5",
											].join(" ")}
											style={{
												borderWidth: 1,
												borderColor: selected
													? "rgba(255,255,255,0.25)"
													: "rgba(255,255,255,0.08)",
											}}
										>
											<Box className="flex-row items-center justify-between">
												<Box className="flex-row items-center gap-3 flex-1">
													{/* Radio */}
													<Box
														className="h-5 w-5 rounded-full items-center justify-center"
														style={{
															borderWidth: 1.5,
															borderColor: selected
																? "#ffffff"
																: "rgba(255,255,255,0.35)",
														}}
													>
														{selected ? (
															<Box className="h-2.5 w-2.5 rounded-full bg-white" />
														) : null}
													</Box>

													{/* Text */}
													<Box className="flex-1">
														<Text className="text-base font-semibold text-white">
															{plan.title}
														</Text>

														<Text className="text-xs text-white/60">
															{plan.period ? `${plan.period} / ` : ""}
															{plan.price}{" "}
															{!!plan.oldPrice && (
																<Text className="line-through text-white/40">
																	{plan.oldPrice}
																</Text>
															)}
														</Text>
													</Box>
												</Box>

												{/* Discount */}
												{!!plan.discount && (
													<Box className="rounded-md bg-white/20 px-2 py-1">
														<Text className="text-xs font-semibold text-white">
															{plan.discount}
														</Text>
													</Box>
												)}
											</Box>
										</Box>
									</Pressable>
								);
							})}
						</Box>
					</ScrollView>

					{/* Bottom CTA */}
					<Box
						className="absolute left-0 right-0 bottom-0 z-10 px-5 pt-3 bg-black"
						style={{ paddingBottom: ctaBottomInset }}
					>
						<Pressable
							className="rounded-2xl bg-[#ff4d6d] px-5 py-4"
							onPress={handleStartTrial}
							style={({ pressed }) => ({
								opacity: pressed ? 0.85 : 1,
								transform: [{ scale: pressed ? 0.99 : 1 }],
							})}
						>
							<Text className="text-center text-base font-semibold text-white">
								Start 7 Days Free Trial
							</Text>
						</Pressable>
					</Box>
				</Box>
			</ActionsheetContent>
		</Actionsheet>
	);
}
