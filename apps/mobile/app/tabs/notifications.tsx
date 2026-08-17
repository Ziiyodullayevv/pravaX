import React from "react";
import { ScrollView } from "react-native";
import { ChevronLeft, Bell } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";
import { useI18n } from "@/locales/i18n-provider";

export default function NotificationsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colorMode } = useAppTheme();
	const { t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#a1a1aa" : "#6b7280";
	const iconColor = isDark ? "#52525b" : "#d4d4d8";

	return (
		<Box className="flex-1 bg-background">
			<Box
				style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
				className="px-4 flex-row items-center gap-3 border-b border-border"
			>
				<Box>
					<YandexRippleButton onPress={() => router.back()} borderRadius={9999}>
						<GradientIconFrame size={48} borderRadius={999} innerBorderRadius={999}>
							<ChevronLeft size={24} color={palette.text} />
						</GradientIconFrame>
					</YandexRippleButton>
				</Box>
				<Heading className="text-xl font-semibold" style={{ color: text }}>
					{t("notifications.title", "Bildirishnomalar")}
				</Heading>
			</Box>

			<ScrollView
				contentContainerStyle={{ flexGrow: 1 }}
				showsVerticalScrollIndicator={false}
				overScrollMode="never"
				decelerationRate="normal"
			>
				<Box className="flex-1 items-center justify-center px-8 py-24">
					<Bell size={64} color={iconColor} strokeWidth={1.3} />
					<Heading
						className="mt-6 text-center text-xl font-semibold"
						style={{ color: text }}
					>
						{t("notifications.empty.title", "Bildirishnomalar yo'q")}
					</Heading>
					<Text
						className="mt-3 text-center text-base leading-6"
						style={{ color: muted }}
					>
						{t(
							"notifications.empty.description",
							"Yangi bildirishnomalar kelganda bu yerda ko'rinadi.",
						)}
					</Text>
				</Box>
			</ScrollView>
		</Box>
	);
}
