import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { LayoutChangeEvent, Pressable, ScrollView } from "react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

export type QuestionNavigatorStatus =
	| "default"
	| "current"
	| "correct"
	| "wrong"
	| "answered";

export type QuestionNavigatorItem = {
	key: string;
	label: string;
	status: QuestionNavigatorStatus;
};

type QuestionNavigatorProps = {
	items: QuestionNavigatorItem[];
	onPress: (index: number) => void;
};

export function QuestionNavigator({ items, onPress }: QuestionNavigatorProps) {
	const scrollRef = useRef<ScrollView | null>(null);
	const containerWidthRef = useRef(0);
	const scrollXRef = useRef(0);
	const itemLayoutsRef = useRef<Record<number, { x: number; width: number }>>(
		{},
	);
	const currentIndex = useMemo(
		() => items.findIndex((item) => item.status === "current"),
		[items],
	);

	const keepIndexVisible = useCallback((index: number) => {
		if (index < 0) return;

		const layout = itemLayoutsRef.current[index];
		const viewportWidth = containerWidthRef.current;
		if (!layout || viewportWidth <= 0) return;

		const sidePadding = 24;
		const currentScrollX = scrollXRef.current;
		const viewStart = currentScrollX;
		const viewEnd = currentScrollX + viewportWidth;
		const itemStart = layout.x;
		const itemEnd = layout.x + layout.width;

		let targetX = currentScrollX;
		if (itemEnd > viewEnd - sidePadding) {
			targetX = itemEnd - viewportWidth + sidePadding;
		} else if (itemStart < viewStart + sidePadding) {
			targetX = itemStart - sidePadding;
		}

		targetX = Math.max(0, targetX);
		if (Math.abs(targetX - currentScrollX) > 1) {
			scrollRef.current?.scrollTo({ x: targetX, animated: true });
		}
	}, []);

	const onContainerLayout = (event: LayoutChangeEvent) => {
		containerWidthRef.current = event.nativeEvent.layout.width;
		keepIndexVisible(currentIndex);
	};

	useEffect(() => {
		const id = requestAnimationFrame(() => keepIndexVisible(currentIndex));
		return () => cancelAnimationFrame(id);
	}, [currentIndex, keepIndexVisible]);

	return (
		<ScrollView
			ref={scrollRef}
			horizontal
			showsHorizontalScrollIndicator={false}
			className="my-3"
			onLayout={onContainerLayout}
			onScroll={(event) => {
				scrollXRef.current = event.nativeEvent.contentOffset.x;
			}}
			scrollEventThrottle={16}
			contentContainerStyle={{ gap: 6, paddingRight: 16, paddingLeft: 16 }}
		>
			{items.map((item, index) => {
				const isWrong = item.status === "wrong";
				const isCorrect = item.status === "correct";
				const isActive = item.status === "current";
				const isAnswered = item.status === "answered";

				return (
					<Pressable
						key={item.key}
						onPress={() => onPress(index)}
						onLayout={(event) => {
							const { x, width } = event.nativeEvent.layout;
							itemLayoutsRef.current[index] = { x, width };
							if (item.status === "current") {
								keepIndexVisible(index);
							}
						}}
					>
						<Box
							className={[
								"h-10 min-w-10 border-2 rounded-xl items-center justify-center",
								isWrong
									? "border-destructive bg-card"
									: isCorrect
										? "border-brand bg-card"
										: isActive
											? "bg-card"
											: isAnswered
												? "border-foreground/25 bg-card"
												: "border-transparent bg-foreground/10",
								isActive ? "border-foreground" : "",
							].join(" ")}
						>
							<Text
								className={[
									"font-medium text-sm",
									isWrong ? "text-destructive" : "",
									isCorrect ? "text-brand" : "",
									isActive ? "font-semibold" : "",
								].join(" ")}
							>
								{item.label}
							</Text>
						</Box>
					</Pressable>
				);
			})}
		</ScrollView>
	);
}
