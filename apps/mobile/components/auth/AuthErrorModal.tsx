import React from "react";
import { Pressable } from "react-native";
import { AlertTriangle, X } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import {
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalContent,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";

type AuthErrorModalProps = {
	isOpen: boolean;
	title: string;
	message: string;
	onClose: () => void;
};

export function AuthErrorModal({
	isOpen,
	title,
	message,
	onClose,
}: AuthErrorModalProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalBackdrop className="bg-black/45" />
			<ModalContent className="rounded-[34px] border-0 bg-background px-6 pt-6 pb-6">
				<Pressable className="absolute right-5 top-5 z-10" onPress={onClose}>
					<X size={24} color="#8f8f8f" />
				</Pressable>

				<ModalBody className="mt-0 mb-0 pt-8 pb-0">
					<Box className="items-center">
						<Box className="h-20 w-20 rounded-full border-2 border-red-300 bg-red-100/70 items-center justify-center">
							<AlertTriangle size={34} color="#dc2626" strokeWidth={2.4} />
						</Box>

						<Heading className="mt-8 text-center text-2xl font-bold">
							{title}
						</Heading>
						<Text className="mt-4 text-center text-base leading-6 text-muted-foreground">
							{message}
						</Text>

						<Pressable className="mt-6 w-full" onPress={onClose}>
							<Box className="h-12 rounded-2xl bg-[#ff9f2f] items-center justify-center">
								<Text className="text-base font-bold text-[#1B1203]">
									Tushundim
								</Text>
							</Box>
						</Pressable>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
