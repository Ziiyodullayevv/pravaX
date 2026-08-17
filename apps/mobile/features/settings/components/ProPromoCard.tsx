import React from "react";
import { Pressable } from "react-native";
import { Check, Crown } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type ProPromoCardProps = {
	onPress: () => void;
};

export function ProPromoCard({ onPress }: ProPromoCardProps) {
	return (
		<Box className="mt-3 rounded-3xl overflow-hidden">
			<Box className="!bg-[##ff4d6d] px-6 py-5 overflow-hidden">
				<Box className="absolute -top-10 -left-10 h-28 w-28 rounded-full bg-white/10" />
				<Box className="absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-white/15" />

				<Box className="flex-row items-start justify-between gap-4">
					<Box className="flex-1">
						<Heading className="text-white text-xl font-semibold">
							Unlock Pro Features!
						</Heading>

						<Box className="mt-3 gap-2">
							<Box className="flex-row items-center gap-2">
								<Check size={16} color="#ffffff" strokeWidth={2.4} />
								<Text className="text-white/90 text-sm">No Ads anymore</Text>
							</Box>
							<Box className="flex-row items-center gap-2">
								<Check size={16} color="#ffffff" strokeWidth={2.4} />
								<Text className="text-white/90 text-sm">
									Access to AI features
								</Text>
							</Box>
							<Box className="flex-row items-center gap-2">
								<Check size={16} color="#ffffff" strokeWidth={2.4} />
								<Text className="text-white/90 text-sm">
									New titles and effects
								</Text>
							</Box>
						</Box>
					</Box>

					<Box className="h-12 w-12 rounded-full bg-white/20 items-center justify-center">
						<Crown size={22} color="#ffffff" />
					</Box>
				</Box>

				<Pressable
					className="mt-5 rounded-2xl bg-white px-4 py-3"
					onPress={onPress}
					style={({ pressed }) => ({
						opacity: pressed ? 0.85 : 1,
						transform: [{ scale: pressed ? 0.98 : 1 }],
					})}
					android_ripple={{ color: "rgba(255,255,255,0.35)" }}
				>
					<Text className="text-center text-base font-semibold text-[##ff4d6d]">
						Try Pro Free for 7 Days
					</Text>
				</Pressable>
			</Box>
		</Box>
	);
}
