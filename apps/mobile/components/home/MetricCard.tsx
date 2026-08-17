import React from "react";
import Svg, { Circle } from "react-native-svg";
import Animated, {
	Easing,
	useAnimatedProps,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

import { METRIC_RING_COLOR } from "./constants";
import type { HomePalette, MetricItem } from "./types";
import { colorWithAlpha } from "./utils";

type MetricCardProps = {
	item: MetricItem;
	palette: HomePalette;
};

type AnimatedProgressArcProps = {
	size: number;
	radius: number;
	strokeWidth: number;
	circumference: number;
	progress: number;
	color: string;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_ANIMATION_DURATION_MS = 700;

function AnimatedProgressArc({
	size,
	radius,
	strokeWidth,
	circumference,
	progress,
	color,
}: AnimatedProgressArcProps) {
	const clampedProgress = Math.max(0, Math.min(100, progress));
	const animatedProgress = useSharedValue(0);

	React.useEffect(() => {
		animatedProgress.value = withTiming(clampedProgress, {
			duration: RING_ANIMATION_DURATION_MS,
			easing: Easing.out(Easing.cubic),
		});
	}, [animatedProgress, clampedProgress]);

	const animatedProps = useAnimatedProps(() => {
		return {
			strokeDashoffset: circumference * (1 - animatedProgress.value / 100),
		};
	});

	return (
		<AnimatedCircle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			stroke={color}
			strokeWidth={strokeWidth}
			fill="none"
			strokeLinecap="round"
			strokeDasharray={`${circumference} ${circumference}`}
			transform={`rotate(-90 ${size / 2} ${size / 2})`}
			animatedProps={animatedProps}
		/>
	);
}

function MetricCardImpl({ item, palette }: MetricCardProps) {
	const Icon = item.icon;
	const size = 55;
	const strokeWidth = 2;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	if (item.type === "score") {
		const toneColor =
			item.score >= item.minTarget
				? "#22c55e"
				: item.score >= 70
					? METRIC_RING_COLOR
					: "#ef4444";
		const clampedScore = Math.max(0, Math.min(100, item.score));

		return (
			<Box className="flex-1 rounded-[28px] bg-card p-2 min-h-[132px]">
				<Box className="relative ml-0.5 mt-0.5 shadow-lg h-[55px] w-[55px] rounded-full items-center justify-center">
					<Svg width={size} height={size} style={{ position: "absolute" }}>
						<Circle
							cx={size / 2}
							cy={size / 2}
							r={radius}
							stroke={colorWithAlpha(palette.tabIconDefault, 0.2)}
							strokeWidth={strokeWidth}
							fill="none"
						/>
						<AnimatedProgressArc
							size={size}
							radius={radius}
							strokeWidth={strokeWidth}
							circumference={circumference}
							progress={clampedScore}
							color={toneColor}
						/>
					</Svg>
					<Box className="w-10 h-10 bg-foreground/10 justify-center items-center rounded-full">
						<Icon size={19} color={palette.text} strokeWidth={2} />
					</Box>
				</Box>

				<Box className="px-2 py-3">
					<Text className="text-[30px] font-semibold" style={{ color: palette.text }}>
						{`${item.score}%`}
					</Text>
					<Text className="text-xs" style={{ color: palette.tabIconDefault }}>
						{item.label}
					</Text>
				</Box>
			</Box>
		);
	}

	const clampedProgress = Math.max(0, Math.min(100, item.progress));

	return (
			<Box className="flex-1 rounded-[28px] bg-card p-2 min-h-[132px]">
			<Box className="relative ml-0.5 mt-0.5 shadow-lg h-[55px] w-[55px] rounded-full items-center justify-center">
				<Svg width={size} height={size} style={{ position: "absolute" }}>
					<Circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						stroke={colorWithAlpha(palette.tabIconDefault, 0.2)}
						strokeWidth={strokeWidth}
						fill="none"
					/>
					<AnimatedProgressArc
						size={size}
						radius={radius}
						strokeWidth={strokeWidth}
						circumference={circumference}
						progress={clampedProgress}
						color={METRIC_RING_COLOR}
					/>
				</Svg>
				<Box className="w-10 h-10 bg-foreground/10 justify-center items-center rounded-full">
					<Icon size={19} color={palette.text} strokeWidth={2} />
				</Box>
			</Box>

			<Box className="px-2 py-3">
				<Text
					className="text-base font-semibold"
					style={{ color: palette.text }}
					numberOfLines={1}
					adjustsFontSizeToFit
					minimumFontScale={0.78}
				>
					{item.value}
				</Text>
				<Text className="text-xs" style={{ color: palette.tabIconDefault }}>
					{item.label}
				</Text>
			</Box>
		</Box>
	);
}

const MetricCard = React.memo(MetricCardImpl);
export default MetricCard;
