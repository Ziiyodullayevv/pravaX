import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "token-confirm:skip";

export function useTokenConfirm() {
	const [shouldSkip, setShouldSkip] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		AsyncStorage.getItem(STORAGE_KEY)
			.then((value) => setShouldSkip(value === "true"))
			.catch(() => {})
			.finally(() => setIsLoaded(true));
	}, []);

	const setSkip = useCallback((value: boolean) => {
		setShouldSkip(value);
		if (value) {
			AsyncStorage.setItem(STORAGE_KEY, "true").catch(() => {});
		} else {
			AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
		}
	}, []);

	return { shouldSkip, isLoaded, setSkip };
}
