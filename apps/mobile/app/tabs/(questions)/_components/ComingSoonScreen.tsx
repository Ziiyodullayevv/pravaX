import React from "react";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/constants/Colors";
import { useAppTheme } from "@/contexts/theme-context";

type ComingSoonScreenProps = {
	title: string;
	description: string;
};

export function ComingSoonScreen({ title, description }: ComingSoonScreenProps) {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const palette = colorMode === "dark" ? Colors.dark : Colors.light;

	return (
		<Box className="flex-1 pt-safe bg-background">
			<Box className="px-4 my-2 flex-row items-center justify-between">
				<YandexRippleButton
					onPress={() => router.replace("/tabs/(tabs)/home")}
					borderRadius={9999}
				>
					<Box className="h-12 w-12 rounded-full items-center justify-center bg-card">
						<ChevronLeft size={24} color={palette.text} />
					</Box>
				</YandexRippleButton>

				<Heading className="text-lg font-semibold">{title}</Heading>

				<Box className="h-12 w-12" />
			</Box>

			<Box className="flex-1 px-5 justify-center">
				<Box className="rounded-3xl bg-card px-5 py-6">
					<Heading className="text-xl font-semibold">{title}</Heading>
					<Text className="mt-2 text-base leading-6 text-muted-foreground">
						{description}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

export default ComingSoonScreen;
