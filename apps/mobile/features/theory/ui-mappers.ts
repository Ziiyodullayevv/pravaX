import type { ImageSourcePropType } from "react-native";
import type { ComponentType } from "react";
import {
	Ban,
	Bike,
	BookOpen,
	Bookmark,
	Car,
	CircleCheck,
	CircleHelp,
	CircleParking,
	Cross,
	Flag,
	Gauge,
	Route,
	Shield,
	Signpost,
	TriangleAlert,
	Clapperboard,
} from "lucide-react-native";

type TopicIcon = ComponentType<{
	size?: number;
	color?: string;
	strokeWidth?: number;
}>;

const ICON_BY_TOPIC_ID: Record<string, TopicIcon> = {
	"1": BookOpen,
	"2": BookOpen,
	"3": BookOpen,
	"4": BookOpen,
	"5": TriangleAlert,
	"6": TriangleAlert,
	"7": TriangleAlert,
	"8": Route,
	"9": Route,
	"10": Gauge,
	"11": Route,
	"12": CircleParking,
	"13": Signpost,
	"14": Signpost,
	"15": Signpost,
	"16": Signpost,
	"17": Signpost,
	"18": Car,
	"19": Car,
	"20": Car,
	"21": Car,
	"22": Car,
	"23": Car,
	"24": BookOpen,
	"25": Route,
	"26": BookOpen,
	"27": BookOpen,
	"28": BookOpen,
	"29": Bike,
	"30": BookOpen,
	"31": TriangleAlert,
	"32": Flag,
	"33": Ban,
	"34": CircleCheck,
	"35": Flag,
	"36": Shield,
	"37": Bookmark,
	"38": Route,
	"39": Signpost,
	"40": Ban,
	"41": Shield,
	"42": Cross,
};

const ICON_BY_SLUG_KEYWORD: Array<{
	match: (slug: string) => boolean;
	icon: TopicIcon;
}> = [
	{ match: (slug) => slug.includes("attitude"), icon: CircleCheck },
	{ match: (slug) => slug.includes("video"), icon: Clapperboard },
	{ match: (slug) => slug.includes("safety"), icon: BookOpen },
	{ match: (slug) => slug.includes("sign"), icon: Flag },
	{ match: (slug) => slug.includes("rule"), icon: Bookmark },
];

export function getTopicIcon(slug: string): TopicIcon {
	const normalized = slug.trim().toLowerCase();
	const topicMatch = normalized.match(/^section-([a-z0-9-]+)$/);
	if (topicMatch) {
		const topicId = topicMatch[1];
		const byTopicId = ICON_BY_TOPIC_ID[topicId];
		if (byTopicId) return byTopicId;
	}

	const found = ICON_BY_SLUG_KEYWORD.find((item) => item.match(normalized));
	return found?.icon ?? CircleHelp;
}

const TOPIC_IMAGE_BY_ID: Record<string, ImageSourcePropType> = {
	"1": require("../../assets/images/topics/umumiy-qoidalar.png"),
	"2": require("../../assets/images/topics/haydovchilarning-umumiy-vazifalari.webp"),
	"3": require("../../assets/images/topics/piyodalarning-majburiyatlari.webp"),
	"4": require("../../assets/images/topics/imtiyoz belgilari.webp"),
	"5": require("../../assets/images/topics/svetofor-ishoralari.webp"),
	"6": require("../../assets/images/topics/tartibga-soluvchilarning-ishoralari.webp"),
	"7": require("../../assets/images/topics/ogohlantiruvchi-avariya.webp"),
	"8": require("../../assets/images/topics/harakatlanishni-boshlash.webp"),
	"9": require("../../assets/images/topics/yolning-qatnov-qismi.webp"),
	"10": require("../../assets/images/topics/harakatlanish-tezligi.webp"),
	"11": require("../../assets/images/topics/quvib-otish.png"),
	"12": require("../../assets/images/topics/toxtash-toxtab-turish.webp"),
	"13": require("../../assets/images/topics/chorrahlarda-harakatlanish.webp"),
	"14": require("../../assets/images/topics/tartibga-solingan-chorrahlar.webp"),
	"15": require("../../assets/images/topics/tartibga-solinmagan-chorrahalar.webp"),
	"16": require("../../assets/images/topics/tartibga-solinmagan-chorrahalar.webp"),
	"17": require("../../assets/images/topics/tartibga-solinmagan-chorrahalar.webp"),
	"18": require("../../assets/images/topics/piyoda-otish-joylari.webp"),
	"19": require("../../assets/images/topics/temiryol-kesishmasi.webp"),
	"20": require("../../assets/images/topics/automagistral.webp"),
	"21": require("../../assets/images/topics/umumiy-qoidalar.png"),
	"22": require("../../assets/images/topics/harkat-havfsizligi-asoslari.webp"),
	"23": require("../../assets/images/topics/yonalishli-transport-vositalarining-imtiyozlari.webp"),
	"24": require("../../assets/images/topics/tashqi-yoritish-asboblaridan-foydalanish.webp"),
	"25": require("../../assets/images/topics/shatakka-olish.webp"),
	"26": require("../../assets/images/topics/harakatlanishni-boshlash.webp"),
	"27": require("../../assets/images/topics/odam-tashish.webp"),
	"28": require("../../assets/images/topics/yuk-tashis.webp"),
	"29": require("../../assets/images/topics/veloseped.webp"),
	"30": require("../../assets/images/topics/fuqorolarning-majburiyatlari.png"),
	"31": require("../../assets/images/topics/ogohlantiruvchi-bilgilar.webp"),
	"32": require("../../assets/images/topics/imtiyoz belgilari.webp"),
	"33": require("../../assets/images/topics/taqiqlovchi-belgilar.webp"),
	"34": require("../../assets/images/topics/buyuruvchi-belgilar.png"),
	"35": require("../../assets/images/topics/ahborot-korsatgich-belgilar.webp"),
	"36": require("../../assets/images/topics/tartibni-savlovchi-belgilar.png"),
	"37": require("../../assets/images/topics/qoshimcha-axborot-belgilari.webp"),
	"38": require("../../assets/images/topics/yotiq-chiziqlar.webp"),
	"39": require("../../assets/images/topics/yotiq-chiziqlar.webp"),
	"40": require("../../assets/images/topics/transport-vositalaridan-foydalanishni-taqiqlovchi-belgilar.png"),
	"41": require("../../assets/images/topics/harkat-havfsizligi-asoslari.webp"),
	"42": require("../../assets/images/topics/berinchi tibbiy yordam.webp"),
};

const IMAGE_BY_KEY: Record<string, ImageSourcePropType> = {
	...TOPIC_IMAGE_BY_ID,
	books: TOPIC_IMAGE_BY_ID["1"],
	book: TOPIC_IMAGE_BY_ID["1"],
	video: TOPIC_IMAGE_BY_ID["8"],
	movies: TOPIC_IMAGE_BY_ID["41"],
	default: TOPIC_IMAGE_BY_ID["1"],
};

export function getTopicIllustration(imageKey?: string | null): ImageSourcePropType {
	const normalized = (imageKey ?? "").trim().toLowerCase();
	return IMAGE_BY_KEY[normalized] ?? IMAGE_BY_KEY.default;
}
