import React from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { WifiOff } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { useI18n } from "@/locales/i18n-provider";

type Props = {
	onRetry: () => void;
	isRetrying?: boolean;
};

export function NetworkErrorState({ onRetry, isRetrying = false }: Props) {
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";

	const textColor = isDark ? "#f5f5f5" : "#111827";
	const mutedColor = isDark ? "#a1a1aa" : "#6b7280";
	const iconColor = isDark ? "#64748b" : "#94a3b8";

	const title = t("offline.title", (() => {
		if (language.startsWith("ru")) return "Нет подключения к интернету";
		if (language.includes("Cyrl")) return "Интернет алоқаси йўқ";
		return "Internet aloqasi yo'q";
	})());

	const description = t("offline.description", (() => {
		if (language.startsWith("ru")) return "Проверьте соединение и обновите страницу.";
		if (language.includes("Cyrl")) return "Уланишни текширинг ва саҳифани янгиланг.";
		return "Ulanishni tekshiring va sahifani yangilang.";
	})());

	const buttonLabel = t("offline.button", (() => {
		if (language.startsWith("ru")) return "Обновить";
		if (language.includes("Cyrl")) return "Янгилаш";
		return "Yangilash";
	})());

	return (
		<Box className="flex-1 items-center justify-center px-8 py-20">
			<WifiOff size={72} color={iconColor} strokeWidth={1.4} />

			<Heading
				className="mt-7 text-center text-2xl font-semibold"
				style={{ color: textColor }}
			>
				{title}
			</Heading>
			<Text
				className="mt-3 text-center text-base leading-6"
				style={{ color: mutedColor }}
			>
				{description}
			</Text>

			<Pressable
				className="mt-7"
				disabled={isRetrying}
				onPress={onRetry}
			>
				<Box
					className="min-h-11 rounded-full border px-8 items-center justify-center"
					style={{
						borderColor: "#0ea5e9",
						opacity: isRetrying ? 0.6 : 1,
					}}
				>
					{isRetrying ? (
						<ActivityIndicator color="#0284c7" />
					) : (
						<Text
							className="text-base font-semibold"
							style={{ color: "#0284c7" }}
						>
							{buttonLabel}
						</Text>
					)}
				</Box>
			</Pressable>
		</Box>
	);
}
