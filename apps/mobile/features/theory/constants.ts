import type { TestSettings } from "./types";

export const SETTINGS_KEYS = {
	autoAdvance: "settings:autoAdvance",
} as const;

export const DEFAULT_TEST_SETTINGS: TestSettings = {
	autoAdvance: false,
};

export const AUTO_ADVANCE_DELAY_MS = 450;
export const SECONDS_PER_QUESTION = 40;
export const MIN_TEST_SECONDS = 5 * 60;
export const CATEGORY_TEST_TOKEN_COST = 8;
export const TOPIC_PASS_PERCENT = 80;
export const ANONYMOUS_USER_ID = "anonymous";
