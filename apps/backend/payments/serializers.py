from rest_framework import serializers

from .models import Payment


class PaymentInitiateSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=Payment.Plan.choices)


class PaymentInitiateResponseSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField()
    plan       = serializers.CharField()
    amount_som = serializers.DecimalField(max_digits=10, decimal_places=2)
    deep_link  = serializers.URLField()
    status     = serializers.CharField()


class MyPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = [
            'id', 'plan', 'amount_som', 'status',
            'created_at', 'processed_at', 'rejection_reason',
        ]
        read_only_fields = fields
