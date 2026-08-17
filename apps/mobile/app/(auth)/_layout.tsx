import React from "react";
import { Stack } from "expo-router";

export default function AuthLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				animation: "fade",
				animationDuration: 180,
				freezeOnBlur: true,
			}}
		>
			<Stack.Screen name="login" />
			<Stack.Screen name="phone-login" />
			<Stack.Screen name="auth/callback" />
		</Stack>
	);
}
