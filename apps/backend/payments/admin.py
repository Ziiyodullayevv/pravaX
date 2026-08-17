from django.contrib import admin
from django.utils.html import format_html

from .models import Payment, PaymentAdmin as PaymentAdminModel


@admin.register(PaymentAdminModel)
class PaymentApproverAdmin(admin.ModelAdmin):
    list_display    = ('name', 'telegram_id', 'is_active', 'created_at')
    list_filter     = ('is_active',)
    search_fields   = ('name', 'telegram_id')
    readonly_fields = ('created_at',)


@admin.register(Payment)
class PaymentModelAdmin(admin.ModelAdmin):
    list_display    = (
        'id', 'user_display', 'plan', 'amount_som', 'status',
        'created_at', 'processed_at', 'processed_by',
    )
    list_filter     = ('status', 'plan', 'created_at')
    search_fields   = (
        'user__email', 'user__phone_number', 'user__first_name',
        'user__last_name', 'payload_token',
    )
    readonly_fields = (
        'payload_token', 'user_chat_id', 'file_telegram_id', 'file_kind',
        'file_preview', 'created_at', 'updated_at',
    )
    raw_id_fields   = ('user', 'processed_by')
    list_per_page   = 50
    date_hierarchy  = 'created_at'

    fieldsets = (
        ('To\'lov', {
            'fields': ('user', 'plan', 'amount_som', 'status'),
        }),
        ('Fayl', {
            'fields': ('file', 'file_preview', 'file_telegram_id', 'file_kind'),
        }),
        ('Qayta ishlash', {
            'fields': ('processed_by', 'processed_at', 'rejection_reason'),
        }),
        ('Tizim', {
            'fields': ('payload_token', 'user_chat_id', 'created_at', 'updated_at'),
        }),
    )

    def user_display(self, obj):
        return obj.user.email or obj.user.phone_number or f'user#{obj.user_id}'
    user_display.short_description = 'Foydalanuvchi'

    def file_preview(self, obj):
        if not obj.file:
            return '—'
        url = obj.file.url
        if obj.file_kind == 'photo':
            return format_html('<a href="{0}" target="_blank"><img src="{0}" style="max-width:300px"/></a>', url)
        return format_html('<a href="{0}" target="_blank">📎 Yuklab olish</a>', url)
    file_preview.short_description = 'Ko\'rish'
