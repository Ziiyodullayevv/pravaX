from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from users.serializers import UserSerializer

from .models import AcademyIncomeRecord, AcademyMembership, AcademyProfile, Contest, ContestParticipant


def _is_real_user(user):
    """request.user haqiqiy User instansiyasimi (academy admin emas)."""
    return user is not None and hasattr(user, 'is_authenticated') and user.is_authenticated \
        and not getattr(user, 'is_academy', False)


class ContestListSerializer(serializers.ModelSerializer):
    is_joined          = serializers.SerializerMethodField()
    participants_count = serializers.IntegerField(source='participants.count', read_only=True)
    time_remaining     = serializers.SerializerMethodField()

    class Meta:
        model  = Contest
        fields = [
            'id', 'title', 'description', 'contest_type', 'recurrence', 'status',
            'start_time', 'end_time', 'entry_token', 'question_count',
            'time_limit', 'participants_count', 'is_joined', 'time_remaining',
        ]

    def get_is_joined(self, obj):
        user = self.context['request'].user
        if not _is_real_user(user):
            return False
        return obj.participants.filter(user=user).exists()

    def get_time_remaining(self, obj):
        now = timezone.now()
        if obj.status == Contest.Status.UPCOMING:
            return max(0, int((obj.start_time - now).total_seconds()))
        if obj.status == Contest.Status.ACTIVE:
            return max(0, int((obj.end_time - now).total_seconds()))
        return 0


class ContestDetailSerializer(ContestListSerializer):
    """`access_key` field'i olib tashlandi — endi academy contestga qo'shilish uchun
    foydalanuvchi shu akademiya a'zosi bo'lishi kifoya, kalit kerak emas."""

    class Meta(ContestListSerializer.Meta):
        fields = ContestListSerializer.Meta.fields + ['question_source', 'created_at']


class ContestRankingSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model  = ContestParticipant
        fields = ['rank', 'user', 'correct_count', 'wrong_count', 'duration_secs', 'finished_at']


class MyContestSerializer(serializers.ModelSerializer):
    contest = ContestListSerializer(read_only=True)

    class Meta:
        model  = ContestParticipant
        fields = ['contest', 'correct_count', 'wrong_count', 'rank', 'is_submitted', 'joined_at']


class ContestAnswerSubmitSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    choice_id   = serializers.IntegerField()


class ContestSubmitSerializer(serializers.Serializer):
    answers     = ContestAnswerSubmitSerializer(many=True)
    finished_at = serializers.DateTimeField(required=False)


# ─── Academy Contest (search result) ─────────────────────────────────────────

class AcademyContestSerializer(serializers.ModelSerializer):
    is_joined      = serializers.SerializerMethodField()
    time_remaining = serializers.SerializerMethodField()

    class Meta:
        model  = Contest
        fields = [
            'id', 'title', 'description', 'status',
            'start_time', 'end_time', 'entry_token',
            'question_count', 'time_limit', 'is_joined', 'time_remaining',
        ]

    def get_is_joined(self, obj):
        user = self.context['request'].user
        if not _is_real_user(user):
            return False
        return obj.participants.filter(user=user).exists()

    def get_time_remaining(self, obj):
        now = timezone.now()
        if obj.status == Contest.Status.UPCOMING:
            return max(0, int((obj.start_time - now).total_seconds()))
        if obj.status == Contest.Status.ACTIVE:
            return max(0, int((obj.end_time - now).total_seconds()))
        return 0


class AcademySearchSerializer(serializers.ModelSerializer):
    contests  = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()

    class Meta:
        model  = AcademyProfile
        fields = ['id', 'name', 'is_member', 'contests']

    def get_is_member(self, obj):
        user = self.context['request'].user
        if not _is_real_user(user):
            return False
        return obj.members.filter(user=user).exists()

    def get_contests(self, obj):
        active = obj.contests.filter(
            status__in=[Contest.Status.UPCOMING, Contest.Status.ACTIVE]
        ).order_by('start_time')
        return AcademyContestSerializer(active, many=True, context=self.context).data


# ─── Academy join (student) ──────────────────────────────────────────────────

class AcademyJoinSerializer(serializers.Serializer):
    invite_code = serializers.CharField(
        max_length=20,
        help_text='Akademiya invite kodi (masalan: PRAVA-2026-ABC123)',
    )


# ─── Academy Admin Auth ──────────────────────────────────────────────────────

class AcademyLoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=64)
    password = serializers.CharField(max_length=128, write_only=True)


class AcademyMeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AcademyProfile
        fields = [
            'id', 'username', 'fullname', 'email',
            'name', 'phone', 'invite_code', 'balance',
            'is_active', 'last_login', 'created_at',
        ]
        read_only_fields = fields


# ─── Academy Dashboard (admin) ────────────────────────────────────────────────

class AcademyMemberSerializer(serializers.ModelSerializer):
    user      = UserSerializer(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model  = AcademyMembership
        fields = ['id', 'user', 'joined_at', 'is_active']


class AcademyIncomeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model  = AcademyIncomeRecord
        fields = ['id', 'user', 'plan', 'amount_som', 'created_at']


class AcademyDashboardSerializer(serializers.ModelSerializer):
    invite_code     = serializers.CharField(read_only=True)
    balance         = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    active_members  = serializers.SerializerMethodField()
    total_members   = serializers.SerializerMethodField()
    total_income    = serializers.SerializerMethodField()
    contest_count   = serializers.SerializerMethodField()
    recent_income   = serializers.SerializerMethodField()

    class Meta:
        model  = AcademyProfile
        fields = [
            'id', 'name', 'phone', 'invite_code', 'balance', 'is_active',
            'active_members', 'total_members', 'total_income',
            'contest_count', 'recent_income',
        ]

    def get_active_members(self, obj):
        return sum(1 for m in obj.members.select_related('user__subscription').all() if m.is_active)

    def get_total_members(self, obj):
        return obj.members.count()

    def get_total_income(self, obj):
        result = obj.income_records.aggregate(total=Sum('amount_som'))
        return result['total'] or 0

    def get_contest_count(self, obj):
        return obj.contests.count()

    def get_recent_income(self, obj):
        records = obj.income_records.select_related('user')[:10]
        return AcademyIncomeSerializer(records, many=True).data


# ─── Contest Create ───────────────────────────────────────────────────────────

class ContestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Contest
        fields = [
            'title', 'description', 'contest_type', 'recurrence',
            'start_time', 'end_time', 'entry_token', 'question_count', 'time_limit',
            'question_source', 'categories', 'questions',
        ]
