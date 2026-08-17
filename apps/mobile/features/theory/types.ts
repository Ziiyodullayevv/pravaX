export type TestMode =
	| "topic_practice"
	| "mock_exam"
	| "marathon"
	| "mistakes_practice";

export type MistakeQuestionPack = {
	id: string;
	totalQuestions: number;
	questionIds: string[];
};

export type MistakeQuestionPacksOverview = {
	totalWrongQuestions: number;
	packs: MistakeQuestionPack[];
};

export type TestSettings = {
	autoAdvance: boolean;
};

export type TheorySummary = {
	totalTopics: number;
	totalQuestions: number;
	seenQuestions: number;
	notSeenQuestions: number;
	progressPercent: number;
};

export type TheoryTopic = {
	id: string;
	slug: string;
	title: string;
	subtitle: string;
	order: number;
	imageKey: string | null;
	totalQuestions: number;
	timeLimitMinutes: number | null;
	tokenCost: number;
	seenQuestions: number;
	answeredQuestions: number;
	correctCount: number;
	incorrectCount: number;
	completed: boolean;
	progressPercent: number;
};

export type TheoryOverview = {
	summary: TheorySummary;
	topics: TheoryTopic[];
};

export type TheoryTopicDetail = {
	topic: TheoryTopic;
};

export type SessionQuestionOption = {
	id: string;
	label: string;
	text: string;
	isCorrect: boolean;
	order: number;
};

export type SessionQuestion = {
	sessionQuestionId: string;
	questionId: string;
	position: number;
	prompt: string;
	imageUrl: string | null;
	explanation: string | null;
	options: SessionQuestionOption[];
	selectedOptionId: string | null;
	isCorrect: boolean | null;
	answeredAt: string | null;
};

export type TheorySession = {
	id: string;
	userId: string;
	topicId: string | null;
	topicSlug: string | null;
	topicTitle: string | null;
	mode: TestMode;
	totalQuestions: number;
	timeLimitMinutes?: number | null;
	settings: TestSettings;
	startedAt: string;
	finishedAt: string | null;
	scoreCorrect: number;
	scoreIncorrect: number;
	questions: SessionQuestion[];
	percentage?: number;
	isPassed?: boolean;
};
