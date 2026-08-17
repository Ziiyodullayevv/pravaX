import React from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Bell } from "lucide-react-native";

import {
	Avatar,
	AvatarFallbackText,
	AvatarImage,
} from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

import type { HomePalette } from "./types";

type HomeHeaderProps = {
	avatarFallback: string;
	displayName: string;
	subtitle: string;
	avatarUri: string;
	palette: HomePalette;
	tokenBalance?: number | null;
	isTokenBalanceLoading?: boolean;
	onNotificationPress?: () => void;
};

let lastRenderedTokenBalance: number | null = null;

function HomeHeaderImpl({
	avatarFallback,
	displayName,
	subtitle,
	avatarUri,
	palette,
	tokenBalance,
	isTokenBalanceLoading = false,
	onNotificationPress,
}: HomeHeaderProps) {
	const nextBalance = tokenBalance ?? 0;
	const [displayedBalance, setDisplayedBalance] = React.useState(nextBalance);
	const [balanceDelta, setBalanceDelta] = React.useState(0);
	const previousBalanceRef = React.useRef(nextBalance);
	const didMountRef = React.useRef(false);

	const countAnim = React.useRef(new Animated.Value(nextBalance)).current;
	const pulseAnim = React.useRef(new Animated.Value(1)).current;
	const badgeOpacity = React.useRef(new Animated.Value(0)).current;
	const badgeScale = React.useRef(new Animated.Value(0.4)).current;
	const badgeTY = React.useRef(new Animated.Value(0)).current;

	const balanceLabel = String(displayedBalance);

	React.useEffect(() => {
		if (isTokenBalanceLoading) return;

		const previousBalance = didMountRef.current
			? previousBalanceRef.current
			: (lastRenderedTokenBalance ?? nextBalance);

		if (!didMountRef.current) {
			didMountRef.current = true;
			if (previousBalance === nextBalance) {
				previousBalanceRef.current = nextBalance;
				lastRenderedTokenBalance = nextBalance;
				setDisplayedBalance(nextBalance);
				countAnim.setValue(nextBalance);
				return;
			}
		}

		if (previousBalance === nextBalance) return;

		const delta = nextBalance - previousBalance;
		const countDuration = Math.min(2400, Math.max(900, Math.abs(delta) * 95));

		previousBalanceRef.current = nextBalance;
		lastRenderedTokenBalance = nextBalance;
		setBalanceDelta(delta);

		countAnim.stopAnimation();
		pulseAnim.stopAnimation();
		badgeOpacity.stopAnimation();
		badgeScale.stopAnimation();
		badgeTY.stopAnimation();
		countAnim.removeAllListeners();

		countAnim.setValue(previousBalance);
		badgeOpacity.setValue(0);
		badgeScale.setValue(0.4);
		badgeTY.setValue(0);

		countAnim.addListener(({ value }) => {
			setDisplayedBalance(Math.round(value));
		});

		Animated.parallel([
			Animated.timing(countAnim, {
				toValue: nextBalance,
				duration: countDuration,
				easing: Easing.linear,
				useNativeDriver: false,
			}),
			Animated.sequence([
				Animated.timing(pulseAnim, {
					toValue: 1.14,
					duration: 150,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.spring(pulseAnim, {
					toValue: 1,
					friction: 5,
					tension: 120,
					useNativeDriver: true,
				}),
			]),
			Animated.sequence([
				Animated.parallel([
					Animated.spring(badgeScale, {
						toValue: 1,
						friction: 5,
						tension: 220,
						useNativeDriver: true,
					}),
					Animated.timing(badgeOpacity, {
						toValue: 1,
						duration: 180,
						easing: Easing.out(Easing.quad),
						useNativeDriver: true,
					}),
				]),
				Animated.delay(1800),
				Animated.parallel([
					Animated.timing(badgeOpacity, {
						toValue: 0,
						duration: 520,
						easing: Easing.in(Easing.quad),
						useNativeDriver: true,
					}),
					Animated.timing(badgeTY, {
						toValue: -36,
						duration: 520,
						easing: Easing.in(Easing.quad),
						useNativeDriver: true,
					}),
					Animated.timing(badgeScale, {
						toValue: 0.75,
						duration: 520,
						easing: Easing.in(Easing.quad),
						useNativeDriver: true,
					}),
				]),
			]),
		]).start(() => {
			countAnim.removeAllListeners();
			setDisplayedBalance(nextBalance);
			lastRenderedTokenBalance = nextBalance;
			setBalanceDelta(0);
		});
	}, [
		badgeOpacity,
		badgeScale,
		badgeTY,
		countAnim,
		isTokenBalanceLoading,
		nextBalance,
		pulseAnim,
	]);

	React.useEffect(() => {
		return () => {
			countAnim.removeAllListeners();
		};
	}, [countAnim]);

	const isPositive = balanceDelta > 0;
	const deltaColor = isPositive ? "#16a34a" : "#ef4444";
	const deltaBgColor = isPositive
		? "rgba(22,163,74,0.13)"
		: "rgba(239,68,68,0.13)";
	const deltaBorderColor = isPositive
		? "rgba(22,163,74,0.38)"
		: "rgba(239,68,68,0.38)";

	return (
		<Box className="mx-4 android:mt-3 flex-row items-center justify-between">
			<Box className="flex-1 flex-row items-center gap-3">
				<Avatar className="h-12 w-12">
					<AvatarFallbackText>{avatarFallback}</AvatarFallbackText>
					{avatarUri ? <AvatarImage source={{ uri: avatarUri }} /> : null}
				</Avatar>

				<Box className="flex-1 min-w-0">
					<Text
						numberOfLines={1}
						ellipsizeMode="tail"
						className="text-sm"
						style={{ color: palette.tabIconDefault }}
					>
						{`${subtitle},`}
					</Text>
					<Heading
						numberOfLines={1}
						ellipsizeMode="tail"
						className="text-xl font-semibold"
					>
						{displayName}
					</Heading>
				</Box>
			</Box>

			<Box className="flex-row items-center gap-0.5">
				<View style={styles.pillWrapper}>
					{balanceDelta !== 0 ? (
						<Animated.View
							pointerEvents="none"
							style={[
								styles.badgeContainer,
								{
									opacity: badgeOpacity,
									transform: [{ scale: badgeScale }, { translateY: badgeTY }],
								},
							]}
						>
							<View
								style={[
									styles.badge,
									{
										backgroundColor: deltaBgColor,
										borderColor: deltaBorderColor,
									},
								]}
							>
								<Text style={[styles.badgeText, { color: deltaColor }]}>
									{isPositive ? `+${balanceDelta}` : String(balanceDelta)}
								</Text>
								<Image
									source={require("../../assets/images/coin.webp")}
									style={styles.badgeCoin}
									resizeMode="contain"
								/>
							</View>
						</Animated.View>
					) : null}

					<Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
						<LinearGradient
							colors={["#ff405f", "#c43be8", "#4a55ff"]}
							start={{ x: 0, y: 0.5 }}
							end={{ x: 1, y: 0.5 }}
							style={styles.pill}
						>
							{isTokenBalanceLoading ? (
								<Skeleton
									variant="sharp"
									startColor="bg-white/60"
									className="h-4 w-7 rounded-full"
								/>
							) : (
								<Text className="text-sm font-semibold text-white">
									{balanceLabel}
								</Text>
							)}
							<Image
								source={require("../../assets/images/coin.webp")}
								style={styles.pillCoin}
								resizeMode="contain"
							/>
						</LinearGradient>
					</Animated.View>
				</View>

				<Pressable
					onPress={onNotificationPress}
					style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
				>
					<Box className="h-12 w-12 rounded-full items-center justify-center">
						<Bell size={29} color={palette.text} strokeWidth={2} />
						<View
							style={[styles.bellDot, { backgroundColor: palette.tint }]}
						/>
					</Box>
				</Pressable>
			</Box>
		</Box>
	);
}

const styles = StyleSheet.create({
	pillWrapper: {
		position: "relative",
	},
	badgeContainer: {
		position: "absolute",
		right: 0,
		top: -48,
		zIndex: 50,
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 11,
		paddingVertical: 7,
		borderRadius: 100,
		borderWidth: 1.5,
	},
	badgeText: {
		fontSize: 17,
		fontWeight: "800",
		letterSpacing: -0.3,
	},
	badgeCoin: {
		width: 18,
		height: 18,
	},
	pill: {
		height: 30,
		minWidth: 48,
		borderRadius: 999,
		paddingLeft: 9,
		paddingRight: 4,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	pillCoin: {
		width: 21,
		height: 21,
		marginLeft: 4,
	},
	bellDot: {
		position: "absolute",
		right: 14,
		top: 14,
		height: 8,
		width: 8,
		borderRadius: 999,
	},
});

const HomeHeader = React.memo(HomeHeaderImpl);
export default HomeHeader;
