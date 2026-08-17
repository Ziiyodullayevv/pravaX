from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated  # noqa: F401  (kept for compat)

from contests.permissions import IsRealUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TokenTransaction
from .serializers import SubscriptionSerializer, TransactionSerializer, WalletSerializer
from .services import SubscriptionService, TokenService


class WalletView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Tokens'],
        summary='Token balansi',
        description='Joriy balans va so\'nggi 10 tranzaksiya.',
        responses={200: WalletSerializer},
    )
    def get(self, request):
        wallet = TokenService.get_or_create_wallet(request.user)
        return Response(WalletSerializer(wallet).data)


class TransactionHistoryView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Tokens'],
        summary='Tranzaksiyalar tarixi',
        responses={200: TransactionSerializer(many=True)},
    )
    def get(self, request):
        wallet = TokenService.get_or_create_wallet(request.user)
        paginator = PageNumberPagination()
        paginator.page_size = 20
        txs = wallet.transactions.all()
        page = paginator.paginate_queryset(txs, request)
        return paginator.get_paginated_response(TransactionSerializer(page, many=True).data)


class SubscriptionView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Subscription'],
        summary='Joriy obuna holati',
        responses={200: SubscriptionSerializer},
    )
    def get(self, request):
        sub = SubscriptionService.get_or_create(request.user)
        return Response(SubscriptionSerializer(sub).data)


class SubscribePlanView(APIView):
    """Faqat Free planga o'tish (downgrade) uchun. Pro planlarni faqat to'lov orqali."""
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Subscription'],
        summary='Free planga o\'tish (downgrade)',
        description=(
            'Faqat `plan: "free"` qabul qilinadi. Pro planlar uchun '
            '`POST /api/payments/initiate/` orqali to\'lov yuboring va admin tasdiqlasin.'
        ),
        request=inline_serializer('SubscribeInput', {'plan': rf_serializers.CharField()}),
        responses={
            200: SubscriptionSerializer,
            400: OpenApiResponse(description='Noto\'g\'ri plan yoki Pro planga to\'lovsiz urinish.'),
        },
    )
    def post(self, request):
        plan = request.data.get('plan', '')
        if plan in ('pro_monthly', 'pro_yearly'):
            return Response(
                {'detail': 'Pro tarifga to\'lov orqali o\'tiladi. /api/payments/initiate/ chaqiring.'},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        if plan != 'free':
            return Response({'detail': 'Noto\'g\'ri plan.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            sub = SubscriptionService.subscribe(request.user, plan)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SubscriptionSerializer(sub).data)


class DailyBonusView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Subscription'],
        summary='Kunlik bonus olish',
        responses={
            200: inline_serializer('DailyBonusResponse', {
                'bonus':   rf_serializers.IntegerField(),
                'balance': rf_serializers.IntegerField(),
                'detail':  rf_serializers.CharField(),
            }),
        },
    )
    def post(self, request):
        bonus = SubscriptionService.claim_daily_bonus(request.user)
        balance = TokenService.get_balance(request.user)
        if bonus == 0:
            return Response({'bonus': 0, 'balance': balance, 'detail': 'Bugun allaqachon bonus oldingan.'})
        return Response({'bonus': bonus, 'balance': balance, 'detail': f'+{bonus} token qo\'shildi.'})
