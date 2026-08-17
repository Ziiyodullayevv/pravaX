import React from "react";
import { Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Clock3, Zap } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Image } from "@/components/ui/image";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";

import { WORKOUT_CARD_GRADIENTS } from "./constants";
import type { HomePalette, WorkoutItem } from "./types";
import { colorWithAlpha } from "./utils";

type WorkoutCardProps = {
	item: WorkoutItem;
	palette: HomePalette;
	isDark: boolean;
	index: number;
	onPress?: () => void;
};

export default function WorkoutCard({
	item,
	palette,
	isDark,
	index,
	onPress,
}: WorkoutCardProps) {
	const textOnCard = isDark ? Colors.dark.text : Colors.light.background;
	const RightIcon = item.rightIcon;
	const gradientColors =
		WORKOUT_CARD_GRADIENTS[index % WORKOUT_CARD_GRADIENTS.length];
	const badgeTint = isDark ? "dark" : "light";

	const badgeStyle = {
		backgroundColor: colorWithAlpha(textOnCard, 0.12),
		borderColor: colorWithAlpha(textOnCard, 0.22),
		borderWidth: 1,
		borderRadius: 999,
		overflow: "hidden" as const,
	};

	return (
		<Pressable onPress={onPress} disabled={!onPress}>
			<LinearGradient
				colors={gradientColors}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={{
					borderRadius: 24,
					overflow: "hidden",
					minHeight: 200,
					padding: 16,
					position: "relative",
				}}
			>
				{item.image ? (
					<Image
						className="absolute right-0 bottom-0 w-[150px] h-[150px]"
						source={item.image}
						alt={item.title}
						resizeMode="cover"
					/>
				) : RightIcon ? (
					<Box
						className="absolute right-4 bottom-4 h-20 w-20 rounded-full items-center justify-center"
						style={{ backgroundColor: colorWithAlpha(textOnCard, 0.16) }}
					>
						<RightIcon
							size={40}
							color={textOnCard}
							strokeWidth={2.25}
						/>
					</Box>
				) : null}

				<Box className="max-w-[70%]">
					<Box
						className="self-start rounded-full px-3 py-1.5"
						style={{
							borderWidth: 1,
							borderColor: colorWithAlpha(textOnCard, 0.35),
							backgroundColor: colorWithAlpha(textOnCard, 0.12),
						}}
					>
						<Text className="text-sm font-medium" style={{ color: textOnCard }}>
							{item.day}
						</Text>
					</Box>

					<Heading
						className="mt-3 text-2xl font-semibold leading-8"
						style={{ color: textOnCard }}
					>
						{item.title}
					</Heading>
				</Box>

				<Box className="mt-auto pt-5 flex-row items-center gap-2">
					<BlurView
						intensity={24}
						tint={badgeTint}
						style={badgeStyle}
						blurMethod="dimezisBlurView"
					>
						<Box className="rounded-full px-3 py-1.5">
							<Text className="text-sm font-medium" style={{ color: textOnCard }}>
								{item.reps}
							</Text>
						</Box>
					</BlurView>
					<BlurView
						intensity={24}
						tint={badgeTint}
						style={badgeStyle}
						blurMethod="dimezisBlurView"
					>
						<Box className="rounded-full px-3 py-1.5 flex-row items-center gap-1">
							<Clock3 size={14} color={textOnCard} />
							<Text className="text-sm font-medium" style={{ color: textOnCard }}>
								{item.duration}
							</Text>
						</Box>
					</BlurView>
					<BlurView
						intensity={24}
						tint={badgeTint}
						style={badgeStyle}
						blurMethod="dimezisBlurView"
					>
						<Box className="rounded-full px-3 py-1.5 flex-row items-center gap-1">
							<Zap size={14} color={textOnCard} />
							<Text className="text-sm font-medium" style={{ color: textOnCard }}>
								{item.energy}
							</Text>
						</Box>
					</BlurView>
				</Box>
			</LinearGradient>
		</Pressable>
	);
}
