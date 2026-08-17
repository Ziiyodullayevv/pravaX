import type React from "react";

import { GradientIconFrame } from "@/components/GradientIconFrame";

export function SettingsIconFrame({ children }: { children: React.ReactNode }) {
	return <GradientIconFrame>{children}</GradientIconFrame>;
}
