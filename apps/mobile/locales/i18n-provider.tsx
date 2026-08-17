import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import ruApp from "./langs/ru/app.json";
import uzCyrlApp from "./langs/uz-Cyrl/app.json";
import uzLatnApp from "./langs/uz-Latn/app.json";

export const SUPPORTED_LANGUAGES = ["uz-Latn", "uz-Cyrl", "ru"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "uz-Latn";
const STORAGE_KEY = "settings:language";

type Dictionary = Record<string, string>;

const DICTIONARY_BY_LANGUAGE: Record<SupportedLanguage, Dictionary> = {
	"uz-Latn": uzLatnApp as Dictionary,
	"uz-Cyrl": uzCyrlApp as Dictionary,
	ru: ruApp as Dictionary,
};

let currentLanguageValue: SupportedLanguage = DEFAULT_LANGUAGE;

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
	return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

function resolveText(
	language: SupportedLanguage,
	key: string,
	fallback?: string,
): string {
	const activeDictionary = DICTIONARY_BY_LANGUAGE[language];
	const defaultDictionary = DICTIONARY_BY_LANGUAGE[DEFAULT_LANGUAGE];

	if (Object.prototype.hasOwnProperty.call(activeDictionary, key)) {
		return activeDictionary[key];
	}

	if (Object.prototype.hasOwnProperty.call(defaultDictionary, key)) {
		return defaultDictionary[key];
	}

	return fallback ?? key;
}

type I18nContextValue = {
	language: SupportedLanguage;
	setLanguage: (language: SupportedLanguage) => void;
	isReady: boolean;
	t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function getCurrentLanguage() {
	return currentLanguageValue;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
	const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		let isMounted = true;

		(async () => {
			try {
				const savedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
				if (!isMounted) return;

				if (isSupportedLanguage(savedLanguage)) {
					currentLanguageValue = savedLanguage;
					setLanguageState(savedLanguage);
					return;
				}

				currentLanguageValue = DEFAULT_LANGUAGE;
				setLanguageState(DEFAULT_LANGUAGE);
			} finally {
				if (isMounted) setIsReady(true);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, []);

	const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
		currentLanguageValue = nextLanguage;
		setLanguageState(nextLanguage);
		AsyncStorage.setItem(STORAGE_KEY, nextLanguage).catch(() => {});
	}, []);

	const t = useCallback(
		(key: string, fallback?: string) => resolveText(language, key, fallback),
		[language],
	);

	const value = useMemo<I18nContextValue>(
		() => ({
			language,
			setLanguage,
			isReady,
			t,
		}),
		[isReady, language, setLanguage, t],
	);

	if (!isReady) return null;

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const context = useContext(I18nContext);
	if (!context) throw new Error("useI18n must be used within I18nProvider");
	return context;
}
