from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated  # noqa: F401
from rest_framework.response import Response
from rest_framework.views import APIView

from contests.permissions import IsRealUser

from .models import Payment
from .serializers import (
    MyPaymentSerializer,
    PaymentInitiateResponseSerializer,
    PaymentInitiateSerializer,
)
from .services import create_payment, get_deep_link


class PaymentInitiateView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Payments'],
        summary='To\'lov yaratish va deep-link olish',
        description=(
            'App Pro tarif tanlanganda chaqiradi. Backend Payment yozuvi yaratadi '
            'va `https://t.me/<bot>?start=<token>` qaytaradi. User shu link orqali '
            'botga o\'tib to\'lov chekini yuboradi.'
        ),
        request=PaymentInitiateSerializer,
        responses={
            201: PaymentInitiateResponseSerializer,
            400: OpenApiResponse(description='Noto\'g\'ri plan.'),
        },
    )
    def post(self, request):
        serializer = PaymentInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = create_payment(request.user, serializer.validated_data['plan'])
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'payment_id': payment.id,
            'plan':       payment.plan,
            'amount_som': payment.amount_som,
            'deep_link':  get_deep_link(payment),
            'status':     payment.status,
        }, status=status.HTTP_201_CREATED)


class MyPaymentsView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Payments'],
        summary='Mening to\'lovlarim',
        responses={200: MyPaymentSerializer(many=True)},
    )
    def get(self, request):
        payments = Payment.objects.filter(user=request.user).order_by('-created_at')
        return Response(MyPaymentSerializer(payments, many=True).data)


class PaymentStatusView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Payments'],
        summary='To\'lov holati (polling uchun)',
        responses={200: MyPaymentSerializer, 404: OpenApiResponse(description='Topilmadi.')},
    )
    def get(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk, user=request.user)
        except Payment.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MyPaymentSerializer(payment).data)
