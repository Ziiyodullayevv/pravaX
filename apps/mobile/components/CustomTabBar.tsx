import {
	Platform,
	View,
	StyleSheet,
	LayoutChangeEvent,
	type ViewStyle,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import TabBarButton from "@/components/TabBarButton";
import React, { useEffect, useState } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import { useI18n } from "@/locales/i18n-provider";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function colorWithAlpha(color: string, alpha: number) {
	const normalized = color.trim();
	if (normalized.startsWith("rgb(")) {
		const values = normalized
			.replace("rgb(", "")
			.replace(")", "")
			.split(",")
			.map((item) => item.trim())
			.slice(0, 3);
		if (values.length === 3) {
			return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
		}
	}

	if (normalized.startsWith("#")) {
		const hex = normalized.slice(1);
		const fullHex =
			hex.length === 3
				? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
				: hex;
		if (fullHex.length === 6) {
			const r = Number.parseInt(fullHex.slice(0, 2), 16);
			const g = Number.parseInt(fullHex.slice(2, 4), 16);
			const b = Number.parseInt(fullHex.slice(4, 6), 16);
			return `rgba(${r}, ${g}, ${b}, ${alpha})`;
		}
	}

	return color;
}

const TAB_LABEL_KEYS: Record<string, [string, string]> = {
	home: ["tabs.home", "Asosiy"],
	contest: ["tabs.contest", "Musobaqa"],
	search: ["tabs.search", "Qidiruv"],
	settings: ["tabs.settings", "Sozlamalar"],
};

export function CustomTabBar({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const insets = useSafeAreaInsets();
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const [dimensions, setDimensions] = useState({ height: 20, width: 100 });
	const tabbarHeight = 56;
	const indicatorInset = 4;
	const indicatorHeight = Math.min(48, Math.max(0, dimensions.height - 8));

	const buttonWidth = dimensions.width / state.routes.length;
	const indicatorWidth = Math.max(0, buttonWidth - indicatorInset * 2);
	const defaultTabbarBottom = 20;
	const androidBottomInset = Platform.OS === "android" ? insets.bottom : 0;
	const tabbarBottom =
		Platform.OS === "android" && androidBottomInset >= 16
			? androidBottomInset + 10
			: defaultTabbarBottom;
	const tabbarHorizontalInset = 36;
	const tabbarRadius = 100;
	const bottomGradientHeight = Math.max(
		110,
		dimensions.height + tabbarBottom + 36,
	);
	const tabbarShadowStyle: ViewStyle = {
		backgroundColor: palette.tabsBackground,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowRadius: 16,
		shadowOpacity: isDark ? 0.28 : 0.14,
		boxShadow: isDark
			? "0px 0px 5px rgba(0, 0, 0, 0.28)"
			: "0px 0px 5px rgba(17, 24, 39, 0.14)",
		elevation: 0,
	};

	const onTabbarLayout = (e: LayoutChangeEvent) => {
		setDimensions({
			height: e.nativeEvent.layout.height,
			width: e.nativeEvent.layout.width,
		});
	};

	const tabPositionX = useSharedValue(0);

	useEffect(() => {
		tabPositionX.value = withTiming(
			buttonWidth * state.index + indicatorInset,
			{
				duration: 240,
				easing: Easing.out(Easing.cubic),
			},
		);
	}, [buttonWidth, indicatorInset, state.index, tabPositionX]);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ translateX: tabPositionX.value }],
		};
	});

	return (
		<>
			<LinearGradient
				pointerEvents="none"
				colors={
					isDark
						? ["rgba(0,0,0,0)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.78)"]
						: [
								"rgba(255,255,255,0)",
								"rgba(255,255,255,0.5)",
								"rgb(255, 255, 255)",
							]
				}
				start={{ x: 0.5, y: 0.16 }}
				end={{ x: 0.5, y: 1 }}
				style={[
					styles.bottomGradient,
					{
						height: bottomGradientHeight,
					},
				]}
			/>
			<View
				style={[
					styles.tabbarShadow,
					tabbarShadowStyle,
					{
						bottom: tabbarBottom,
						left: tabbarHorizontalInset,
						right: tabbarHorizontalInset,
						borderRadius: tabbarRadius,
					},
				]}
			>
				<View
					onLayout={onTabbarLayout}
					style={[
						styles.tabbar,
						{
							height: tabbarHeight,
							borderRadius: tabbarRadius,
							backgroundColor: palette.tabsBackground,
						},
					]}
				>
					<BlurView
						pointerEvents="none"
						tint={isDark ? "dark" : "light"}
						intensity={80}
						style={[styles.blurOverlay, { borderRadius: tabbarRadius }]}
					/>
					<Animated.View
						style={[
							animatedStyle,
							{
								position: "absolute",
								backgroundColor: colorWithAlpha(palette.tabIconSelected, 0.1),
								borderRadius: 30,
								left: 0,
								top: (dimensions.height - indicatorHeight) / 2,
								height: indicatorHeight,
								width: indicatorWidth,
							},
						]}
					/>
					{state.routes.map((route, index) => {
						const { options } = descriptors[route.key];
						const keys = TAB_LABEL_KEYS[route.name];
						const label = keys
							? t(keys[0], keys[1])
							: typeof options.tabBarLabel === "string"
								? options.tabBarLabel
								: typeof options.title === "string"
									? options.title
									: route.name;

						const isFocused = state.index === index;
						const tintColor = isFocused
							? palette.tabIconSelected
							: palette.tabIconDefault;
						const icon = options.tabBarIcon?.({
							focused: isFocused,
							color: tintColor,
							size: 20,
						});

						const onPress = () => {
							const event = navigation.emit({
								type: "tabPress",
								target: route.key,
								canPreventDefault: true,
							});

							if (!isFocused && !event.defaultPrevented) {
								navigation.navigate(route.name, route.params);
							}
						};

						const onLongPress = () => {
							navigation.emit({
								type: "tabLongPress",
								target: route.key,
							});
						};

						return (
							<TabBarButton
								key={route.key}
								onPress={onPress}
								onLongPress={onLongPress}
								style={styles.tabBarItem}
								activeTranslateY={0}
								isFocused={isFocused}
								accessibilityLabel={options.tabBarAccessibilityLabel}
								testID={options.tabBarButtonTestID}
								tintColor={tintColor}
								icon={icon}
								label={label}
							/>
						);
					})}
				</View>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	bottomGradient: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
	},
	tabbarShadow: {
		position: "absolute",
	},
	tabbar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		overflow: "hidden",
		paddingVertical: 1,
	},
	blurOverlay: {
		...StyleSheet.absoluteFillObject,
	},
	tabBarItem: {
		flex: 1,
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
});
