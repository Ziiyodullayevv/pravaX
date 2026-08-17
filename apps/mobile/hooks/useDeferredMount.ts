import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

/**
 * Navigatsiya animatsiyasi tugaguncha og'ir queries/lists ni keyinga qoldirish.
 * Ekran avval lightweight skeleton chiqaradi, keyin to'liq mount bo'ladi.
 */
export function useDeferredMount(): boolean {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const handle = InteractionManager.runAfterInteractions(() => {
			setReady(true);
		});
		return () => handle.cancel();
	}, []);

	return ready;
}
