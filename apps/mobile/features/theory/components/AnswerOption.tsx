import React from "react";
import { Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, X } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";

export type AnswerOptionStatus =
	| "default"
	| "selected"
	| "correct"
	| "wrong"
	| "hint-correct";

type AnswerOptionProps = {
	label: string;
	text: string;
	status: AnswerOptionStatus;
	disabled?: boolean;
	onPress: () => void;
};

export function AnswerOption({
	label,
	text,
	status,
	disabled = false,
	onPress,
}: AnswerOptionProps) {
	const { colorMode } = useAppTheme();
	const isDark = colorMode === "dark";
	const isWrong = status === "wrong";
	const isCorrect = status === "correct";
	const isHint = status === "hint-correct";
	const isSelected = status === "selected";
	const correctBorderColor = isDark ? "#70E876" : "#51A776";
	const wrongBorderColor = isDark ? "#FF6467" : "#E7000B";
	const selectedBorderColor = isDark ? "rgba(250,250,250,0.45)" : "rgba(10,10,10,0.35)";
	const stateBorderColor = isWrong
		? wrongBorderColor
		: isCorrect || isHint
			? correctBorderColor
			: isSelected
				? selectedBorderColor
				: undefined;
	const cardBackgroundColor = isDark ? "#373737" : "#ffffff";
	const gradientBorderColors: [string, string, string] = isDark
		? [
				"rgba(92,92,92,0.56)",
				"rgba(37,37,37,0.72)",
				"rgba(82,82,82,0.5)",
			]
		: [
				"rgba(205,205,205,0.82)",
				"rgba(245,245,245,1)",
				"rgba(210,210,210,0.72)",
			];

	return (
		<Pressable disabled={disabled} onPress={onPress}>
			<LinearGradient
				colors={gradientBorderColors}
				start={{ x: 1, y: 1 }}
				end={{ x: 0, y: 0 }}
				style={{
					borderRadius: 18,
					padding: 0.8,
				}}
			>
				<Box
					className="rounded-[17.2px] border-2 shadow-sm px-4 py-4 flex-row items-center gap-3"
					style={[
						{ backgroundColor: cardBackgroundColor },
						{
							borderColor: stateBorderColor ?? cardBackgroundColor,
						},
					]}
				>
					<Box
						className={[
							"h-9 w-9 rounded-full items-center justify-center",
							isWrong || isCorrect || isHint
								? "border-2"
								: isSelected
									? "border border-foreground/50"
									: "border border-border",
						].join(" ")}
						style={
							isWrong || isCorrect || isHint
								? {
										borderColor: isWrong
											? wrongBorderColor
											: correctBorderColor,
										backgroundColor: "transparent",
									}
								: { backgroundColor: "transparent" }
						}
					>
						{isCorrect || isHint ? (
							<Check size={21} color={correctBorderColor} strokeWidth={2.5} />
						) : isWrong ? (
							<X size={20} color={wrongBorderColor} strokeWidth={2.5} />
						) : (
							<Text className="text-sm font-semibold">{label}</Text>
						)}
					</Box>

					<Text className="flex-1 text-base font-normal">{text}</Text>
				</Box>
			</LinearGradient>
		</Pressable>
	);
}
