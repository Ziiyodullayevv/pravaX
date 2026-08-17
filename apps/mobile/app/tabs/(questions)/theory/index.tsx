import React, { useCallback, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { NetworkErrorState } from "@/components/NetworkErrorState";
import { YandexRippleButton } from "@/components/YandexRippleButton";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { GradientIconFrame } from "@/components/GradientIconFrame";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { Colors } from "@/constants/Colors";
import {
	ProgressRing,
	StatsCardsRow,
	TopicCard,
} from "@/features/theory/components";
import { TOPIC_PASS_PERCENT } from "@/features/theory/constants";
import { useTheoryOverview } from "@/features/theory/hooks";
import { getTopicIcon } from "@/features/theory/ui-mappers";
import { useI18n } from "@/locales/i18n-provider";
import { useDeferredMount } from "@/hooks/useDeferredMount";

function formatCount(value: number) {
	return value.toLocaleString("en-US");
}

const TopicCardSkeleton = React.memo(function TopicCardSkeleton() {
	return (
		<Box className="gap-4 p-4 rounded-3xl bg-card">
			<Skeleton variant="sharp" className="h-[84px] rounded-xl" />
			<SkeletonText _lines={2} className="h-3" />
			<HStack className="gap-2 items-center">
				<Skeleton variant="circular" className="h-5 w-5" />
				<SkeletonText _lines={1} gap={1} className="h-3 w-2/5" />
			</HStack>
		</Box>
	);
});

const THEORY_LIST_CONTENT_STYLE = { paddingHorizontal: 12, paddingBottom: 24 } as const;
const THEORY_SEPARATOR = () => <Box className="h-3" />;

function buildProgressLabel(
	topic: {
		answeredQuestions: number;
		scorePercent: number;
		totalQuestions: number;
	},
	t: (key: string, fallback?: string) => string,
) {
	if (topic.totalQuestions === 0) {
		return t("theory.sectionSubtitle", "Theory section");
	}
	if (topic.answeredQuestions === 0) {
		return `${topic.totalQuestions} ${t("common.questionsWord", "savol")}`;
	}
	return `${t("theory.score", "Ball")}: ${topic.scorePercent}%`;
}

export default function TheoryScreen() {
	const router = useRouter();
	const { user, isLoading: authLoading } = useAuth();
	const { colorMode } = useAppTheme();
	const { language, t } = useI18n();
	const isDark = colorMode === "dark";
	const palette = isDark ? Colors.dark : Colors.light;
	const text = isDark ? "#ECEDEE" : "#111111";
	const muted = isDark ? "#b0b0b0" : "#4b4b4b";

	const mountReady = useDeferredMount();
	const { summary, topics, isLoading, error, reload } = useTheoryOverview(
		user?.id,
		language,
		mountReady,
	);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await reload();
		} finally {
			setIsRefreshing(false);
		}
	}, [reload]);
	const topicItems = useMemo(() => {
		return topics.map((topic) => {
			const scorePercent =
				topic.answeredQuestions > 0
					? Math.round((topic.correctCount / topic.answeredQuestions) * 100)
					: 0;
			const passed = topic.answeredQuestions > 0 && scorePercent >= TOPIC_PASS_PERCENT;

			return {
				...topic,
				isLocked: false,
				passed,
				scorePercent,
			};
		});
	}, [topics]);
	const showSkeleton = (authLoading || isLoading) && topics.length === 0;
	const skeletonItems = useMemo(() => ["skeleton-1", "skeleton-2", "skeleton-3"], []);
	type TopicListItem =
		| { type: "skeleton"; id: string }
		| { type: "topic"; topic: (typeof topicItems)[number] };
	const listData = useMemo<TopicListItem[]>(() => {
		if (showSkeleton) {
			return skeletonItems.map((id) => ({ type: "skeleton", id }));
		}
		return topicItems.map((topic) => ({ type: "topic", topic }));
	}, [showSkeleton, skeletonItems, topicItems]);

	const handleTopicPress = useCallback(
		(slug: string) => {
			router.push({
				pathname: "/tabs/(questions)/theory/[slug]",
				params: { slug },
			});
		},
		[router],
	);

	const handleBackPress = useCallback(
		() => router.replace("/tabs/(tabs)/home"),
		[router],
	);

	const keyExtractor = useCallback(
		(item: TopicListItem) =>
			item.type === "skeleton" ? item.id : item.topic.id,
		[],
	);

	const renderItem = useCallback(
		({ item }: { item: TopicListItem }) => {
			if (item.type === "skeleton") return <TopicCardSkeleton />;
			const topic = item.topic;
			return (
				<TopicCard
					title={topic.title}
					subtitle={
						topic.subtitle ||
						t("theory.sectionSubtitle", "Theory section")
					}
					progressLabel={buildProgressLabel(topic, t)}
					progressColor={
						topic.answeredQuestions === 0
							? muted
							: topic.scorePercent >= TOPIC_PASS_PERCENT
								? "#0f8b5f"
								: "#ef4444"
					}
					completed={topic.passed}
					locked={false}
					icon={getTopicIcon(topic.slug)}
					textColor={text}
					mutedColor={muted}
					onPress={() => handleTopicPress(topic.slug)}
				/>
			);
		},
		[t, muted, text, handleTopicPress],
	);

	const stats = useMemo(
		() => [
			{
				label: t("theory.topics", "Topics"),
				value: formatCount(summary.totalTopics),
			},
			{
				label: t("theory.questions", "Questions"),
				value: formatCount(summary.totalQuestions),
			},
			{
				label: t("theory.seen", "Seen"),
				value: formatCount(summary.seenQuestions),
			},
			{
				label: t("theory.notSeen", "Not Seen"),
				value: formatCount(summary.notSeenQuestions),
			},
		],
		[
			t,
			summary.notSeenQuestions,
			summary.seenQuestions,
			summary.totalQuestions,
			summary.totalTopics,
		],
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

				<Heading className="text-lg font-semibold" style={{ color: text }}>
					{t("theory.title", "Theory")}
				</Heading>

				<ProgressRing
					progress={summary.progressPercent}
					progressColor="#0f8b5f"
				/>
			</Box>

			{error && topics.length === 0 && !showSkeleton ? (
				<NetworkErrorState onRetry={handleRefresh} isRetrying={isRefreshing} />
			) : (
				<FlashList
				showsVerticalScrollIndicator={false}
					overScrollMode="never"
					decelerationRate="normal"
				refreshing={isRefreshing}
				onRefresh={handleRefresh}
				data={listData}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				ItemSeparatorComponent={THEORY_SEPARATOR}
				ListHeaderComponent={
					<Box className="mt-4 mb-3">
						{showSkeleton ? (
							<Box className="flex-row gap-2">
								{["s1", "s2", "s3", "s4"].map((key) => (
									<Box
										key={key}
										className="flex-1 bg-secondary-foreground/5 rounded-2xl p-1"
									>
										<Skeleton variant="sharp" className="h-3 mt-1 mx-2" />
										<Box className="mt-1 rounded-[14px] bg-background py-4 px-2">
											<Skeleton variant="sharp" className="h-5 mx-1" />
										</Box>
									</Box>
								))}
							</Box>
						) : (
							<StatsCardsRow items={stats} />
						)}

								</Box>
				}
				ListEmptyComponent={
					showSkeleton ? null : (
						<Box className="rounded-3xl bg-card px-4 py-5">
							<Text className="text-sm text-foreground/70">
								{t("theory.empty", "No topics found.")}
							</Text>
						</Box>
					)
				}
				contentContainerStyle={THEORY_LIST_CONTENT_STYLE}
			/>
			)}
		</Box>
	);
}
