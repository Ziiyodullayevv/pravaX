import React, { useEffect } from "react";
import {
	Pressable,
	type StyleProp,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

type TabBarButtonProps = {
	isFocused: boolean;
	label: string;
	tintColor: string;
	icon?: React.ReactNode;
	activeTranslateY?: number;
	onPress: () => void;
	onLongPress?: () => void;
	accessibilityLabel?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
	labelStyle?: StyleProp<TextStyle>;
};

function TabBarButtonImpl({
	isFocused,
	label,
	tintColor,
	icon,
	activeTranslateY = 8,
	onPress,
	onLongPress,
	accessibilityLabel,
	testID,
	style,
	labelStyle,
}: TabBarButtonProps) {
	const scale = useSharedValue(0);

	useEffect(() => {
		scale.value = withTiming(isFocused ? 1 : 0, {
			duration: 200,
			easing: Easing.out(Easing.cubic),
		});
	}, [scale, isFocused]);

	const animatedTextStyle = useAnimatedStyle(() => {
		const opacity = interpolate(scale.value, [0, 1], [1, 0.92]);

		return {
			opacity,
		};
	});

	const animatedIconStyle = useAnimatedStyle(() => {
		const scaleValue = interpolate(scale.value, [0, 1], [1, 1.04]);
		const translateY = interpolate(scale.value, [0, 1], [0, activeTranslateY]);

		return {
			transform: [
				{ translateY },
				{
					scale: scaleValue,
				},
			],
		};
	});
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={isFocused ? { selected: true } : {}}
			accessibilityLabel={accessibilityLabel}
			testID={testID}
			onPress={onPress}
			onLongPress={onLongPress}
			style={[
				{ alignItems: "center", justifyContent: "center", paddingVertical: 0 },
				style,
			]}
		>
			<Animated.View
				style={[
					{ minHeight: 20, alignItems: "center", justifyContent: "center" },
					animatedIconStyle,
				]}
			>
				{icon}
			</Animated.View>
			<Animated.Text
				numberOfLines={1}
				ellipsizeMode="tail"
				style={[
					{
						color: tintColor,
						marginTop: 2,
						fontSize: 10,
						lineHeight: 12,
						fontWeight: "600",
						textAlign: "center",
					},
					labelStyle,
					animatedTextStyle,
				]}
			>
				{label}
			</Animated.Text>
		</Pressable>
	);
}

const TabBarButton = React.memo(TabBarButtonImpl);
export default TabBarButton;
