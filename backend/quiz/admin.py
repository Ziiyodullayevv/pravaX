from django.contrib import admin
from django.db.models import Count
from django.utils import timezone
from django.utils.text import Truncator

from .models import Category, Choice, ExamSession, Question, QuestionMedia, SavedQuestion, SessionQuestion


class SuperuserFullAccessMixin:
    """Superuser uchun barcha cheklovlarni olib tashlaydi."""

    def get_readonly_fields(self, request, obj=None):
        if request.user.is_superuser:
            return ()
        return super().get_readonly_fields(request, obj)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return super().has_add_permission(request)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return super().has_delete_permission(request, obj)


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 4
    fields = ('text_uzl', 'text_uzk', 'text_ru', 'is_correct', 'order')


class QuestionMediaInline(admin.TabularInline):
    model = QuestionMedia
    extra = 1
    fields = ('media_type', 'file', 'caption', 'order')


@admin.register(Question)
class QuestionAdmin(SuperuserFullAccessMixin, admin.ModelAdmin):
    list_display = ('number', 'short_text', 'category', 'difficulty', 'created_by', 'is_active', 'created_at')
    list_filter = ('category', 'difficulty', 'is_active', 'created_by')
    search_fields = ('text_uzl', 'text_uzk', 'text_ru', 'explanation_uzl')
    readonly_fields = ('created_by', 'updated_by', 'created_at', 'updated_at')
    ordering = ('number', '-created_at')
    inlines = (ChoiceInline, QuestionMediaInline)

    @admin.display(description='Savol matni')
    def short_text(self, obj):
        return Truncator(obj.text_uzl).chars(60)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Category)
class CategoryAdmin(SuperuserFullAccessMixin, admin.ModelAdmin):
    list_display = ('name_uzl', 'order', 'question_count')
    ordering = ('order',)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_question_count=Count('questions'))

    @admin.display(description='Savollar soni', ordering='_question_count')
    def question_count(self, obj):
        return obj._question_count


@admin.register(ExamSession)
class ExamSessionAdmin(SuperuserFullAccessMixin, admin.ModelAdmin):
    list_display = ('id', 'user', 'score', 'total_questions', 'percentage', 'is_passed', 'status', 'started_at')
    list_filter = ('status', 'started_at')
    readonly_fields = ('user', 'total_questions', 'started_at', 'percentage', 'is_passed')
    fields = ('user', 'status', 'score', 'total_questions', 'finished_at')

    def has_add_permission(self, request):
        return False

    @admin.display(description='Foiz (%)')
    def percentage(self, obj):
        return f'{obj.percentage}%'

    @admin.display(description="O'tdi?", boolean=True)
    def is_passed(self, obj):
        return obj.is_passed


@admin.register(SessionQuestion)
class SessionQuestionAdmin(SuperuserFullAccessMixin, admin.ModelAdmin):
    list_display = ('id', 'session_id', 'session', 'question', 'selected_choice', 'is_correct', 'correct_answer', 'answered_at')
    list_filter = ('is_correct',)
    search_fields = ('session__user__email', 'question__text_uzl')
    fields = ('session', 'question', 'selected_choice', 'is_correct', 'answered_at', 'order')
    readonly_fields = ('session', 'question', 'is_correct', 'answered_at', 'order')

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related('session__user', 'question', 'selected_choice')
            .prefetch_related('question__choices')
        )

    def save_model(self, request, obj, form, change):
        if obj.selected_choice_id:
            obj.is_correct = Choice.objects.filter(pk=obj.selected_choice_id, is_correct=True).exists()
            if not obj.answered_at:
                obj.answered_at = timezone.now()
        else:
            obj.is_correct = None
        obj.save()
        score = SessionQuestion.objects.filter(session_id=obj.session_id, is_correct=True).count()
        ExamSession.objects.filter(pk=obj.session_id).update(score=score)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'selected_choice':
            obj_id = request.resolver_match.kwargs.get('object_id')
            if obj_id:
                try:
                    sq = SessionQuestion.objects.select_related('question').get(pk=obj_id)
                    kwargs['queryset'] = Choice.objects.filter(question=sq.question)
                except SessionQuestion.DoesNotExist:
                    kwargs['queryset'] = Choice.objects.none()
            else:
                kwargs['queryset'] = Choice.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    @admin.display(description="To'g'ri javob")
    def correct_answer(self, obj):
        choice = obj.question.choices.filter(is_correct=True).first()
        return choice.text_uzl if choice else '—'


@admin.register(SavedQuestion)
class SavedQuestionAdmin(admin.ModelAdmin):
    list_display  = ('id', 'user', 'question', 'saved_at')
    list_filter   = ('saved_at',)
    search_fields = ('user__email', 'question__text_uzl')
    readonly_fields = ('user', 'question', 'saved_at')

    def has_add_permission(self, _request):
        return False
