from django.contrib import admin

from .models import TokenTransaction, TokenWallet, UserSubscription


class TransactionInline(admin.TabularInline):
    model           = TokenTransaction
    fields          = ('amount', 'balance_after', 'reason', 'session_id', 'contest_id', 'created_at')
    readonly_fields = fields
    extra           = 0
    can_delete      = False


@admin.register(TokenWallet)
class TokenWalletAdmin(admin.ModelAdmin):
    list_display    = ('user', 'balance', 'updated_at')
    search_fields   = ('user__email', 'user__username')
    readonly_fields = ('updated_at',)
    inlines         = (TransactionInline,)


@admin.register(TokenTransaction)
class TokenTransactionAdmin(admin.ModelAdmin):
    list_display    = ('wallet', 'amount', 'balance_after', 'reason', 'created_at')
    list_filter     = ('reason',)
    search_fields   = ('wallet__user__email',)
    readonly_fields = ('created_at',)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display    = (
        'user', 'plan', 'is_pro_display', 'expires_at',
        'last_daily_bonus_at', 'last_monthly_grant_at', 'updated_at',
    )
    list_filter     = ('plan',)
    search_fields   = ('user__email', 'user__username', 'user__phone_number')
    readonly_fields = ('created_at', 'updated_at', 'is_pro_display')
    raw_id_fields   = ('user',)
    date_hierarchy  = 'expires_at'

    fieldsets = (
        ('Asosiy', {
            'fields': ('user', 'plan', 'expires_at', 'is_pro_display'),
        }),
        ('Bonuslar', {
            'fields': ('last_daily_bonus_at', 'last_monthly_grant_at'),
        }),
        ('Tizim', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    @admin.display(boolean=True, description='Pro aktiv?')
    def is_pro_display(self, obj):
        return obj.is_pro
