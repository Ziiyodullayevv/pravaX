import React from "react";
import Svg, { Circle } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/Colors";

type ProgressRingProps = {
	progress: number;
	size?: number;
	strokeWidth?: number;
	progressColor?: string;
	trackColor?: string;
};

export function ProgressRing({
	progress,
	size = 48,
	strokeWidth = 4,
	progressColor,
	trackColor,
}: ProgressRingProps) {
	const { colorMode } = useAppTheme();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;

	const clamped = Math.max(0, Math.min(100, progress));
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - clamped / 100);

	return (
		<Box
			className="items-center justify-center rounded-full"
			style={{ width: size, height: size }}
		>
			<Svg width={size} height={size}>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={trackColor ?? palette.forground}
					strokeWidth={strokeWidth}
					fill="none"
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={progressColor ?? palette.tint}
					strokeWidth={strokeWidth}
					fill="none"
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={offset}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</Svg>
			<Text className="absolute text-[12px] font-semibold">{clamped}%</Text>
		</Box>
	);
}
