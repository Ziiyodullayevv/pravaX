from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Category, Choice, ExamSession, Question, QuestionMedia, SavedQuestion, SessionQuestion


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name_uzl', 'name_uzk', 'name_ru', 'description', 'order']


class CategoryStatsSerializer(serializers.ModelSerializer):
    name             = serializers.SerializerMethodField()
    icon             = serializers.SerializerMethodField()
    questions_count  = serializers.IntegerField(default=0)
    viewed_count     = serializers.IntegerField(default=0)
    correct_count    = serializers.IntegerField(default=0)
    wrong_count      = serializers.IntegerField(default=0)
    answered_count   = serializers.SerializerMethodField()
    unviewed_count   = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()
    is_completed     = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'description', 'icon', 'order',
            'questions_count', 'viewed_count', 'unviewed_count',
            'answered_count', 'correct_count', 'wrong_count',
            'progress_percent', 'is_completed',
        ]

    def get_name(self, obj):
        return {'uzl': obj.name_uzl, 'uzk': obj.name_uzk, 'ru': obj.name_ru}

    def get_icon(self, _obj):
        return 'book'

    def get_answered_count(self, obj):
        return obj.correct_count + obj.wrong_count

    def get_unviewed_count(self, obj):
        return obj.questions_count - obj.viewed_count

    def get_progress_percent(self, obj):
        if not obj.questions_count:
            return 0
        return round(obj.viewed_count / obj.questions_count * 100)

    def get_is_completed(self, obj):
        return obj.questions_count > 0 and obj.viewed_count >= obj.questions_count


class QuestionMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionMedia
        fields = ['id', 'media_type', 'file', 'order', 'caption']


# ─── Choice serializers ───────────────────────────────────────────────────────

class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'text_uzl', 'text_uzk', 'text_ru', 'order', 'is_correct']


# ─── Question serializers ─────────────────────────────────────────────────────

class QuestionListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name_uzl', read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'number', 'text_uzl', 'text_uzk', 'text_ru', 'difficulty', 'category', 'category_name']


class QuestionSessionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    media = QuestionMediaSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name_uzl', read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'number', 'text_uzl', 'text_uzk', 'text_ru',
            'explanation_uzl', 'explanation_uzk', 'explanation_ru',
            'difficulty', 'category', 'category_name', 'choices', 'media',
        ]


# ─── SessionQuestion serializers ──────────────────────────────────────────────

class SessionQuestionSerializer(serializers.ModelSerializer):
    question         = QuestionSessionSerializer(read_only=True)
    selected_choice  = ChoiceSerializer(read_only=True)
    correct_choice   = serializers.SerializerMethodField()

    class Meta:
        model = SessionQuestion
        fields = [
            'id', 'order', 'is_correct', 'answered_at',
            'selected_choice', 'correct_choice', 'question',
        ]

    @extend_schema_field(ChoiceSerializer)
    def get_correct_choice(self, obj):
        choice = obj.question.choices.filter(is_correct=True).first()
        return ChoiceSerializer(choice).data if choice else None


# ─── ExamSession serializers ──────────────────────────────────────────────────

class ExamSessionSerializer(serializers.ModelSerializer):
    percentage         = serializers.FloatField(read_only=True)
    is_passed          = serializers.BooleanField(read_only=True)
    category_id        = serializers.IntegerField(source='category.id', read_only=True)
    category_name      = serializers.CharField(source='category.name_uzl', read_only=True)

    class Meta:
        model = ExamSession
        fields = [
            'id', 'mode', 'status', 'score', 'total_questions',
            'time_limit_minutes', 'percentage', 'is_passed',
            'category_id', 'category_name',
            'started_at', 'finished_at',
        ]
        read_only_fields = fields


class ExamSessionDetailSerializer(serializers.ModelSerializer):
    percentage         = serializers.FloatField(read_only=True)
    is_passed          = serializers.BooleanField(read_only=True)
    category_id        = serializers.IntegerField(source='category.id', read_only=True)
    category_name      = serializers.CharField(source='category.name_uzl', read_only=True)
    session_questions  = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            'id', 'mode', 'status', 'score', 'total_questions',
            'time_limit_minutes', 'percentage', 'is_passed',
            'category_id', 'category_name',
            'started_at', 'finished_at',
            'session_questions',
        ]
        read_only_fields = fields

    @extend_schema_field(SessionQuestionSerializer(many=True))
    def get_session_questions(self, obj):
        qs = (
            obj.sessionquestion_set
            .select_related('question', 'question__category', 'selected_choice')
            .prefetch_related('question__choices', 'question__media')
        )
        return SessionQuestionSerializer(qs, many=True, context=self.context).data


# ─── Mistake serializer ──────────────────────────────────────────────────────

class MistakeItemSerializer(serializers.Serializer):
    wrong_count    = serializers.IntegerField()
    question       = QuestionSessionSerializer(read_only=True)
    correct_choice = ChoiceSerializer(read_only=True, allow_null=True)


# ─── Saved questions ─────────────────────────────────────────────────────────

class SavedQuestionSerializer(serializers.ModelSerializer):
    question = QuestionSessionSerializer(read_only=True)

    class Meta:
        model = SavedQuestion
        fields = ['id', 'question', 'saved_at']
        read_only_fields = fields


# ─── Input serializers ────────────────────────────────────────────────────────

PRACTICE_COUNTS = [10, 20, 50, 100, 150]
MARATHON_COUNTS = [50, 100, 150]


class StartPracticeSerializer(serializers.Serializer):
    count = serializers.ChoiceField(choices=PRACTICE_COUNTS, default=20)


class StartMarathonSerializer(serializers.Serializer):
    count = serializers.ChoiceField(choices=MARATHON_COUNTS, default=50)


class StartSessionSerializer(serializers.Serializer):
    category_id = serializers.IntegerField()


class AnswerItemSerializer(serializers.Serializer):
    question_id      = serializers.IntegerField()
    choice_id        = serializers.IntegerField()
    correct_choice_id = serializers.IntegerField()
    status           = serializers.BooleanField()


class BulkSubmitSerializer(serializers.Serializer):
    answers     = AnswerItemSerializer(many=True)
    finished_at = serializers.DateTimeField(required=False)
