from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from .permissions import IsAcademyAdmin, IsRealUser
from rest_framework.response import Response
from rest_framework.views import APIView

from tokens.models import TokenTransaction
from tokens.services import InsufficientBalanceError, TokenService

from .auth import AcademyJWTAuthentication, generate_academy_token
from .models import AcademyMembership, AcademyProfile, Contest, ContestAnswer, ContestParticipant
from .serializers import (
    AcademyDashboardSerializer,
    AcademyIncomeSerializer,
    AcademyJoinSerializer,
    AcademyLoginSerializer,
    AcademyMeSerializer,
    AcademyMemberSerializer,
    AcademySearchSerializer,
    ContestCreateSerializer,
    ContestDetailSerializer,
    ContestListSerializer,
    ContestRankingSerializer,
    ContestSubmitSerializer,
    MyContestSerializer,
)
from .services import get_contest_questions


# ═══════════════════════════════════════════════════════════════════════════════
#  Contest list / detail
# ═══════════════════════════════════════════════════════════════════════════════

class ContestListView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=['Contests'],
        summary='Contestlar ro\'yxati',
        parameters=[
            OpenApiParameter('status', str, enum=['upcoming', 'active', 'finished']),
            OpenApiParameter('type',   str, enum=['global', 'academy']),
        ],
        responses={200: ContestListSerializer(many=True)},
    )
    def get(self, request):
        qs = Contest.objects.all()
        s = request.query_params.get('status')
        t = request.query_params.get('type')
        if s:
            qs = qs.filter(status=s)
        if t:
            qs = qs.filter(contest_type=t)
        return Response(ContestListSerializer(qs, many=True, context={'request': request}).data)

    @extend_schema(
        tags=['Contests'],
        summary='Global contest yaratish',
        description='Faqat superadmin yaratadi. Academy contestlarni `/academy/contests/` orqali yaratiladi.',
        request=ContestCreateSerializer,
        responses={
            201: ContestDetailSerializer,
            403: OpenApiResponse(description='Ruxsat yo\'q.'),
        },
    )
    def post(self, request):
        if not request.user.is_superuser:
            return Response(
                {'detail': 'Faqat superadmin global contest yarata oladi.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ContestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Bu endpoint faqat global contestlar uchun
        contest = serializer.save(
            created_by=request.user,
            contest_type=Contest.Type.GLOBAL,
        )
        return Response(
            ContestDetailSerializer(contest, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ContestDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=['Contests'],
        summary='Contest tafsilotlari',
        responses={200: ContestDetailSerializer, 404: OpenApiResponse(description='Topilmadi.')},
    )
    def get(self, request, pk):
        try:
            contest = Contest.objects.get(pk=pk)
        except Contest.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ContestDetailSerializer(contest, context={'request': request}).data)


class ContestJoinView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Contests'],
        summary='Contestga qo\'shilish',
        description=(
            '**Global** — Pro/Free farqi yo\'q, faqat token yetarli bo\'lsa qo\'shiladi.\n\n'
            '**Academy** — foydalanuvchi shu akademiya a\'zosi bo\'lishi kerak '
            '(invite_code orqali avval `/academy/join/` qilib qo\'shilgan). '
            'Hech qanday qo\'shimcha kalit talab qilinmaydi.'
        ),
        request=None,
        responses={
            201: ContestDetailSerializer,
            400: OpenApiResponse(description='Allaqachon qo\'shilgan yoki contest faol emas.'),
            402: OpenApiResponse(description='Token yetarli emas.'),
            403: OpenApiResponse(description='Akademiya a\'zoligi yoki Pro talab qilinadi.'),
            404: OpenApiResponse(description='Topilmadi.'),
        },
    )
    def post(self, request, pk):
        try:
            contest = Contest.objects.get(pk=pk)
        except Contest.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        if contest.status not in (Contest.Status.UPCOMING, Contest.Status.ACTIVE):
            return Response({'detail': 'Contest qo\'shilish uchun mavjud emas.'}, status=status.HTTP_400_BAD_REQUEST)

        if ContestParticipant.objects.filter(contest=contest, user=request.user).exists():
            return Response({'detail': 'Siz allaqachon bu contestga qo\'shilgansiz.'}, status=status.HTTP_400_BAD_REQUEST)

        # Academy contest: foydalanuvchi shu akademiya a'zosi bo'lishi kerak
        if contest.contest_type == Contest.Type.ACADEMY:
            sub = getattr(request.user, 'subscription', None)
            if not sub or not sub.is_pro:
                return Response(
                    {'detail': 'Academy contestlariga faqat Pro tarifli foydalanuvchilar qo\'shila oladi.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if contest.academy_profile_id is None:
                return Response(
                    {'detail': 'Bu academy contesti hech qaysi akademiyaga bog\'lanmagan.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            is_member = AcademyMembership.objects.filter(
                user=request.user, academy_id=contest.academy_profile_id,
            ).exists()
            if not is_member:
                return Response(
                    {
                        'detail': 'Avval akademiyaga qo\'shiling. Akademiya invite_code ni '
                                  '/api/contests/academy/join/ orqali kiriting.',
                        'academy_id': contest.academy_profile_id,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            if contest.entry_token > 0:
                TokenService.spend(
                    request.user, contest.entry_token,
                    TokenTransaction.Reason.CONTEST_ENTRY,
                    contest_id=contest.id,
                )
        except InsufficientBalanceError as e:
            return Response({'detail': str(e)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        ContestParticipant.objects.create(
            contest=contest, user=request.user,
            token_spent=contest.entry_token,
        )
        return Response(
            ContestDetailSerializer(contest, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ContestQuestionsView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Contests'],
        summary='Contest savollari',
        responses={200: OpenApiResponse(description='Savollar ro\'yxati.')},
    )
    def get(self, request, pk):
        try:
            contest = Contest.objects.get(pk=pk)
        except Contest.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            participant = ContestParticipant.objects.get(contest=contest, user=request.user)
        except ContestParticipant.DoesNotExist:
            return Response({'detail': 'Siz bu contestga qo\'shilmagansiz.'}, status=status.HTTP_403_FORBIDDEN)

        if contest.status != Contest.Status.ACTIVE:
            return Response({'detail': 'Contest hali boshlanmagan yoki tugagan.'}, status=status.HTTP_400_BAD_REQUEST)

        if participant.is_submitted:
            return Response({'detail': 'Siz allaqachon javob yuborgansiz.'}, status=status.HTTP_400_BAD_REQUEST)

        from quiz.models import Question
        from quiz.serializers import QuestionSessionSerializer
        question_ids = get_contest_questions(contest)
        questions = (
            Question.objects.filter(id__in=question_ids, is_active=True)
            .prefetch_related('choices', 'media')
            .select_related('category')
        )
        return Response({
            'contest_id': contest.id,
            'time_limit': contest.time_limit,
            'end_time':   contest.end_time,
            'questions':  QuestionSessionSerializer(questions, many=True).data,
        })


class ContestSubmitView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Contests'],
        summary='Contest javoblarini yuborish',
        request=ContestSubmitSerializer,
        responses={
            200: OpenApiResponse(description='Natija.'),
            400: OpenApiResponse(description='Contest faol emas yoki allaqachon yuborilgan.'),
        },
    )
    def post(self, request, pk):
        try:
            contest = Contest.objects.get(pk=pk)
        except Contest.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        if contest.status != Contest.Status.ACTIVE:
            return Response({'detail': 'Contest faol emas.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            participant = ContestParticipant.objects.get(contest=contest, user=request.user)
        except ContestParticipant.DoesNotExist:
            return Response({'detail': 'Siz bu contestga qo\'shilmagansiz.'}, status=status.HTTP_403_FORBIDDEN)

        if participant.is_submitted:
            return Response({'detail': 'Javoblar allaqachon yuborilgan.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ContestSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        answers     = serializer.validated_data['answers']
        finished_at = serializer.validated_data.get('finished_at') or timezone.now()

        from quiz.models import Choice
        to_create = []
        correct = 0
        wrong   = 0
        for item in answers:
            try:
                choice = Choice.objects.get(pk=item['choice_id'], question_id=item['question_id'])
            except Choice.DoesNotExist:
                continue
            is_correct = choice.is_correct
            if is_correct:
                correct += 1
            else:
                wrong += 1
            to_create.append(ContestAnswer(
                participant=participant,
                question_id=item['question_id'],
                selected_choice=choice,
                is_correct=is_correct,
            ))

        ContestAnswer.objects.bulk_create(to_create, ignore_conflicts=True)

        duration = int((finished_at - participant.joined_at).total_seconds())
        participant.correct_count = correct
        participant.wrong_count   = wrong
        participant.finished_at   = finished_at
        participant.duration_secs = max(0, duration)
        participant.is_submitted  = True
        participant.save(update_fields=['correct_count', 'wrong_count', 'finished_at', 'duration_secs', 'is_submitted'])

        return Response({
            'correct':       correct,
            'wrong':         wrong,
            'total':         correct + wrong,
            'duration_secs': participant.duration_secs,
        })


class ContestRankingView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        tags=['Contests'],
        summary='Contest reytingi',
        responses={200: ContestRankingSerializer(many=True)},
    )
    def get(self, request, pk):
        try:
            contest = Contest.objects.get(pk=pk)
        except Contest.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        if contest.status == Contest.Status.FINISHED:
            participants = ContestParticipant.objects.filter(
                contest=contest, is_submitted=True
            ).select_related('user').order_by('rank', '-correct_count')
        else:
            from .services import compute_ranking
            participants = compute_ranking(contest.id)

        return Response(ContestRankingSerializer(participants, many=True).data)


class MyContestsView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Contests'],
        summary='Mening contestlarim',
        responses={200: MyContestSerializer(many=True)},
    )
    def get(self, request):
        entries = (
            ContestParticipant.objects
            .filter(user=request.user)
            .select_related('contest')
            .order_by('-joined_at')
        )
        return Response(MyContestSerializer(entries, many=True, context={'request': request}).data)


# ═══════════════════════════════════════════════════════════════════════════════
#  Academy — student (Pro user) tomonidan
# ═══════════════════════════════════════════════════════════════════════════════

class AcademySearchView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Academy'],
        summary='Akademiya nomi bo\'yicha izlash',
        parameters=[
            OpenApiParameter('name', str, required=True, description='Akademiya nomi (qisman)'),
        ],
        responses={200: AcademySearchSerializer(many=True)},
    )
    def get(self, request):
        name = request.query_params.get('name', '').strip()
        if not name:
            return Response({'detail': '`name` parametri talab qilinadi.'}, status=status.HTTP_400_BAD_REQUEST)
        academies = AcademyProfile.objects.filter(name__icontains=name, is_active=True)
        return Response(AcademySearchSerializer(academies, many=True, context={'request': request}).data)


class AcademyJoinView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Academy'],
        summary='Akademiyaga qo\'shilish (Pro user)',
        description='`invite_code` (PRAVA-2026-ABC123) orqali akademiyaga a\'zo bo\'lish.',
        request=AcademyJoinSerializer,
        responses={
            200: OpenApiResponse(description='Muvaffaqiyatli qo\'shildi.'),
            400: OpenApiResponse(description='Allaqachon a\'zo yoki kod noto\'g\'ri.'),
            403: OpenApiResponse(description='Pro talab qilinadi.'),
        },
    )
    def post(self, request):
        serializer = AcademyJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_code = serializer.validated_data['invite_code'].strip().upper()

        sub = getattr(request.user, 'subscription', None)
        if not sub or not sub.is_pro:
            return Response(
                {'detail': 'Akademiyaga faqat Pro tarifli foydalanuvchilar qo\'shila oladi.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 1 user → 1 akademiya cheklovi (revenue share to'g'ri ishlashi uchun)
        existing = (
            AcademyMembership.objects
            .filter(user=request.user)
            .select_related('academy')
            .first()
        )
        if existing:
            return Response(
                {
                    'detail': f'Siz allaqachon "{existing.academy.name}" akademiyasi a\'zosisiz. '
                              f'Bir vaqtning o\'zida faqat bitta akademiya a\'zosi bo\'lish mumkin.',
                    'current_academy_id':   existing.academy.id,
                    'current_academy_name': existing.academy.name,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            academy = AcademyProfile.objects.get(invite_code=invite_code, is_active=True)
        except AcademyProfile.DoesNotExist:
            return Response({'detail': 'Taklif kodi noto\'g\'ri.'}, status=status.HTTP_400_BAD_REQUEST)

        AcademyMembership.objects.create(user=request.user, academy=academy)

        # Joriy obuna uchun akademiyaga 30% revenue share qo'shamiz
        # (chunki user oldin Pro sotib olganda hali academy a'zoligi yo'q edi)
        from tokens.services import credit_academy_revenue
        credit_academy_revenue(academy, request.user, sub.plan)

        return Response({
            'detail': f'{academy.name} akademiyasiga muvaffaqiyatli qo\'shildingiz.',
            'academy_id':   academy.id,
            'academy_name': academy.name,
        })


# ═══════════════════════════════════════════════════════════════════════════════
#  Academy Admin — auth & dashboard
# ═══════════════════════════════════════════════════════════════════════════════

class AcademyLoginView(APIView):
    """Akademiya admin uchun username/password login."""
    permission_classes = (AllowAny,)
    authentication_classes: list = []

    @extend_schema(
        tags=['Academy Admin'],
        summary='Akademiya admin login',
        request=AcademyLoginSerializer,
        responses={
            200: OpenApiResponse(description='Token va profil ma\'lumotlari.'),
            401: OpenApiResponse(description='Login yoki parol noto\'g\'ri.'),
            403: OpenApiResponse(description='Akademiya faol emas.'),
        },
    )
    def post(self, request):
        serializer = AcademyLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        try:
            academy = AcademyProfile.objects.get(username=username)
        except AcademyProfile.DoesNotExist:
            return Response({'detail': 'Login yoki parol noto\'g\'ri.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not academy.check_password(password):
            return Response({'detail': 'Login yoki parol noto\'g\'ri.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not academy.is_active:
            return Response({'detail': 'Akademiya faoliyatdan to\'xtatilgan.'}, status=status.HTTP_403_FORBIDDEN)

        academy.last_login = timezone.now()
        academy.save(update_fields=['last_login'])

        return Response({
            'tokens':  generate_academy_token(academy),
            'academy': AcademyMeSerializer(academy).data,
        })


class AcademyMeView(APIView):
    """Joriy akademiya profili (auth tekshiruvi uchun ham)."""
    authentication_classes = (AcademyJWTAuthentication,)
    permission_classes     = (IsAcademyAdmin,)

    @extend_schema(
        tags=['Academy Admin'],
        summary='Joriy akademiya profili',
        responses={200: AcademyMeSerializer},
    )
    def get(self, request):
        return Response(AcademyMeSerializer(request.user).data)


class AcademyDashboardView(APIView):
    authentication_classes = (AcademyJWTAuthentication,)
    permission_classes     = (IsAcademyAdmin,)

    @extend_schema(
        tags=['Academy Admin'],
        summary='Dashboard',
        responses={200: AcademyDashboardSerializer},
    )
    def get(self, request):
        return Response(AcademyDashboardSerializer(request.user).data)


class AcademyStudentsView(APIView):
    authentication_classes = (AcademyJWTAuthentication,)
    permission_classes     = (IsAcademyAdmin,)

    @extend_schema(
        tags=['Academy Admin'],
        summary='O\'quvchilar ro\'yxati',
        responses={200: AcademyMemberSerializer(many=True)},
    )
    def get(self, request):
        members = (
            request.user.members
            .select_related('user', 'user__subscription')
            .order_by('-joined_at')
        )
        return Response(AcademyMemberSerializer(members, many=True).data)


class AcademyIncomeView(APIView):
    authentication_classes = (AcademyJWTAuthentication,)
    permission_classes     = (IsAcademyAdmin,)

    @extend_schema(
        tags=['Academy Admin'],
        summary='Daromad yozuvlari',
        responses={200: AcademyIncomeSerializer(many=True)},
    )
    def get(self, request):
        records = request.user.income_records.select_related('user').order_by('-created_at')
        return Response(AcademyIncomeSerializer(records, many=True).data)


# ═══════════════════════════════════════════════════════════════════════════════
#  Academy Admin — contests CRUD
# ═══════════════════════════════════════════════════════════════════════════════

class AcademyContestListCreateView(APIView):
    """Akademiya admin o'z contestlarini ko'radi va yaratadi."""
    authentication_classes = (AcademyJWTAuthentication,)
    permission_classes     = (IsAcademyAdmin,)

    @extend_schema(
        tags=['Academy Admin'],
        summary='Akademiya contestlari ro\'yxati',
        responses={200: ContestListSerializer(many=True)},
    )
    def get(self, request):
        contests = request.user.contests.all()
        return Response(ContestListSerializer(contests, many=True, context={'request': request}).data)

    @extend_schema(
        tags=['Academy Admin'],
        summary='Akademiya contesti yaratish',
        request=ContestCreateSerializer,
        responses={
            201: ContestDetailSerializer,
            400: OpenApiResponse(description='Validatsiya xatosi.'),
        },
    )
    def post(self, request):
        serializer = ContestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contest = serializer.save(
            contest_type=Contest.Type.ACADEMY,
            academy_profile=request.user,
            created_by=None,  # academy admin User emas
        )
        return Response(
            ContestDetailSerializer(contest, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class AcademyContestRankingView(APIView):
    """Akademiya admin o'z contesti reytingini ko'radi."""
    authentication_classes = (AcademyJWTAuthentication,)
    permission_classes     = (IsAcademyAdmin,)

    @extend_schema(
        tags=['Academy Admin'],
        summary='Akademiya contesti reytingi',
        responses={200: ContestRankingSerializer(many=True)},
    )
    def get(self, request, pk):
        try:
            contest = request.user.contests.get(pk=pk)
        except Contest.DoesNotExist:
            return Response({'detail': 'Topilmadi.'}, status=status.HTTP_404_NOT_FOUND)

        if contest.status == Contest.Status.FINISHED:
            participants = ContestParticipant.objects.filter(
                contest=contest, is_submitted=True
            ).select_related('user').order_by('rank', '-correct_count')
        else:
            from .services import compute_ranking
            participants = compute_ranking(contest.id)

        return Response(ContestRankingSerializer(participants, many=True).data)
