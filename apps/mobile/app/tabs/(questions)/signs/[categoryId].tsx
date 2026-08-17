import React, { useMemo } from "react";
import {
	ActivityIndicator,
	Dimensions,
	FlatList,
	Image,
	Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Signpost } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { YandexRippleButton } from "@/components/YandexRippleButton";

import {
	BottomSheet,
	BottomSheetBackdrop,
	type BottomSheetController,
	BottomSheetContent,
	BottomSheetDragIndicator,
	BottomSheetPortal,
	BottomSheetScrollView,
} from "@/components/ui/bottomsheet";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/Colors";
import {
	getLocalizedSignText,
	resolveSignImageUrl,
	useSectionSignsQuery,
	useSignDetailQuery,
	type SignListItem,
} from "@/features/signs/api";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 12;
const GAP = 10;
const NUM_COLUMNS = 3;
const ITEM_WIDTH =
	(SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) /
	NUM_COLUMNS;
const ITEM_HEIGHT = ITEM_WIDTH + 24;

function SignCard({ item, onPress }: { item: SignListItem; onPress: () => void }) {
	return (
		<YandexRippleButton onPress={onPress} borderRadius={16}>
			<Box
				className="bg-card rounded-2xl items-center py-3 px-2"
				style={{ width: ITEM_WIDTH, height: ITEM_HEIGHT }}
			>
				<Image
					source={{ uri: resolveSignImageUrl(item.image) }}
					style={{ width: ITEM_WIDTH - 24, height: ITEM_WIDTH - 24 }}
					resizeMode="contain"
				/>
				<Text className="mt-2 text-xs font-semibold text-center text-foreground">
					{item.number}
				</Text>
			</Box>
		</YandexRippleButton>
	);
}

function SignSkeleton() {
	return (
		<Skeleton
			variant="sharp"
			className="rounded-2xl"
			style={{ width: ITEM_WIDTH, height: ITEM_HEIGHT }}
		/>
	);
}

export default function SignCategoryDetailScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { categoryId, title: routeTitle } = useLocalSearchParams<{
		categoryId: string;
		title?: string;
	}>();
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const sheetRef = React.useRef<BottomSheetController | null>(null);
	const [selectedSignId, setSelectedSignId] = React.useState<string | null>(null);
	const mountReady = useDeferredMount();
	const signsQuery = useSectionSignsQuery(categoryId, mountReady);
	const signDetailQuery = useSignDetailQuery(selectedSignId, mountReady && Boolean(selectedSignId));
	const signs = signsQuery.data ?? [];
	const isLoading = signsQuery.isLoading && signs.length === 0;
	const isError = signsQuery.isError && signs.length === 0;
	const selectedSign = signDetailQuery.data;
	const isSignDetailLoading = signDetailQuery.isLoading && !selectedSign;
	const selectedSignName = getLocalizedSignText(selectedSign?.name, language, "");
	const selectedSignDescription = getLocalizedSignText(
		selectedSign?.description,
		language,
		"",
	);
	const selectedSignExtra = getLocalizedSignText(selectedSign?.extra, language, "");
	const signCountSuffix = t("signs.countSuffix", "ta belgi");
	const errorTitle = t("signs.errorTitle", "Xatolik");

	const title = useMemo(() => {
		if (typeof routeTitle === "string" && routeTitle.trim().length > 0) {
			return routeTitle;
		}
		return t("signs.title", "Yo'l belgilari");
	}, [routeTitle, t]);
	const listData = isLoading
		? Array.from({ length: 10 }, (_, index) => ({
				id: -index - 1,
				image: "",
				name: "",
				number: "",
				order: index,
			}))
		: signs;
	const openSignSheet = (signId: number | string) => {
		setSelectedSignId(String(signId));
		requestAnimationFrame(() => {
			sheetRef.current?.open();
		});
	};

	return (
		<BottomSheet ref={sheetRef} snapToIndex={0}>
			<Box className="flex-1 pt-safe bg-background">
				<Box className="px-4 my-2 flex-row items-center justify-between">
					<Box>
						<YandexRippleButton onPress={() => router.back()} borderRadius={9999}>
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
						<Heading
							className="text-lg font-semibold text-center"
							style={{ color: text }}
							numberOfLines={1}
						>
							{title}
						</Heading>
						<Text
							className="text-sm text-center text-muted-foreground"
							style={{ lineHeight: 18, marginTop: 1 }}
						>
							{isLoading
								? "..."
								: isError
									? errorTitle
									: `${signs.length} ${signCountSuffix}`}
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

				<FlatList
					showsVerticalScrollIndicator={false}
					data={listData}
					numColumns={NUM_COLUMNS}
					keyExtractor={(item) => String(item.id)}
					renderItem={({ item }) =>
						isLoading ? (
							<SignSkeleton />
						) : (
							<SignCard
								item={item}
								onPress={() => openSignSheet(item.id)}
							/>
						)
					}
					columnWrapperStyle={{
						gap: GAP,
						paddingHorizontal: HORIZONTAL_PADDING,
					}}
					ItemSeparatorComponent={() => <Box style={{ height: GAP }} />}
					ListEmptyComponent={
						isError ? (
							<Box className="mx-4 mt-8 rounded-3xl bg-card px-5 py-6 items-center">
								<Text className="text-sm text-center text-muted-foreground">
									Belgilarni olishda xato yuz berdi.
								</Text>
								<Pressable className="mt-3" onPress={() => signsQuery.refetch()}>
									<Text className="text-sm font-semibold text-primary">
										Qayta urinish
									</Text>
								</Pressable>
							</Box>
						) : null
					}
					contentContainerStyle={{
						paddingTop: 12,
						paddingBottom: 24,
					}}
				/>

				<BottomSheetPortal
					backgroundStyle={{
						borderTopLeftRadius: 30,
						borderTopRightRadius: 30,
						opacity: 0,
					}}
					snapPoints={["58%", "88%"]}
					enableDynamicSizing={false}
					enableHandlePanningGesture
					enableContentPanningGesture
					enableOverDrag={false}
					topInset={insets.top}
					backdropComponent={(props) => (
						<BottomSheetBackdrop
							{...props}
							appearsOnIndex={0}
							disappearsOnIndex={-1}
						/>
					)}
					handleComponent={(props) => (
						<BottomSheetDragIndicator
							{...props}
							className="rounded-t-[30px] bg-card border-b border-border"
						>
							<Text className="text-lg mt-4 font-semibold">
								{selectedSign?.number ?? "Belgi"}
							</Text>
						</BottomSheetDragIndicator>
					)}
				>
					<BottomSheetContent className="px-5 pb-0 bg-card h-full">
						<BottomSheetScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{
								paddingBottom: Math.max(insets.bottom, 20),
							}}
						>
							<Box className="items-center py-4">
								{isSignDetailLoading ? (
									<Box className="h-36 w-full items-center justify-center">
										<ActivityIndicator color="#ff9f2f" />
									</Box>
								) : selectedSign?.image ? (
									<Image
										source={{ uri: resolveSignImageUrl(selectedSign.image) }}
										style={{ height: 150, width: 150 }}
										resizeMode="contain"
									/>
								) : null}

								{isSignDetailLoading ? (
									null
								) : selectedSign ? (
									<Box className="w-full">
										<Heading className="mt-5 text-xl font-semibold text-center">
											{selectedSign.number}. {selectedSignName}
										</Heading>
										{selectedSignDescription ? (
											<Text className="mt-4 text-base leading-6 text-center text-muted-foreground">
												{selectedSignDescription}
											</Text>
										) : null}
										{selectedSignExtra ? (
											<Box className="mt-4 rounded-2xl bg-background px-4 py-3">
												<Text className="text-sm leading-5 text-center text-muted-foreground">
													{selectedSignExtra}
												</Text>
											</Box>
										) : null}
									</Box>
								) : (
									<Box className="items-center py-6">
										<Text className="text-sm text-muted-foreground">
											Belgi topilmadi.
										</Text>
										<Pressable className="mt-3" onPress={() => signDetailQuery.refetch()}>
											<Text className="text-sm font-semibold text-primary">
												Qayta urinish
											</Text>
										</Pressable>
									</Box>
								)}
							</Box>
						</BottomSheetScrollView>
					</BottomSheetContent>
				</BottomSheetPortal>
			</Box>
		</BottomSheet>
	);
}
