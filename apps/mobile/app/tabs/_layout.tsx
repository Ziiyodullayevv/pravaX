export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
	// Ensure that reloading on `/modal` keeps a back button present.
	initialRouteName: "(tabs)",
};

import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/auth-context";
import { useAppTheme } from "@/contexts/theme-context";
import { Redirect, Stack } from "expo-router";


export default function AppLayout() {
	const { colorMode, isReady } = useAppTheme();
	const { isAuthenticated, isLoading } = useAuth();
	if (!isReady) return null;
	if (isLoading) return null;
	if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

	const isDark = colorMode === "dark";
	const bg = isDark ? Colors.dark.background : Colors.light.background;

	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: bg },
				animation: "fade",
				animationDuration: 180,
				freezeOnBlur: true,
			}}
		>
			<Stack.Screen options={{ headerShown: false }} name="(tabs)" />
			<Stack.Screen options={{ headerShown: false }} name="(questions)" />
			<Stack.Screen options={{ headerShown: false }} name="notifications" />
		</Stack>
	);
}
