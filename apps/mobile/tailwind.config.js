/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : "class",
	content: [
		"./app/**/*.{html,js,jsx,ts,tsx,mdx}",
		"./components/**/*.{html,js,jsx,ts,tsx,mdx}",
		"./features/**/*.{html,js,jsx,ts,tsx,mdx}",
		"./utils/**/*.{html,js,jsx,ts,tsx,mdx}",
	],
	presets: [require("nativewind/preset")],
	important: "html",
	safelist: [
		{
			pattern:
				/(bg|border|text|stroke|fill)-(foreground|card|popover|muted|destructive|border|input|ring|white|chart|sidebar|primary|secondary|typography|background|accent)(\/\d+)?$/,
		},
		{
			pattern:
				/(bg|border|text|stroke|fill)-(card|popover|muted|destructive|primary|secondary|accent|sidebar)-(foreground)(\/\d+)?$/,
		},
	],
	theme: {
		extend: {
			colors: {
				brand: "rgb(var(--brand)/<alpha-value>)",
				foreground: "rgb(var(--foreground)/<alpha-value>)",
				card: {
					DEFAULT: "rgb(var(--card) / <alpha-value>)",
					foreground: "rgb(var(--card-foreground) / <alpha-value>)",
					custom: "rgb(var(--custom)/<alpha-value>)",
				},
				popover: {
					DEFAULT: "rgb(var(--popover) / <alpha-value>)",
					foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
				},
				muted: {
					DEFAULT: "rgb(var(--muted) / <alpha-value>)",
					foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
				},
				destructive: {
					DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
				},
				border: "rgb(var(--border)/<alpha-value>)",
				input: "rgb(var(--input)/<alpha-value>)",
				ring: "rgb(var(--ring) / <alpha-value>)",
				white: "rgb(255 255 255)",
				// Chart colors
				chart: {
					1: "rgb(var(--chart-1) / <alpha-value>)",
					2: "rgb(var(--chart-2) / <alpha-value>)",
					3: "rgb(var(--chart-3) / <alpha-value>)",
					4: "rgb(var(--chart-4) / <alpha-value>)",
					5: "rgb(var(--chart-5) / <alpha-value>)",
				},

				// Sidebar colors
				sidebar: {
					DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
					foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
					primary: "rgb(var(--sidebar-primary) / <alpha-value>)",
					"primary-foreground":
						"rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
					accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
					"accent-foreground":
						"rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
					border: "rgb(var(--sidebar-border))",
					ring: "rgb(var(--sidebar-ring) / <alpha-value>)",
				},

				primary: {
					DEFAULT: "rgb(var(--primary)/<alpha-value>)",
					foreground: "rgb(var(--primary-foreground)/<alpha-value>)",
				},

				secondary: {
					DEFAULT: "rgb(var(--secondary)/<alpha-value>)",
					foreground: "rgb(var(--secondary-foreground)/<alpha-value>)",
				},

				typography: {
					white: "#FFFFFF",
					gray: "#D4D4D4",
					black: "#181718",
				},

				background: {
					DEFAULT: "rgb(var(--background)/<alpha-value>)",
				},
				accent: {
					DEFAULT: "rgb(var(--accent)/<alpha-value>)",
					foreground: "rgb(var(--accent-foreground)/<alpha-value>)",
				},
			},
			fontFamily: {
				heading: undefined,
				body: "var(--font-sans)",
				mono: "var(--font-mono)",
				sans: "var(--font-sans)",
				serif: "var(--font-serif)",
				inter: ["var(--font-inter)"],
				georgia: ["Georgia"],
				melno: ["Melno"],
				andika: [
					"Andika_400Regular",
					"Andika_400Regular_Italic",
					"Andika_700Bold",
					"Andika_700Bold_Italic",
				],
				outfit: [
					"Outfit_400Regular",
					"Outfit_500Medium",
					"Outfit_600SemiBold",
					"Outfit_700Bold",
					"Outfit_800ExtraBold",
					"Outfit_900Black",
				],
			},
			fontWeight: {
				extrablack: "950",
			},
			fontSize: {
				"2xs": "10px",
			},
			boxShadow: {
				// iOS 26 Liquid Glass shadows: cool tinted glow + soft depth
				"hard-1": "0px 1px 4px rgba(193, 219, 255, 0.30), 0px 2px 4px rgba(15, 23, 42, 0.06)",
				"hard-2": "0px 2px 6px rgba(193, 219, 255, 0.35), 0px 4px 8px rgba(15, 23, 42, 0.08)",
				"hard-3": "0px 2px 8px rgba(193, 219, 255, 0.40), 0px 6px 12px rgba(15, 23, 42, 0.10)",
				"hard-4": "0px 3px 10px rgba(193, 219, 255, 0.40), 0px 8px 18px rgba(15, 23, 42, 0.12)",
				"hard-5": "0px 2px 6px rgba(193, 219, 255, 0.35), 0px 4px 10px rgba(15, 23, 42, 0.08)",
				"soft-1": "0px 2px 8px rgba(193, 219, 255, 0.40), 0px 4px 12px rgba(15, 23, 42, 0.06)",
				"soft-2": "0px 3px 12px rgba(193, 219, 255, 0.40), 0px 8px 18px rgba(15, 23, 42, 0.08)",
				"soft-3": "0px 4px 16px rgba(193, 219, 255, 0.45), 0px 12px 24px rgba(15, 23, 42, 0.10)",
				"soft-4": "0px 6px 20px rgba(193, 219, 255, 0.45), 0px 16px 32px rgba(15, 23, 42, 0.12)",
				"soft-5": "0px 8px 24px rgba(193, 219, 255, 0.50), 0px 20px 40px rgba(15, 23, 42, 0.14)",
			},
		},
	},
};
