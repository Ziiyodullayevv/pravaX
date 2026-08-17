from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sign, SignSection
from .serializers import SignDetailSerializer, SignListSerializer, SignSectionListSerializer


class SignSectionListView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Yo\'l belgilari'],
        summary='Barcha bo\'limlar',
        description='Har bir bo\'lim nomi, tartibi va nechta belgi borligini qaytaradi.',
        responses={200: SignSectionListSerializer(many=True)},
    )
    def get(self, request):
        sections = SignSection.objects.prefetch_related('signs').all()
        return Response(SignSectionListSerializer(sections, many=True).data)


class SignListView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Yo\'l belgilari'],
        summary='Bo\'limdagi belgilar',
        responses={
            200: SignListSerializer(many=True),
            404: OpenApiResponse(description='Bo\'lim topilmadi.'),
        },
    )
    def get(self, request, section_id):
        try:
            section = SignSection.objects.get(pk=section_id)
        except SignSection.DoesNotExist:
            return Response({'detail': 'Bo\'lim topilmadi.'}, status=404)

        signs = section.signs.all()
        return Response({
            'section': SignSectionListSerializer(section).data,
            'signs':   SignListSerializer(signs, many=True, context={'request': request}).data,
        })


class SignDetailView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Yo\'l belgilari'],
        summary='Bitta belgi haqida to\'liq ma\'lumot',
        responses={
            200: SignDetailSerializer,
            404: OpenApiResponse(description='Belgi topilmadi.'),
        },
    )
    def get(self, request, pk):
        try:
            sign = Sign.objects.select_related('section').get(pk=pk)
        except Sign.DoesNotExist:
            return Response({'detail': 'Belgi topilmadi.'}, status=404)

        return Response(SignDetailSerializer(sign, context={'request': request}).data)
