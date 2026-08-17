import React from "react";
import { Pressable } from "react-native";
import type { ComponentType } from "react";
import { ChevronRight, CircleCheck, CircleHelp, Lock } from "lucide-react-native";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type TopicIcon = ComponentType<{
	size?: number;
	color?: string;
	strokeWidth?: number;
}>;

type TopicCardProps = {
	title: string;
	subtitle: string;
	progressLabel: string;
	progressColor?: string;
	completed: boolean;
	icon: TopicIcon;
	textColor: string;
	mutedColor: string;
	onPress: () => void;
	locked?: boolean;
};

function TopicCardImpl({
	title,
	subtitle,
	progressLabel,
	progressColor,
	completed,
	icon: Icon,
	textColor,
	mutedColor,
	onPress,
	locked = false,
}: TopicCardProps) {
	const lockedIconColor = "#F59E0B";
	const resolvedProgressColor = progressColor ?? (completed ? "#0f8b5f" : mutedColor);

	return (
		<Pressable onPress={onPress} disabled={locked}>
			<Box
				className={[
					"rounded-3xl bg-card px-4 py-4",
					locked ? "opacity-70" : "",
				].join(" ")}
			>
				<Box className="flex-row items-start gap-2">
					<GradientIconFrame>
						{locked ? (
							<Lock size={20} color={lockedIconColor} strokeWidth={2.1} />
						) : (
							<Icon size={20} color={textColor} strokeWidth={1.9} />
						)}
					</GradientIconFrame>

					<Box className="ml-4 flex-1">
						<Heading className="text-sm font-semibold">{title}</Heading>
						<Text className="mt-1 text-sm text-foreground/70">{subtitle}</Text>

						<Box className="mt-3 flex-row items-center gap-2">
							{completed ? (
								<CircleCheck size={18} color={resolvedProgressColor} />
							) : (
								<CircleHelp size={18} color={resolvedProgressColor} />
							)}
							<Text
								className="text-sm"
								style={{ color: resolvedProgressColor }}
							>
								{progressLabel}
							</Text>
						</Box>
					</Box>

					<Box className="-mr-1 mt-1">
						<ChevronRight size={22} color={mutedColor} />
					</Box>
				</Box>
			</Box>
		</Pressable>
	);
}

export const TopicCard = React.memo(TopicCardImpl);
