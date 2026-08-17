import React from "react";
import { Stack } from "expo-router";

export default function QuestionsLayout() {
	return (
		<Stack
			initialRouteName="index"
			screenOptions={{
				headerShown: false,
				animation: "fade",
				animationDuration: 180,
				freezeOnBlur: true,
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Screen name="daily-plan" />
			<Stack.Screen name="exam/index" />
			<Stack.Screen name="bookmarks/index" />
			<Stack.Screen name="contest/[contestId]" />
			<Stack.Screen name="contest/register/[contestId]" />
			<Stack.Screen name="mistakes/index" />
			<Stack.Screen name="marathon/index" />
			<Stack.Screen name="questions/index" />
			<Stack.Screen name="questions/[questionId]" />
			<Stack.Screen name="signs/index" />
			<Stack.Screen name="signs/[categoryId]" />
			<Stack.Screen name="theory/index" />
			<Stack.Screen name="theory/[slug]" />
			<Stack.Screen name="theory/test/[sessionId]" />
			<Stack.Screen name="theory/[slug]/result" />
		</Stack>
	);
}
