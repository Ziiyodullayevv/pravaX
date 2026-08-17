import React from "react";
import { View } from "react-native";
import { BellRing, ChevronRight } from "lucide-react-native";

import { YandexRippleButton } from "@/components/YandexRippleButton";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { CustomSwitch } from "@/components/CustomSwitch";
import { RowItem, ThemeColors } from "../types";
import { SettingsIconFrame } from "./SettingsIconFrame";

type SettingsRowsCardProps = {
	rows: RowItem[];
	colors: ThemeColors;
	pushEnabled: boolean;
	onTogglePush: () => void;
	onSetPushEnabled: (value: boolean) => void;
	pushTitle: string;
	pushSubtitle?: string;
};

export function SettingsRowsCard({
	rows,
	colors,
	pushEnabled,
	onTogglePush,
	onSetPushEnabled,
	pushTitle,
	pushSubtitle,
}: SettingsRowsCardProps) {
	return (
		<Box className="mt-3 rounded-3xl bg-card overflow-hidden">
			{rows.map((item, index) => {
				const ItemIcon = item.icon;
				const isLast = index === rows.length - 1;

				return (
					<YandexRippleButton
						key={item.id}
						onPress={item.onPress}
						borderRadius={0}
						rippleOpacity={0.05}
					>
						<Box className="px-4 py-4 flex-row items-center">
							<SettingsIconFrame>
								<ItemIcon
									size={20}
									color={colors.iconColor}
									strokeWidth={1.9}
								/>
							</SettingsIconFrame>

							<Box className="ml-4 flex-1 pr-2" style={{ minWidth: 0 }}>
								<Heading
									className="text-sm font-semibold"
									style={{ flexShrink: 1 }}
								>
									{item.title}
								</Heading>
								{item.subtitle ? (
									<Text
										className="mt-1 text-[12px] leading-5 text-muted-foreground"
										style={{ flexShrink: 1 }}
									>
										{item.subtitle}
									</Text>
								) : null}
							</Box>

							<ChevronRight size={22} color={colors.iconColor} />
						</Box>
						{!isLast ? <Divider className="mx-4" /> : null}
					</YandexRippleButton>
				);
			})}

			{rows.length > 0 ? <Divider className="mx-4" /> : null}

			<YandexRippleButton
				onPress={onTogglePush}
				borderRadius={0}
				rippleOpacity={0.05}
			>
				<Box className="px-4 py-4 flex-row items-center">
					<SettingsIconFrame>
						<BellRing size={20} color={colors.iconColor} strokeWidth={1.9} />
					</SettingsIconFrame>

					<Box className="ml-4 flex-1 pr-2" style={{ minWidth: 0 }}>
						<Heading
							className="text-sm font-semibold"
							style={{ flexShrink: 1 }}
						>
							{pushTitle}
						</Heading>
						{pushSubtitle ? (
							<Text
								className="mt-1 text-[12px] leading-5 text-muted-foreground"
								style={{ flexShrink: 1 }}
							>
								{pushSubtitle}
							</Text>
						) : null}
					</Box>

					<View pointerEvents="box-only">
						<CustomSwitch
							value={pushEnabled}
							onValueChange={onSetPushEnabled}
							trackOnColor={colors.activeColor}
							trackOffColor={colors.inactiveColor}
							borderColor={colors.inactiveColor}
							thumbColor={colors.switchThumbColor}
						/>
					</View>
				</Box>
			</YandexRippleButton>
		</Box>
	);
}
