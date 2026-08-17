import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Appearance, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ColorMode = "light" | "dark";
type ThemePreference = "system" | ColorMode;

type ThemeContextValue = {
	colorMode: ColorMode;
	themePreference: ThemePreference;
	setColorMode: (mode: ColorMode) => void;
	setThemePreference: (mode: ThemePreference) => void;
	toggleColorMode: () => void;
	isReady: boolean;
};

const STORAGE_KEY = "app:themePreference";
const LEGACY_STORAGE_KEY = "app:colorMode";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function safeReadAppearance(): ColorMode {
	const scheme = Appearance.getColorScheme();
	return scheme === "dark" ? "dark" : "light";
}

function applyAppearance(preference: ThemePreference) {
	try {
		if (preference === "system") {
			// "unspecified" — Android/iOS native ham qabul qiladi, null EMAS.
			Appearance.setColorScheme("unspecified" as never);
		} else {
			Appearance.setColorScheme(preference);
		}
	} catch {
		// ignore — eski platforma versiyalari
	}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [systemColorScheme, setSystemColorScheme] = useState<ColorMode>(
		safeReadAppearance,
	);
	const [themePreference, setThemePreferenceState] =
		useState<ThemePreference>("system");
	const [isReady, setIsReady] = useState(false);

	// Har gal preference o'zgarsa, native Appearance ni sinxronlaymiz.
	useEffect(() => {
		if (!isReady) return;
		applyAppearance(themePreference);
	}, [themePreference, isReady]);

	useEffect(() => {
		const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
			setSystemColorScheme(colorScheme === "dark" ? "dark" : "light");
		});
		const appStateSub = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				setSystemColorScheme(safeReadAppearance());
			}
		});
		setSystemColorScheme(safeReadAppearance());
		return () => {
			appearanceSub.remove();
			appStateSub.remove();
		};
	}, []);

	const colorMode: ColorMode =
		themePreference === "system" ? systemColorScheme : themePreference;

	// 1) load saved mode on mount
	useEffect(() => {
		let isMounted = true;

		(async () => {
			try {
				const savedPreference = await AsyncStorage.getItem(STORAGE_KEY);
				if (!isMounted) return;
				if (
					savedPreference === "system" ||
					savedPreference === "light" ||
					savedPreference === "dark"
				) {
					setThemePreferenceState(savedPreference);
					return;
				}

				const legacySavedPreference = await AsyncStorage.getItem(
					LEGACY_STORAGE_KEY,
				);
				if (!isMounted) return;
				if (
					legacySavedPreference === "light" ||
					legacySavedPreference === "dark"
				) {
					setThemePreferenceState(legacySavedPreference);
				}
			} finally {
				if (isMounted) setIsReady(true);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, []);

	// 2) persist on change (when ready)
	useEffect(() => {
		if (!isReady) return;
		AsyncStorage.setItem(STORAGE_KEY, themePreference).catch(() => {});
	}, [themePreference, isReady]);

	const value = useMemo<ThemeContextValue>(
		() => ({
			colorMode,
			themePreference,
			setColorMode: (mode) => setThemePreferenceState(mode),
			setThemePreference: setThemePreferenceState,
			toggleColorMode: () =>
				setThemePreferenceState((currentPreference) => {
					const currentMode =
						currentPreference === "system"
							? systemColorScheme
							: currentPreference;

					return currentMode === "dark" ? "light" : "dark";
				}),
			isReady,
		}),
		[colorMode, isReady, systemColorScheme, themePreference],
	);

	if (!isReady) return null;

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
	return ctx;
}
