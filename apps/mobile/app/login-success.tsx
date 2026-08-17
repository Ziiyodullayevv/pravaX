import { Redirect } from "expo-router";

import { useAuth } from "@/contexts/auth-context";

export default function LoginSuccessRedirect() {
	const { isAuthenticated } = useAuth();
	return <Redirect href={isAuthenticated ? "/tabs/home" : "/(auth)/login"} />;
}
