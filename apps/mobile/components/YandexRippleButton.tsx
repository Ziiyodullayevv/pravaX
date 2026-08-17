import React from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/contexts/theme-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type YandexRippleButtonProps = PressableProps & {
	children: React.ReactNode;
	rippleOpacity?: number;
	duration?: number;
	borderRadius?: number;
	rippleColor?: string;
	disableFeedback?: boolean;
};

function YandexRippleButtonImpl({
	children,
	onPressIn,
	onPressOut,
	rippleOpacity,
	duration = 320,
	borderRadius = 20,
	rippleColor,
	disableFeedback = false,
	style,
	...props
}: YandexRippleButtonProps) {
	const { colorMode } = useAppTheme();
	const isLight = colorMode === "light";

	// Dark mode: white overlay
	const resolvedColor = rippleColor ?? "#FFFFFF";
	const resolvedOverlayOpacity = rippleOpacity ?? 0.055;

	// Light mode: dim effect (iOS-style) — no color overlay needed
	const dimSv = useSharedValue(1);
	const overlayOpacitySv = useSharedValue(0);

	const pressAnimStyle = useAnimatedStyle(() => ({
		opacity: dimSv.value,
	}));

	const overlayStyle = useAnimatedStyle(() => ({
		opacity: overlayOpacitySv.value,
	}));

	const handlePressIn = React.useCallback<NonNullable<PressableProps["onPressIn"]>>(
		(event) => {
			if (disableFeedback) {
				onPressIn?.(event);
				return;
			}
			if (isLight) {
				dimSv.value = withTiming(0.65, {
					duration: 120,
					easing: Easing.out(Easing.cubic),
				});
			} else {
				overlayOpacitySv.value = withTiming(resolvedOverlayOpacity, {
					duration: 120,
					easing: Easing.out(Easing.cubic),
				});
			}
			onPressIn?.(event);
		},
		[onPressIn, isLight, dimSv, overlayOpacitySv, resolvedOverlayOpacity, disableFeedback],
	);

	const handlePressOut = React.useCallback<NonNullable<PressableProps["onPressOut"]>>(
		(event) => {
			if (disableFeedback) {
				onPressOut?.(event);
				return;
			}
			if (isLight) {
				dimSv.value = withTiming(1, {
					duration,
					easing: Easing.out(Easing.cubic),
				});
			} else {
				overlayOpacitySv.value = withTiming(0, {
					duration,
					easing: Easing.out(Easing.cubic),
				});
			}
			onPressOut?.(event);
		},
		[duration, onPressOut, isLight, dimSv, overlayOpacitySv, disableFeedback],
	);

	const composedStyle = React.useMemo<PressableProps["style"]>(() => {
		if (typeof style === "function") {
			return (state) => [styles.button, { borderRadius }, style(state)];
		}
		return [styles.button, { borderRadius }, style];
	}, [borderRadius, style]);

	return (
		<AnimatedPressable
			{...props}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={[composedStyle, pressAnimStyle]}
		>
			{children}
			{!isLight && (
				<View
					pointerEvents="none"
					style={[StyleSheet.absoluteFillObject, { overflow: "hidden", borderRadius }]}
				>
					<Animated.View
						style={[styles.overlay, { backgroundColor: resolvedColor }, overlayStyle]}
					/>
				</View>
			)}
		</AnimatedPressable>
	);
}

const styles = StyleSheet.create({
	button: {
		position: "relative",
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
	},
});

export const YandexRippleButton = React.memo(YandexRippleButtonImpl);
