import React, { useCallback, useMemo } from "react";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Signpost } from "lucide-react-native";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { NetworkErrorState } from "@/components/NetworkErrorState";
import { YandexRippleButton } from "@/components/YandexRippleButton";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/Colors";
import {
	getLocalizedSignText,
	useSignSectionsQuery,
	type SignSection,
} from "@/features/signs/api";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

const CategoryCard = React.memo(function CategoryCard({
	section,
	language,
	sectionLabel,
	signCountSuffix,
	textColor,
	mutedColor,
	onPress,
}: {
	section: SignSection;
	language: string;
	sectionLabel: string;
	signCountSuffix: string;
	textColor: string;
	mutedColor: string;
	onPress: (section: SignSection) => void;
}) {
	const title = getLocalizedSignText(section.name, language, `Bo'lim ${section.id}`);
	const handlePress = useCallback(() => onPress(section), [onPress, section]);

	return (
		<YandexRippleButton onPress={handlePress} borderRadius={24}>
			<Box className="rounded-3xl bg-card px-4 py-4">
				<Box className="flex-row items-start gap-2">
					<GradientIconFrame>
						<Signpost size={22} color={textColor} strokeWidth={1.9} />
					</GradientIconFrame>

					<Box className="ml-4 flex-1">
						<Heading
							className="text-sm font-semibold"
							numberOfLines={2}
							ellipsizeMode="tail"
							style={{ color: textColor }}
						>
							{title}
						</Heading>
						<Text className="mt-1 text-sm text-foreground/70" numberOfLines={1}>
							{sectionLabel}
						</Text>

						<Box className="mt-3 flex-row items-center gap-2 self-start">
							<Signpost size={18} color={mutedColor} strokeWidth={1.9} />
							<Text className="text-sm" style={{ color: mutedColor }}>
								{section.signs_count} {signCountSuffix}
							</Text>
						</Box>
					</Box>

					<Box className="-mr-1 mt-1">
						<ChevronRight size={22} color={mutedColor} />
					</Box>
				</Box>
			</Box>
		</YandexRippleButton>
	);
});

const CategorySkeleton = React.memo(function CategorySkeleton() {
	return (
		<Box className="rounded-3xl bg-card px-4 py-4">
			<Box className="flex-row items-start gap-2">
				<Skeleton variant="sharp" className="h-10 w-10 rounded-xl" />
				<Box className="ml-4 flex-1">
					<SkeletonText _lines={2} className="h-3" />
					<Skeleton variant="sharp" className="mt-2 h-3 w-20 rounded-full" />
					<Box className="mt-3 flex-row items-center gap-2">
						<Skeleton variant="circular" className="h-[18px] w-[18px]" />
						<Skeleton variant="sharp" className="h-3 w-20 rounded-full" />
					</Box>
				</Box>
				<Box className="-mr-1 mt-1">
					<Skeleton variant="sharp" className="h-6 w-4 rounded-full" />
				</Box>
			</Box>
		</Box>
	);
});

const SIGN_LIST_CONTENT_STYLE = {
	paddingHorizontal: 12,
	paddingTop: 16,
	paddingBottom: 24,
} as const;
const SIGN_SEPARATOR = () => <Box className="h-3" />;

export default function SignsScreen() {
	const router = useRouter();
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";
	const mountReady = useDeferredMount();
	const sectionsQuery = useSignSectionsQuery(mountReady);
	const sections = sectionsQuery.data ?? [];
	const isLoading = (!mountReady || sectionsQuery.isLoading) && sections.length === 0;

	const totalSigns = useMemo(
		() => sections.reduce((sum, section) => sum + section.signs_count, 0),
		[sections],
	);
	const listData = isLoading ? [] : sections;
	const sectionLabel = t("signs.title", "Yo'l belgilari");
	const groupWord = t("signs.groupWord", "guruh");
	const signWord = t("signs.signWord", "belgi");
	const signCountSuffix = t("signs.countSuffix", "ta belgi");

	const handleCategoryPress = useCallback(
		(section: SignSection) => {
			router.push({
				pathname: "/tabs/(questions)/signs/[categoryId]",
				params: {
					categoryId: String(section.id),
					title: getLocalizedSignText(
						section.name,
						language,
						`Bo'lim ${section.id}`,
					),
				},
			});
		},
		[router, language],
	);

	const renderItem = useCallback(
		({ item }: { item: SignSection }) => (
			<CategoryCard
				language={language}
				section={item}
				sectionLabel={sectionLabel}
				signCountSuffix={signCountSuffix}
				textColor={text}
				mutedColor={muted}
				onPress={handleCategoryPress}
			/>
		),
		[language, sectionLabel, signCountSuffix, text, muted, handleCategoryPress],
	);

	const keyExtractor = useCallback(
		(item: SignSection) => String(item.id),
		[],
	);

	const skeletonKeys = useMemo(
		() => Array.from({ length: 10 }, (_, i) => `s${i + 1}`),
		[],
	);

	const listEmptyComponent = useMemo(
		() =>
			isLoading ? (
				<Box className="gap-3">
					{skeletonKeys.map((key) => (
						<CategorySkeleton key={key} />
					))}
				</Box>
			) : null,
		[isLoading, skeletonKeys],
	);

	const handleRetry = useCallback(() => sectionsQuery.refetch(), [sectionsQuery]);
	const handleBackPress = useCallback(
		() => router.replace("/tabs/(tabs)/home"),
		[router],
	);

	return (
		<Box className="flex-1 pt-safe bg-background">
			<Box className="px-4 my-2 flex-row items-center justify-between">
				<Box>
					<YandexRippleButton
						onPress={handleBackPress}
						borderRadius={9999}
					>
						<GradientIconFrame
							size={48}
							borderRadius={999}
							innerBorderRadius={999}
						>
							<ChevronLeft size={24} color={palette.text} />
						</GradientIconFrame>
					</YandexRippleButton>
				</Box>

				<Box className="h-12 flex-1 items-center justify-center px-3">
					<Heading className="text-lg font-semibold" style={{ color: text }}>
						{t("signs.title", "Yo'l belgilari")}
					</Heading>
					<Text
						className="text-sm"
						style={{ color: muted, lineHeight: 18, marginTop: 1 }}
					>
						{isLoading
							? "..."
							: `${sections.length} ${groupWord} · ${totalSigns} ${signWord}`}
					</Text>
				</Box>

				<GradientIconFrame
					size={48}
					borderRadius={999}
					innerBorderRadius={999}
				>
					<Signpost size={24} color={palette.text} strokeWidth={1.9} />
				</GradientIconFrame>
			</Box>

			{sectionsQuery.isError && sections.length === 0 ? (
					<NetworkErrorState onRetry={handleRetry} />
				) : (
					<FlashList
						showsVerticalScrollIndicator={false}
					overScrollMode="never"
					decelerationRate="normal"
						data={listData}
						keyExtractor={keyExtractor}
						renderItem={renderItem}
						ItemSeparatorComponent={SIGN_SEPARATOR}
						ListEmptyComponent={listEmptyComponent}
						contentContainerStyle={SIGN_LIST_CONTENT_STYLE}
					/>
				)}
		</Box>
	);
}
