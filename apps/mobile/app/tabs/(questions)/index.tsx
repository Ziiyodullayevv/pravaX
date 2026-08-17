import React, { useEffect } from "react";
import { useRouter } from "expo-router";

import { Box } from "@/components/ui/box";

export default function QuestionsIndexScreen() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/tabs/(tabs)/home");
	}, [router]);

	return <Box className="flex-1 bg-background" />;
}
