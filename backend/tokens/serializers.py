from rest_framework import serializers

from .constants import PLAN_CONFIG
from .models import TokenTransaction, TokenWallet, UserSubscription


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TokenTransaction
        fields = ['id', 'amount', 'balance_after', 'reason', 'session_id', 'contest_id', 'created_at']


class WalletSerializer(serializers.ModelSerializer):
    recent_transactions = serializers.SerializerMethodField()

    class Meta:
        model  = TokenWallet
        fields = ['balance', 'updated_at', 'recent_transactions']

    def get_recent_transactions(self, obj):
        return TransactionSerializer(obj.transactions.all()[:10], many=True).data


class SubscriptionSerializer(serializers.ModelSerializer):
    is_pro                = serializers.BooleanField(read_only=True)
    plan_info             = serializers.SerializerMethodField()
    daily_bonus_available = serializers.SerializerMethodField()

    class Meta:
        model  = UserSubscription
        fields = [
            'plan', 'is_pro', 'expires_at',
            'last_daily_bonus_at', 'last_monthly_grant_at',
            'plan_info', 'daily_bonus_available',
            'created_at', 'updated_at',
        ]

    def get_plan_info(self, obj):
        plan_key = obj.plan if (obj.plan == 'free' or obj.is_pro) else 'free'
        return PLAN_CONFIG.get(plan_key, {})

    def get_daily_bonus_available(self, obj):
        from django.utils import timezone
        return obj.last_daily_bonus_at != timezone.now().date()
