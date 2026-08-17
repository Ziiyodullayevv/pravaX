from django import forms
from django.contrib import admin

from .models import (
    AcademyIncomeRecord,
    AcademyMembership,
    AcademyProfile,
    Contest,
    ContestAnswer,
    ContestParticipant,
)


class AcademyProfileForm(forms.ModelForm):
    """Admin formasi: parolni plaintext kiritamiz, modelda hash holatda saqlanadi."""
    raw_password = forms.CharField(
        label='Parol',
        widget=forms.PasswordInput(render_value=False),
        required=False,
        help_text='Yangi yaratishda majburiy. Tahrirlashda bo\'sh qoldirsangiz, eski parol qoladi.',
    )

    class Meta:
        model  = AcademyProfile
        fields = (
            'username', 'fullname', 'email',
            'name', 'phone',
            'invite_code', 'balance', 'is_active',
        )

    def clean(self):
        cleaned = super().clean()
        if not self.instance.pk and not cleaned.get('raw_password'):
            raise forms.ValidationError({'raw_password': 'Yangi profil uchun parol majburiy.'})
        return cleaned

    def save(self, commit=True):
        instance = super().save(commit=False)
        raw = self.cleaned_data.get('raw_password')
        if raw:
            instance.set_password(raw)
        if commit:
            instance.save()
        return instance


class MembershipInline(admin.TabularInline):
    model           = AcademyMembership
    fields          = ('user', 'joined_at')
    readonly_fields = fields
    extra           = 0
    can_delete      = False


class IncomeInline(admin.TabularInline):
    model           = AcademyIncomeRecord
    fields          = ('user', 'plan', 'amount_som', 'created_at')
    readonly_fields = fields
    extra           = 0
    can_delete      = False


@admin.register(AcademyProfile)
class AcademyProfileAdmin(admin.ModelAdmin):
    form            = AcademyProfileForm
    list_display    = ('name', 'username', 'fullname', 'invite_code', 'balance', 'is_active', 'created_at')
    list_filter     = ('is_active',)
    search_fields   = ('name', 'username', 'fullname', 'email', 'invite_code')
    readonly_fields = ('invite_code', 'balance', 'last_login')
    inlines         = (MembershipInline, IncomeInline)

    fieldsets = (
        ('Login ma\'lumotlari', {
            'fields': ('username', 'raw_password', 'fullname', 'email'),
        }),
        ('Akademiya ma\'lumotlari', {
            'fields': ('name', 'phone'),
        }),
        ('Tizim', {
            'fields': ('invite_code', 'balance', 'is_active', 'last_login'),
        }),
    )


@admin.register(AcademyMembership)
class AcademyMembershipAdmin(admin.ModelAdmin):
    list_display    = ('user', 'academy', 'joined_at')
    list_filter     = ('academy',)
    search_fields   = ('user__email', 'academy__name')
    readonly_fields = ('joined_at',)


@admin.register(AcademyIncomeRecord)
class AcademyIncomeRecordAdmin(admin.ModelAdmin):
    list_display    = ('academy', 'user', 'plan', 'amount_som', 'created_at')
    list_filter     = ('plan', 'academy')
    search_fields   = ('academy__name', 'user__email')
    readonly_fields = ('created_at',)


class ParticipantInline(admin.TabularInline):
    model           = ContestParticipant
    fields          = ('user', 'token_spent', 'correct_count', 'wrong_count', 'rank', 'is_submitted', 'joined_at')
    readonly_fields = fields
    extra           = 0
    can_delete      = False


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    list_display      = ('title', 'contest_type', 'recurrence', 'status', 'start_time', 'end_time', 'entry_token', 'access_key')
    list_filter       = ('status', 'contest_type', 'recurrence', 'question_source')
    search_fields     = ('title', 'access_key')
    readonly_fields   = ('access_key', 'created_at')
    inlines           = (ParticipantInline,)
    filter_horizontal = ('categories', 'questions')


@admin.register(ContestParticipant)
class ContestParticipantAdmin(admin.ModelAdmin):
    list_display    = ('user', 'contest', 'correct_count', 'wrong_count', 'rank', 'is_submitted', 'joined_at')
    list_filter     = ('is_submitted', 'contest__status')
    search_fields   = ('user__email', 'contest__title')
    readonly_fields = ('joined_at',)
