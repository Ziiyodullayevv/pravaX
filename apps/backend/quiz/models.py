from django.conf import settings
from django.db import models


class Category(models.Model):
    name_uzl = models.CharField(max_length=200, verbose_name='Nomi (UZL)')
    name_uzk = models.CharField(max_length=200, blank=True, verbose_name='Nomi (UZK)')
    name_ru = models.CharField(max_length=200, blank=True, verbose_name='Nomi (RU)')
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name = 'Kategoriya'
        verbose_name_plural = 'Kategoriyalar'

    def __str__(self):
        return self.name_uzl


class Question(models.Model):
    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Oson'
        MEDIUM = 'medium', "O'rta"
        HARD = 'hard', 'Qiyin'

    number = models.PositiveIntegerField(
        unique=True,
        null=True,
        blank=True,
        verbose_name='Savol raqami',
        help_text='Rasm nomidagi raqam bilan mos keladi (masalan: i{number}_*.jpg)',
    )
    ticket_number = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name='Bilet raqami',
        help_text='1–123 oraligidagi bilet (question_category)',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='questions',
    )
    text_uzl = models.TextField(verbose_name='Matn (UZL)')
    text_uzk = models.TextField(blank=True, verbose_name='Matn (UZK)')
    text_ru = models.TextField(blank=True, verbose_name='Matn (RU)')
    explanation_uzl = models.TextField(blank=True, verbose_name='Izoh (UZL)')
    explanation_uzk = models.TextField(blank=True, verbose_name='Izoh (UZK)')
    explanation_ru = models.TextField(blank=True, verbose_name='Izoh (RU)')
    difficulty = models.CharField(
        max_length=10,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_questions',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_questions',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['number', '-created_at']
        verbose_name = 'Savol'
        verbose_name_plural = 'Savollar'

    def __str__(self):
        prefix = f'#{self.number} ' if self.number else ''
        return f'{prefix}{self.text_uzl[:80]}'


class QuestionMedia(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = 'image', 'Rasm'
        VIDEO = 'video', 'Video'
        AUDIO = 'audio', 'Audio'

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='media',
    )
    media_type = models.CharField(max_length=10, choices=MediaType.choices)
    file = models.FileField(upload_to='questions/images/')
    order = models.PositiveIntegerField(default=0)
    caption = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['order']
        verbose_name = 'Media'
        verbose_name_plural = 'Media fayllar'

    def __str__(self):
        return f'{self.get_media_type_display()} — savol #{self.question_id}'


class Choice(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='choices',
    )
    text_uzl = models.CharField(max_length=500, verbose_name='Variant (UZL)')
    text_uzk = models.CharField(max_length=500, blank=True, verbose_name='Variant (UZK)')
    text_ru = models.CharField(max_length=500, blank=True, verbose_name='Variant (RU)')
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name = 'Variant'
        verbose_name_plural = 'Variantlar'

    def __str__(self):
        marker = '✓' if self.is_correct else '✗'
        return f'[{marker}] {self.text_uzl[:60]}'


class ExamSession(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'Jarayonda'
        COMPLETED = 'completed', 'Yakunlangan'
        ABANDONED = 'abandoned', 'Tashlab ketilgan'

    class Mode(models.TextChoices):
        CATEGORY = 'category', 'Mavzuli test'
        MIXED    = 'mixed',    'Aralash test (10 savol)'
        MARATHON = 'marathon', 'Marafon'
        TEST     = 'test',     'Sinov exam'
        PRACTICE = 'practice', 'Mashq (random)'

    PASSING_PERCENTAGE = 90
    TEST_QUESTION_COUNT = 20
    TEST_TIME_LIMIT = 20  # daqiqa

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='exam_sessions',
    )
    mode = models.CharField(
        max_length=10,
        choices=Mode.choices,
        default=Mode.CATEGORY,
    )
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions',
    )
    questions = models.ManyToManyField(
        Question,
        through='SessionQuestion',
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
    )
    score          = models.PositiveIntegerField(default=0)
    total_questions = models.PositiveIntegerField(default=20)
    tokens_spent   = models.PositiveIntegerField(default=0)
    started_at     = models.DateTimeField(auto_now_add=True)
    finished_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Imtihon sessiyasi'
        verbose_name_plural = 'Imtihon sessiyalari'

    def __str__(self):
        return f'{self.user} — {self.score}/{self.total_questions}'

    @property
    def percentage(self) -> float:
        if not self.total_questions:
            return 0.0
        return round(self.score / self.total_questions * 100, 1)

    @property
    def is_passed(self) -> bool:
        return self.percentage >= self.PASSING_PERCENTAGE


class SavedQuestion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_questions',
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='saved_by',
    )
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'question']
        ordering = ['-saved_at']
        verbose_name = 'Saqlangan savol'
        verbose_name_plural = 'Saqlangan savollar'

    def __str__(self):
        return f'{self.user} — Savol #{self.question_id}'


class CategoryProgress(models.Model):
    """Category rejimida yechilgan har bir savolning oxirgi natijasi (upsert)."""
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='category_progress')
    question    = models.ForeignKey('Question', on_delete=models.CASCADE, related_name='category_progress')
    category    = models.ForeignKey('Category', on_delete=models.SET_NULL, null=True, related_name='progress_entries')
    is_correct  = models.BooleanField()
    answered_at = models.DateTimeField()

    class Meta:
        unique_together = ('user', 'question')
        verbose_name        = 'Kategoriya javobi'
        verbose_name_plural = 'Kategoriya javoblari'

    def __str__(self):
        mark = '✓' if self.is_correct else '✗'
        return f'{self.user} [{mark}] Savol #{self.question_id}'


class SessionQuestion(models.Model):
    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(
        Choice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    is_correct = models.BooleanField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ['session', 'question']
        ordering = ['order']
        verbose_name = 'Sessiya savoli'
        verbose_name_plural = 'Sessiya savollari'

    def __str__(self):
        return f'Sessiya #{self.session_id} — Savol #{self.question_id}'
