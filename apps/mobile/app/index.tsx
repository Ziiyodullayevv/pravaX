import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

export default function Index() {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) return null;
	if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

	return <Redirect href="/tabs/home" />;
}
