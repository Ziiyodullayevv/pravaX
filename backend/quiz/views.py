import random

from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from contests.permissions import IsRealUser
from rest_framework.response import Response
from rest_framework.views import APIView

from tokens.constants import (
    EXAM_COST, MARATHON_COSTS, MIXED_COST, PRACTICE_COST, category_cost,
)
from tokens.models import TokenTransaction
from tokens.services import InsufficientBalanceError, TokenService

from .models import CategoryProgress, Choice, ExamSession, Question, SavedQuestion, SessionQuestion, Category
from .serializers import (
    BulkSubmitSerializer,
    CategorySerializer,
    CategoryStatsSerializer,
    ExamSessionDetailSerializer,
    ExamSessionSerializer,
    MistakeItemSerializer,
    QuestionListSerializer,
    QuestionSessionSerializer,
    SavedQuestionSerializer,
    StartMarathonSerializer,
    StartPracticeSerializer,
    StartSessionSerializer,
)


class QuestionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CategoryListView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Kategoriyalar'],
        summary='Kategoriyalar ro\'yxati (stats bilan)',
        description='Har bir kategoriya uchun ko\'rilgan/ko\'rilmagan savollar soni va progress qaytariladi.',
    )
    def get(self, request):
        user = request.user

        # Faqat category rejimidagi oxirgi javoblar (CategoryProgress)
        progress_qs = CategoryProgress.objects.filter(user=user, question__is_active=True)

        viewed_map = {
            row['category_id']: row['cnt']
            for row in progress_qs.values('category_id').annotate(cnt=Count('id'))
        }
        correct_map = {
            row['category_id']: row['cnt']
            for row in progress_qs.filter(is_correct=True).values('category_id').annotate(cnt=Count('id'))
        }
        wrong_map = {
            row['category_id']: row['cnt']
            for row in progress_qs.filter(is_correct=False).values('category_id').annotate(cnt=Count('id'))
        }

        total_map = {
            row['category_id']: row['total']
            for row in Question.objects.filter(is_active=True)
            .values('category_id')
            .annotate(total=Count('id'))
        }

        categories = Category.objects.all()
        for cat in categories:
            cat.questions_count = total_map.get(cat.id, 0)
            cat.viewed_count    = viewed_map.get(cat.id, 0)
            cat.correct_count   = correct_map.get(cat.id, 0)
            cat.wrong_count     = wrong_map.get(cat.id, 0)

        total_questions = sum(total_map.values())
        total_viewed    = sum(viewed_map.values())

        return Response({
            'stats': {
                'sections_count': len(categories),
                'questions_count': total_questions,
                'viewed_count': total_viewed,
                'unviewed_count': total_questions - total_viewed,
            },
            'sections': CategoryStatsSerializer(categories, many=True).data,
        })


class QuestionListView(ListAPIView):
    serializer_class = QuestionListSerializer
    permission_classes = (IsAuthenticated,)   # academy admin ham ko'ra oladi
    pagination_class = QuestionPagination

    @extend_schema(
        tags=['Quiz — Savollar'],
        summary='Savollar ro\'yxati (sahifalash bilan)',
        parameters=[
            OpenApiParameter('category', int, description='Kategoriya ID'),
            OpenApiParameter('difficulty', str, enum=['easy', 'medium', 'hard']),
            OpenApiParameter('page', int, description='Sahifa raqami'),
            OpenApiParameter('page_size', int, description='Sahifadagi savollar soni (max 100, default 20)'),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = Question.objects.filter(is_active=True).select_related('category')
        category = self.request.query_params.get('category')
        difficulty = self.request.query_params.get('difficulty')
        if category:
            qs = qs.filter(category_id=category)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        return qs


class QuestionDetailView(APIView):
    permission_classes = (IsAuthenticated,)   # academy admin ham ko'ra oladi

    @extend_schema(
        tags=['Quiz — Savollar'],
        summary='Savol tafsilotlari',
        responses={
            200: QuestionSessionSerializer,
            404: OpenApiResponse(description='Savol topilmadi.'),
        },
    )
    def get(self, request, pk):
        try:
            question = (
                Question.objects.filter(is_active=True)
                .select_related('category')
                .prefetch_related('choices', 'media')
                .get(pk=pk)
            )
        except Question.DoesNotExist:
            return Response({'detail': 'Savol topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(QuestionSessionSerializer(question).data)


class ExamSessionListCreateView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Sessiyalar'],
        summary='Mening sessiyalarim',
        responses={200: ExamSessionSerializer(many=True)},
    )
    def get(self, request):
        sessions = ExamSession.objects.filter(user=request.user)
        return Response(ExamSessionSerializer(sessions, many=True).data)

    @extend_schema(
        tags=['Quiz — Sessiyalar'],
        summary='Yangi imtihon sessiyasini boshlash',
        description=(
            'Tasodifiy savollar tanlanadi va yangi sessiya yaratiladi. '
            '`category_id` berilsa faqat o\'sha kategoriyadan savollar olinadi.'
        ),
        request=StartSessionSerializer,
        responses={
            201: ExamSessionDetailSerializer,
            400: OpenApiResponse(description='Yetarli savol yo\'q.'),
        },
    )
    def post(self, request):
        serializer = StartSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        category_id = serializer.validated_data['category_id']

        question_ids = list(
            Question.objects.filter(is_active=True, category_id=category_id)
            .values_list('id', flat=True)
        )

        if not question_ids:
            return Response(
                {'detail': 'Bu kategoriyada faol savollar yo\'q.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cost = category_cost(len(question_ids))
        try:
            TokenService.spend(request.user, cost, TokenTransaction.Reason.CATEGORY_SPEND)
        except InsufficientBalanceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        session = ExamSession.objects.create(
            user=request.user,
            category_id=category_id,
            total_questions=len(question_ids),
            tokens_spent=cost,
        )

        SessionQuestion.objects.bulk_create([
            SessionQuestion(session=session, question_id=qid, order=idx)
            for idx, qid in enumerate(question_ids)
        ])

        return Response(
            ExamSessionDetailSerializer(session, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ExamSessionDetailView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Sessiyalar'],
        summary='Sessiya tafsilotlari',
        responses={
            200: ExamSessionDetailSerializer,
            404: OpenApiResponse(description='Sessiya topilmadi.'),
        },
    )
    def get(self, request, pk):
        session = self._get_session(request, pk)
        if session is None:
            return Response({'detail': 'Sessiya topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExamSessionDetailSerializer(session, context={'request': request}).data)

    @staticmethod
    def _get_session(request, pk):
        try:
            return ExamSession.objects.get(pk=pk, user=request.user)
        except ExamSession.DoesNotExist:
            return None


class SubmitSessionView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Sessiyalar'],
        summary='Imtihonni yakunlash (bulk)',
        description='Barcha javoblarni bir so\'rovda yuboradi, natija qaytariladi.',
        request=BulkSubmitSerializer,
        responses={
            200: ExamSessionDetailSerializer,
            400: OpenApiResponse(description='Sessiya in_progress emas yoki xato ma\'lumot.'),
            404: OpenApiResponse(description='Sessiya topilmadi.'),
        },
    )
    def post(self, request, pk):
        try:
            session = ExamSession.objects.get(pk=pk, user=request.user)
        except ExamSession.DoesNotExist:
            return Response({'detail': 'Sessiya topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        if session.status != ExamSession.Status.IN_PROGRESS:
            return Response(
                {'detail': 'Sessiya allaqachon yakunlangan yoki tashlab ketilgan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BulkSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        answers = serializer.validated_data['answers']
        finished_at = serializer.validated_data.get('finished_at') or timezone.now()

        sq_map = {
            sq.question_id: sq
            for sq in SessionQuestion.objects.filter(session=session)
        }

        to_update = []
        for item in answers:
            sq = sq_map.get(item['question_id'])
            if sq is None:
                continue
            sq.selected_choice_id = item['choice_id']
            sq.is_correct = item['status']
            sq.answered_at = finished_at
            to_update.append(sq)

        SessionQuestion.objects.bulk_update(
            to_update, ['selected_choice_id', 'is_correct', 'answered_at']
        )

        score = sum(1 for sq in to_update if sq.is_correct)
        session.score = score
        session.status = ExamSession.Status.COMPLETED
        session.finished_at = finished_at
        session.save(update_fields=['score', 'status', 'finished_at'])

        # Faqat category rejimida: oxirgi javobni upsert qilish
        if session.mode == ExamSession.Mode.CATEGORY:
            entries = [
                CategoryProgress(
                    user_id=session.user_id,
                    question_id=sq.question_id,
                    category_id=session.category_id,
                    is_correct=sq.is_correct,
                    answered_at=finished_at,
                )
                for sq in to_update
                if sq.is_correct is not None
            ]
            if entries:
                CategoryProgress.objects.bulk_create(
                    entries,
                    update_conflicts=True,
                    unique_fields=['user', 'question'],
                    update_fields=['is_correct', 'answered_at'],
                )

        TokenService.apply_session_result(session)

        return Response(ExamSessionDetailSerializer(session, context={'request': request}).data)


class StartTestView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Test'],
        summary='Test sessiyasini boshlash',
        description=(
            f'Barcha faol savollardan tasodifiy {ExamSession.TEST_QUESTION_COUNT} ta tanlab '
            f'{ExamSession.TEST_TIME_LIMIT} daqiqalik test sessiyasi yaratadi. '
            'Savollar frontendda tekshiriladi, natija `submit/` orqali saqlanadi.'
        ),
        request=None,
        responses={
            201: ExamSessionDetailSerializer,
            400: OpenApiResponse(description='Yetarli savol yo\'q.'),
        },
    )
    def post(self, request):
        count = ExamSession.TEST_QUESTION_COUNT
        question_ids = list(
            Question.objects.filter(is_active=True).values_list('id', flat=True)
        )

        if len(question_ids) < count:
            return Response(
                {'detail': f'Bazada {count} tadan kam faol savol bor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        chosen = random.sample(question_ids, count)

        try:
            TokenService.spend(request.user, EXAM_COST, TokenTransaction.Reason.EXAM_SPEND)
        except InsufficientBalanceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        session = ExamSession.objects.create(
            user=request.user,
            mode=ExamSession.Mode.TEST,
            time_limit_minutes=ExamSession.TEST_TIME_LIMIT,
            total_questions=count,
            tokens_spent=EXAM_COST,
        )

        SessionQuestion.objects.bulk_create([
            SessionQuestion(session=session, question_id=qid, order=idx)
            for idx, qid in enumerate(chosen)
        ])

        return Response(
            ExamSessionDetailSerializer(session, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=['Quiz — Sessiyalar'])
class AbandonSessionView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Sessiyalar'],
        summary='Imtihondan chiqish',
        description='Sessiyani abandoned holatga o\'tkazadi.',
        responses={
            200: ExamSessionSerializer,
            400: OpenApiResponse(description='Sessiya allaqachon yakunlangan.'),
            404: OpenApiResponse(description='Sessiya topilmadi.'),
        },
    )
    def post(self, request, pk):
        try:
            session = ExamSession.objects.get(pk=pk, user=request.user)
        except ExamSession.DoesNotExist:
            return Response({'detail': 'Sessiya topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        if session.status != ExamSession.Status.IN_PROGRESS:
            return Response(
                {'detail': 'Sessiya allaqachon yakunlangan yoki tashlab ketilgan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = ExamSession.Status.ABANDONED
        session.finished_at = timezone.now()
        session.save(update_fields=['status', 'finished_at'])

        return Response(ExamSessionSerializer(session).data)


class StartPracticeView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Practice'],
        summary='Mashq sessiyasini boshlash',
        description=(
            'Tasodifiy savollar bilan mashq sessiyasi yaratadi.\n\n'
            '**Ruxsat etilgan savollar soni:** 10 / 20 / 50 / 100 / 150\n\n'
            '**Vaqt:** 1 daqiqa × savollar soni'
        ),
        request=StartPracticeSerializer,
        responses={
            201: ExamSessionDetailSerializer,
            400: OpenApiResponse(description='Yetarli savol yo\'q.'),
        },
    )
    def post(self, request):
        serializer = StartPracticeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = serializer.validated_data['count']

        question_ids = list(
            Question.objects.filter(is_active=True).values_list('id', flat=True)
        )

        if len(question_ids) < count:
            return Response(
                {'detail': f'Bazada {count} tadan kam faol savol bor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        chosen = random.sample(question_ids, count)

        try:
            TokenService.spend(request.user, PRACTICE_COST, TokenTransaction.Reason.PRACTICE_SPEND)
        except InsufficientBalanceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        session = ExamSession.objects.create(
            user=request.user,
            mode=ExamSession.Mode.PRACTICE,
            time_limit_minutes=count,
            total_questions=count,
            tokens_spent=PRACTICE_COST,
        )

        SessionQuestion.objects.bulk_create([
            SessionQuestion(session=session, question_id=qid, order=idx)
            for idx, qid in enumerate(chosen)
        ])

        return Response(
            ExamSessionDetailSerializer(session, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class StartMixedView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Aralash test'],
        summary='Aralash test boshlash',
        description='Barcha faol savollardan tasodifiy 10 ta tanlab aralash test yaratadi. Narxi: 10 token.',
        request=None,
        responses={
            201: ExamSessionDetailSerializer,
            400: OpenApiResponse(description='Yetarli savol yo\'q.'),
            402: OpenApiResponse(description='Token yetarli emas.'),
        },
    )
    def post(self, request):
        count = 10
        question_ids = list(Question.objects.filter(is_active=True).values_list('id', flat=True))
        if len(question_ids) < count:
            return Response({'detail': f'Bazada {count} tadan kam faol savol bor.'}, status=status.HTTP_400_BAD_REQUEST)

        chosen = random.sample(question_ids, count)
        try:
            TokenService.spend(request.user, MIXED_COST, TokenTransaction.Reason.MIXED_SPEND)
        except InsufficientBalanceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        session = ExamSession.objects.create(
            user=request.user,
            mode=ExamSession.Mode.MIXED,
            time_limit_minutes=10,
            total_questions=count,
            tokens_spent=MIXED_COST,
        )
        SessionQuestion.objects.bulk_create([
            SessionQuestion(session=session, question_id=qid, order=idx)
            for idx, qid in enumerate(chosen)
        ])
        return Response(ExamSessionDetailSerializer(session, context={'request': request}).data, status=status.HTTP_201_CREATED)


class StartMarathonView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Marafon'],
        summary='Marafon boshlash',
        description='50 → 40 token | 100 → 70 token | 150 → 90 token',
        request=StartMarathonSerializer,
        responses={
            201: ExamSessionDetailSerializer,
            400: OpenApiResponse(description='Yetarli savol yo\'q yoki noto\'g\'ri son.'),
            402: OpenApiResponse(description='Token yetarli emas.'),
        },
    )
    def post(self, request):
        serializer = StartMarathonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = serializer.validated_data['count']

        cost = MARATHON_COSTS[count]
        question_ids = list(Question.objects.filter(is_active=True).values_list('id', flat=True))
        if len(question_ids) < count:
            return Response({'detail': f'Bazada {count} tadan kam faol savol bor.'}, status=status.HTTP_400_BAD_REQUEST)

        chosen = random.sample(question_ids, count)
        try:
            TokenService.spend(request.user, cost, TokenTransaction.Reason.MARATHON_SPEND)
        except InsufficientBalanceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        session = ExamSession.objects.create(
            user=request.user,
            mode=ExamSession.Mode.MARATHON,
            time_limit_minutes=count,
            total_questions=count,
            tokens_spent=cost,
        )
        SessionQuestion.objects.bulk_create([
            SessionQuestion(session=session, question_id=qid, order=idx)
            for idx, qid in enumerate(chosen)
        ])
        return Response(ExamSessionDetailSerializer(session, context={'request': request}).data, status=status.HTTP_201_CREATED)


class SavedQuestionView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Saqlangan savollar'],
        summary='Saqlangan savollar ro\'yxati',
        responses={200: SavedQuestionSerializer(many=True)},
    )
    def get(self, request):
        saved = (
            SavedQuestion.objects.filter(user=request.user)
            .select_related('question', 'question__category')
            .prefetch_related('question__choices', 'question__media')
        )
        paginator = QuestionPagination()
        page = paginator.paginate_queryset(saved, request)
        return paginator.get_paginated_response(SavedQuestionSerializer(page, many=True).data)

    @extend_schema(
        tags=['Quiz — Saqlangan savollar'],
        summary='Savolni saqlash',
        request=inline_serializer('SaveRequest', {'question_id': rf_serializers.IntegerField()}),
        responses={
            201: SavedQuestionSerializer,
            400: OpenApiResponse(description='Savol allaqachon saqlangan.'),
            404: OpenApiResponse(description='Savol topilmadi.'),
        },
    )
    def post(self, request):
        question_id = request.data.get('question_id')
        try:
            question = Question.objects.get(pk=question_id, is_active=True)
        except Question.DoesNotExist:
            return Response({'detail': 'Savol topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        saved, created = SavedQuestion.objects.get_or_create(user=request.user, question=question)
        if not created:
            return Response({'detail': 'Savol allaqachon saqlangan.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SavedQuestionSerializer(saved).data, status=status.HTTP_201_CREATED)


class SavedQuestionDeleteView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Saqlangan savollar'],
        summary='Saqlangandan o\'chirish',
        responses={
            204: OpenApiResponse(description='O\'chirildi.'),
            404: OpenApiResponse(description='Topilmadi.'),
        },
    )
    def delete(self, request, question_id):
        deleted, _ = SavedQuestion.objects.filter(
            user=request.user, question_id=question_id
        ).delete()
        if not deleted:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MistakeListView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Quiz — Xatolar'],
        summary='Xato javob berilgan savollar',
        description=(
            'Foydalanuvchi barcha sessiyalarda xato javob bergan savollarni qaytaradi. '
            'Har bir savol necha marta xato qilinganligi bilan birga keladi. '
            '`?category=<id>` orqali kategoriya bo\'yicha filtrlash mumkin.'
        ),
        parameters=[
            OpenApiParameter('category', int, description='Kategoriya ID bo\'yicha filter'),
        ],
        responses={200: MistakeItemSerializer(many=True)},
    )
    def get(self, request):
        # Faqat category rejimidagi xatolar (oxirgi javob xato bo'lgan savollar)
        qs = CategoryProgress.objects.filter(
            user=request.user,
            is_correct=False,
            question__is_active=True,
        ).order_by('-answered_at')

        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)

        question_ids = list(qs.values_list('question_id', flat=True))

        if not question_ids:
            return Response([])

        questions = (
            Question.objects
            .filter(id__in=question_ids, is_active=True)
            .select_related('category')
            .prefetch_related('choices', 'media')
        )
        q_map = {q.id: q for q in questions}

        result = []
        for qid in question_ids:
            q = q_map.get(qid)
            if q is None:
                continue
            correct = next((c for c in q.choices.all() if c.is_correct), None)
            result.append({'wrong_count': 1, 'question': q, 'correct_choice': correct})

        paginator = QuestionPagination()
        page = paginator.paginate_queryset(result, request)
        return paginator.get_paginated_response(MistakeItemSerializer(page, many=True).data)
