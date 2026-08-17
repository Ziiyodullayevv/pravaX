import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

import { axiosInstance, endpoints } from "@/lib/api";

export type PaymentPlan = "pro_monthly" | "pro_yearly";

export type PaymentStatus =
	| "initiated"
	| "awaiting"
	| "pending"
	| "approved"
	| "rejected";

export type Payment = {
	id: number;
	plan: PaymentPlan;
	amount_som: string;
	status: PaymentStatus;
	created_at: string;
	processed_at: string | null;
	rejection_reason: string;
};

export type InitiatePaymentResponse = {
	payment_id: number;
	plan: PaymentPlan;
	amount_som: string;
	deep_link: string;
	status: "initiated";
};

export type Subscription = {
	plan: string;
	is_pro: boolean;
	expires_at: string | null;
	plan_info: {
		price: number;
		monthly_tokens: number;
		daily_bonus: number;
	};
	daily_bonus_available: boolean;
};

export const subscriptionQueryKey = ["tokens", "subscription"] as const;

export const PENDING_PAYMENT_KEY = "pending_payment_id";

export async function initiatePayment(
	plan: PaymentPlan,
): Promise<InitiatePaymentResponse> {
	const response = await axiosInstance.post<InitiatePaymentResponse>(
		endpoints.payments.initiate,
		{ plan },
	);
	return response.data;
}

export async function getPaymentStatus(paymentId: number): Promise<Payment> {
	const response = await axiosInstance.get<Payment>(
		endpoints.payments.detail(paymentId),
	);
	return response.data;
}

export async function getMyPayments(): Promise<Payment[]> {
	const response = await axiosInstance.get<Payment[]>(endpoints.payments.my);
	return response.data;
}

export async function getSubscription(): Promise<Subscription> {
	const response = await axiosInstance.get<Subscription>(
		endpoints.tokens.subscription,
	);
	return response.data;
}

export function useSubscriptionQuery(enabled = true) {
	return useQuery({
		queryKey: subscriptionQueryKey,
		queryFn: getSubscription,
		enabled,
		staleTime: 60_000,
	});
}

export async function savePendingPaymentId(id: number): Promise<void> {
	await AsyncStorage.setItem(PENDING_PAYMENT_KEY, String(id));
}

export async function getPendingPaymentId(): Promise<number | null> {
	const value = await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
	if (!value) return null;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

export async function clearPendingPaymentId(): Promise<void> {
	await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
}
