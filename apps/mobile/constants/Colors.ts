/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "rgb(81, 167, 118)";
const tintColorDark = "#70e876";

export const Colors = {
	light: {
		text: "#11181C",
		background: "#fff",
		forground: "#e7e5e4",
		tabsBackground: "#fff",
		tint: tintColorLight,
		tabIconDefault: "#687076",
		tabIconSelected: tintColorLight,
	},
	dark: {
		text: "#ECEDEE",
		background: "#252525",
		forground: "#363636",
		tabsBackground: "#2b2b2b",
		tint: tintColorDark,
		tabIconDefault: "#9BA1A6",
		tabIconSelected: tintColorDark,
	},
};
