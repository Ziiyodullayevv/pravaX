import React from "react";
import { Pressable } from "react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { CustomSwitch } from "@/components/CustomSwitch";

type ToggleRowProps = {
	label: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
	withDivider?: boolean;
};

export function ToggleRow({
	label,
	value,
	onValueChange,
	withDivider = true,
}: ToggleRowProps) {
	return (
		<Pressable onPress={() => onValueChange(!value)}>
			<Box
				className={[
					"min-h-14 flex-row items-center justify-between py-3",
					withDivider ? "border-b border-foreground/10" : "",
				].join(" ")}
			>
				<Text className="flex-1 pr-4 text-base font-normal" numberOfLines={2}>
					{label}
				</Text>
				<Box className="w-[64px] items-end">
					<CustomSwitch value={value} onValueChange={onValueChange} />
				</Box>
			</Box>
		</Pressable>
	);
}
