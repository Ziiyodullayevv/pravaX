import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_AUTO_ADVANCE = false;

export function getAutoAdvanceStorageKey(slug: string) {
	return `test:autoAdvance:${slug}`;
}

export function useAutoAdvance(slug?: string) {
	const normalizedSlug = useMemo(
		() => (slug && slug.trim().length > 0 ? slug.trim() : "default"),
		[slug],
	);
	const storageKey = useMemo(
		() => getAutoAdvanceStorageKey(normalizedSlug),
		[normalizedSlug],
	);

	const [value, setValueState] = useState<boolean>(DEFAULT_AUTO_ADVANCE);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setIsReady(false);

		(async () => {
			try {
				const stored = await AsyncStorage.getItem(storageKey);
				if (cancelled) return;
				setValueState(stored === "1");
			} catch {
				if (!cancelled) {
					setValueState(DEFAULT_AUTO_ADVANCE);
				}
			} finally {
				if (!cancelled) {
					setIsReady(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [storageKey]);

	const setValue = useCallback(
		(nextValue: boolean) => {
			setValueState(nextValue);
			AsyncStorage.setItem(storageKey, nextValue ? "1" : "0").catch(() => {});
		},
		[storageKey],
	);

	return { value, setValue, isReady };
}

