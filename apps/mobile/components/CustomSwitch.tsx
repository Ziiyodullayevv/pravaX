import React, { useEffect, useMemo, useRef } from "react";
import {
	Animated,
	Easing,
	Pressable,
	StyleSheet,
	View,
	type GestureResponderEvent,
	type StyleProp,
	type ViewStyle,
} from "react-native";

type CustomSwitchProps = {
	value: boolean;
	onValueChange: (next: boolean) => void;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
	width?: number;
	height?: number;
	padding?: number;
	trackOnColor?: string;
	trackOffColor?: string;
	borderColor?: string;
	thumbColor?: string;
};

export function CustomSwitch({
	value,
	onValueChange,
	disabled = false,
	style,
	width = 56,
	height = 32,
	padding = 3,
	trackOnColor = "#22c55e",
	trackOffColor = "#e5e7eb",
	borderColor = "#d1d5db",
	thumbColor = "#ffffff",
}: CustomSwitchProps) {
	const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

	const thumbDiameter = height - padding * 2;
	const maxTranslateX = width - padding * 2 - thumbDiameter;
	const indicatorHeight = Math.max(10, Math.min(14, height * 0.42));
	const indicatorWidth = Math.max(2, Math.min(3, height * 0.09));
	const indicatorLeft = padding + Math.min(10, Math.max(4, width * 0.18));

	const thumbTranslateX = useMemo(
		() =>
			progress.interpolate({
				inputRange: [0, 1],
				outputRange: [0, maxTranslateX],
			}),
		[progress, maxTranslateX],
	);

	useEffect(() => {
		Animated.timing(progress, {
			toValue: value ? 1 : 0,
			duration: 220,
			easing: Easing.inOut(Easing.ease),
			useNativeDriver: false,
		}).start();
	}, [progress, value]);

	const handlePress = (event: GestureResponderEvent) => {
		event.stopPropagation();
		if (disabled) return;
		onValueChange(!value);
	};

	return (
		<Pressable
			onPress={handlePress}
			disabled={disabled}
			accessibilityRole="switch"
			accessibilityState={{ checked: value, disabled }}
			hitSlop={10}
			style={style}
		>
			<View
				style={[
					styles.track,
					{
						width,
						height,
						borderRadius: height / 2,
						backgroundColor: value ? trackOnColor : trackOffColor,
						borderColor: value ? trackOnColor : borderColor,
						opacity: disabled ? 0.5 : 1,
					},
				]}
			>
				<View
					style={{
						position: "absolute",
						left: indicatorLeft,
						height: indicatorHeight,
						width: indicatorWidth,
						borderRadius: indicatorWidth / 2,
						backgroundColor: value
							? "rgba(255,255,255,0.72)"
							: "rgba(107,114,128,0.62)",
					}}
				/>

				<Animated.View
					style={[
						styles.thumb,
						{
							left: padding,
							width: thumbDiameter,
							height: thumbDiameter,
							borderRadius: thumbDiameter / 2,
							backgroundColor: thumbColor,
							transform: [{ translateX: thumbTranslateX }],
						},
					]}
				/>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	track: {
		borderWidth: 1,
		justifyContent: "center",
	},
	thumb: {
		position: "absolute",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1.5,
		elevation: 2,
	},
});
