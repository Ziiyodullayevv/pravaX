import "@/global.css";
import "react-native-gesture-handler";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import {
	ThemeProvider as AppThemeProvider,
	useAppTheme,
} from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { AppQueryClientProvider } from "@/lib/query-client";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "@/constants/Colors";
import { I18nProvider } from "@/locales/i18n-provider";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [loaded, error] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
		...FontAwesome.font,
	});

	useEffect(() => {
		if (error) throw error;
	}, [error]);

	return (
		<AppThemeProvider>
			<I18nProvider>
				<AppQueryClientProvider>
					<AuthProvider>
						<RootLayoutNav fontsLoaded={loaded} />
					</AuthProvider>
				</AppQueryClientProvider>
			</I18nProvider>
		</AppThemeProvider>
	);
}

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
	const { colorMode, isReady } = useAppTheme();
	const { isLoading: authLoading } = useAuth();

	const isDark = colorMode === "dark";
	const bg = isDark ? Colors.dark.background : Colors.light.background;

	// Android "window background" ni theme ga moslab turadi
	useEffect(() => {
		SystemUI.setBackgroundColorAsync(bg).catch(() => {});
	}, [bg]);

	// Splash faqat font + theme ready bo‘lganda yopilsin
	useEffect(() => {
		if (fontsLoaded && isReady && !authLoading) {
			SplashScreen.hideAsync().catch(() => {});
		}
	}, [fontsLoaded, isReady, authLoading]);

	if (!fontsLoaded || !isReady || authLoading) return null;

	const navTheme = isDark
		? {
				...DarkTheme,
				colors: { ...DarkTheme.colors, background: bg, card: bg },
			}
		: {
				...DefaultTheme,
				colors: { ...DefaultTheme.colors, background: bg, card: bg },
			};

	return (
		<GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
			<NavThemeProvider value={navTheme}>
				<GluestackUIProvider
					mode={colorMode}
					style={{ backgroundColor: bg }}
				>
					<StatusBar style={'auto'} />
					<Slot />
				</GluestackUIProvider>
			</NavThemeProvider>
		</GestureHandlerRootView>
	);
}
