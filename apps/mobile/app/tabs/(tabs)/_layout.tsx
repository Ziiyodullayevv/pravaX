import React from "react";
import { Tabs } from "expo-router";
import { CustomTabBar } from "@/components/CustomTabBar";
import { Home, Search, Settings, Trophy } from "lucide-react-native";
import { useI18n } from "@/locales/i18n-provider";

export default function TabLayout() {
	const { t } = useI18n();

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
			}}
			tabBar={(props) => <CustomTabBar {...props} />}
		>
			<Tabs.Screen
				name="home"
				options={{
					title: t("tabs.home", "Asosiy"),
					tabBarIcon: ({ color, size }) => (
						<Home size={size} color={color} strokeWidth={2.2} />
					),
				}}
			/>

			<Tabs.Screen
				name="contest"
				options={{
					title: t("tabs.contest", "Contest"),
					tabBarIcon: ({ color, size }) => (
						<Trophy size={size} color={color} strokeWidth={2.2} />
					),
				}}
			/>

			<Tabs.Screen
				name="search"
				options={{
					title: t("tabs.search", "Qidiruv"),
					tabBarIcon: ({ color, size }) => (
						<Search size={size} color={color} strokeWidth={2.2} />
					),
				}}
			/>

			<Tabs.Screen
				name="settings"
				options={{
					title: t("tabs.settings", "Sozlamalar"),
					tabBarIcon: ({ color, size }) => (
						<Settings size={size} color={color} strokeWidth={2.2} />
					),
				}}
			/>
		</Tabs>
	);
}
