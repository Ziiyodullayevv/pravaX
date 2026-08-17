import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Modal, View } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";

import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type ImageViewerImage = {
	url?: string;
	source?: React.ComponentProps<typeof Image>["source"];
	alt?: string;
};

type ImageViewerContextValue = {
	images: ImageViewerImage[];
	isOpen: boolean;
	index: number;
	openAt: (index?: number) => void;
	close: () => void;
	goNext: () => void;
	goPrev: () => void;
	currentImage: ImageViewerImage | null;
};

const ImageViewerContext = createContext<ImageViewerContextValue | null>(null);

function useImageViewer() {
	const context = useContext(ImageViewerContext);
	if (!context) {
		throw new Error("ImageViewer components must be used inside <ImageViewer>.");
	}
	return context;
}

function clampIndex(index: number, total: number) {
	if (total <= 0) return 0;
	return Math.min(total - 1, Math.max(0, index));
}

function toImageSource(image: ImageViewerImage | null) {
	if (!image) return undefined;
	if (image.source) return image.source;
	if (image.url) return { uri: image.url };
	return undefined;
}

export function ImageViewer({
	images,
	children,
}: {
	images: ImageViewerImage[];
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [index, setIndex] = useState(0);

	useEffect(() => {
		setIndex((prev) => clampIndex(prev, images.length));
	}, [images.length]);

	const openAt = (nextIndex = 0) => {
		setIndex(clampIndex(nextIndex, images.length));
		setIsOpen(true);
	};

	const close = () => setIsOpen(false);

	const goNext = () => {
		if (images.length <= 1) return;
		setIndex((prev) => (prev + 1) % images.length);
	};

	const goPrev = () => {
		if (images.length <= 1) return;
		setIndex((prev) => (prev - 1 + images.length) % images.length);
	};

	const value = useMemo<ImageViewerContextValue>(
		() => ({
			images,
			isOpen,
			index,
			openAt,
			close,
			goNext,
			goPrev,
			currentImage: images[index] ?? null,
		}),
		[images, isOpen, index],
	);

	return (
		<ImageViewerContext.Provider value={value}>
			{children}
		</ImageViewerContext.Provider>
	);
}

export function ImageViewerTrigger({
	index = 0,
	onPress,
	children,
	...props
}: React.ComponentProps<typeof Pressable> & { index?: number }) {
	const { openAt } = useImageViewer();

	return (
		<Pressable
			{...props}
			onPress={(event) => {
				onPress?.(event);
				openAt(index);
			}}
		>
			{children}
		</Pressable>
	);
}

export function ImageViewerContent({
	children,
}: {
	children?: React.ReactNode;
}) {
	const { isOpen, close, currentImage } = useImageViewer();
	const source = toImageSource(currentImage);

	return (
		<Modal
			transparent
			visible={isOpen}
			animationType="fade"
			onRequestClose={close}
		>
			<View className="flex-1 bg-black/95">
				<View className="flex-1 justify-center items-center px-3">
					{source ? (
						<Image
							source={source}
							alt={currentImage?.alt ?? "Image"}
							className="w-full h-full"
							resizeMode="contain"
						/>
					) : null}
				</View>

				<View pointerEvents="box-none" className="absolute inset-0">
					{children}
				</View>
			</View>
		</Modal>
	);
}

export function ImageViewerCloseButton({
	onPress,
	...props
}: React.ComponentProps<typeof Pressable>) {
	const { close } = useImageViewer();

	return (
		<Pressable
			{...props}
			onPress={(event) => {
				onPress?.(event);
				close();
			}}
			className={[
				"absolute top-14 right-4 z-20 h-10 w-10 rounded-full bg-black/45 items-center justify-center",
				props.className ?? "",
			].join(" ")}
		>
			<X size={20} color="#ffffff" />
		</Pressable>
	);
}

export function ImageViewerNavigation() {
	const { images, goPrev, goNext } = useImageViewer();
	if (images.length <= 1) return null;

	return (
		<>
			<Pressable
				onPress={goPrev}
				className="absolute left-3 top-1/2 z-20 h-11 w-11 rounded-full bg-black/45 items-center justify-center"
				style={{ transform: [{ translateY: -22 }] }}
			>
				<ChevronLeft size={22} color="#ffffff" />
			</Pressable>
			<Pressable
				onPress={goNext}
				className="absolute right-3 top-1/2 z-20 h-11 w-11 rounded-full bg-black/45 items-center justify-center"
				style={{ transform: [{ translateY: -22 }] }}
			>
				<ChevronRight size={22} color="#ffffff" />
			</Pressable>
		</>
	);
}

export function ImageViewerCounter() {
	const { index, images } = useImageViewer();
	if (images.length === 0) return null;

	return (
		<View className="absolute top-14 left-0 right-0 items-center z-20">
			<Text className="text-white text-sm">
				{index + 1} / {images.length}
			</Text>
		</View>
	);
}
