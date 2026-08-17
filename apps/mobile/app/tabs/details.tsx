import React from "react";
import { Pressable, ScrollView } from "react-native";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { ChevronLeft, Lock } from "lucide-react-native";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/theme-context";

export default function DetailsScreen() {
	const lockColor = "#f97316";
	const { colorMode } = useAppTheme();
	const isDark = colorMode === "dark";
	const defaultColor = isDark ? Colors.dark.text : Colors.light.text;
	const router = useRouter();

	return (
		<React.Fragment>
			<Box className="h-[300px] relative">
				<Box className="pt-safe absolute z-[100] top-0 left-0 right-0">
					<Box className="flex-row items-center px-5 h-14">
						<Button
							onPress={() => router.back()}
							variant="ghost"
							className="bg-card h-14 w-14 rounded-full"
						>
							<ChevronLeft color={defaultColor} />
						</Button>
						<Box className="flex-1 items-center">
							<Heading className="text-2xl text-white font-semibold">
								Questions Text
							</Heading>
						</Box>
						<Box className="w-14" />
					</Box>
				</Box>
				<Image
					alt="image"
					className="object-cover  w-full h-full"
					source={{
						uri: "https://media.architecturaldigest.com/photos/6679b599132b6a297f93f7ff/master/w_1600%2Cc_limit/EMBARGO-BUGATTI-World-Premiere-Presskit-Images-02.jpg",
					}}
				/>
			</Box>

			<Box className="flex-2 bg-background px-5">
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
				>
					<Box className="gap-3 py-4">
						{practiceList.map((item: { id: string; question: string }) => (
							<Pressable key={`${item.id}`} onPress={() => router.push(`/`)}>
								<Box className="bg-card px-5 py-4 flex-row justify-between items-center rounded-2xl">
									<Box className="flex-1 gap-1 pr-4">
										<Text className="text-sm text-primary/60">
											Question {item.id}
										</Text>
										<Heading
											numberOfLines={1}
											ellipsizeMode="tail"
											className="text-base font-normal"
										>
											{item.question}
										</Heading>
									</Box>

									<Box className="w-[35px] h-[35px] rounded-full bg-orange-500/20 items-center justify-center">
										<Lock size={16} color={lockColor} />
									</Box>
								</Box>
							</Pressable>
						))}
					</Box>
				</ScrollView>
			</Box>
		</React.Fragment>
	);
}

const practiceList = [
	{ id: "1", question: "Stop and wait until the traffic light turns green" },
	{ id: "2", question: "Continue driving if the road ahead is clear" },
	{ id: "3", question: "Yield to pedestrians already on the crossing" },
	{ id: "4", question: "Check mirrors and signal before changing lanes" },
	{ id: "5", question: "Keep a safe following distance in wet conditions" },
	{ id: "6", question: "Reduce speed when approaching a school zone" },
	{ id: "7", question: "Give way to emergency vehicles using sirens" },
	{ id: "8", question: "Use headlights from dusk until dawn" },
	{ id: "9", question: "Do not overtake when the line is solid" },
	{ id: "10", question: "Park within the marked bay lines" },
];
