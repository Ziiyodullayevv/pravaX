import React from "react";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type StatCardItem = {
	label: string;
	value: string | number;
};

type StatsCardsRowProps = {
	items: StatCardItem[];
	className?: string;
};

export function StatsCardsRow({ items, className }: StatsCardsRowProps) {
	return (
		<Box className={["flex-row gap-2", className ?? ""].join(" ").trim()}>
			{items.map((item) => (
				<Box
					key={item.label}
					className="flex-1 bg-secondary-foreground/5 rounded-2xl p-1"
				>
					<Text
						className="text-[12px] mt-1 text-center"
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{item.label}
					</Text>
					<Box className="mt-1 rounded-[14px] bg-background py-4">
						<Heading className="text-center text-[20px] font-semibold">
							{item.value}
						</Heading>
					</Box>
				</Box>
			))}
		</Box>
	);
}
