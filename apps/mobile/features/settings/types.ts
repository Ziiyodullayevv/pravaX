import type React from "react";

export type RowItem = {
	id: string;
	title: string;
	subtitle?: string;
	icon: React.ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
	onPress: () => void;
};

export type PlanItem = {
	id: string;
	title: string;
	period: string;
	price: string;
	oldPrice: string;
	discount: string;
};

export type ThemeColors = {
	iconColor: string;
	activeColor: string;
	inactiveColor: string;
	switchThumbColor: string;
	pressedRowBg: string;
};
