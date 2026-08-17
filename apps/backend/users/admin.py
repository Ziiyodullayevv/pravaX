from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'id', 'email', 'first_name', 'last_name',
        'telegram_id', 'phone_number',
        'role', 'status', 'auth_source', 'is_active', 'date_joined',
    )
    list_filter  = ('role', 'status', 'auth_source', 'is_active')
    search_fields = ('email', 'username', 'first_name', 'last_name', 'phone_number', 'telegram_id')
    ordering     = ('-date_joined',)
    readonly_fields = ('date_joined', 'last_login')

    fieldsets = (
        ('Asosiy', {
            'fields': ('username', 'email', 'password'),
        }),
        ('Shaxsiy ma\'lumotlar', {
            'fields': ('first_name', 'last_name', 'phone_number', 'photo_url'),
        }),
        ('Telegram', {
            'fields': ('telegram_id',),
        }),
        ('Rol va holat', {
            'fields': ('role', 'status', 'auth_source'),
        }),
        ('Huquqlar', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',),
        }),
        ('Sana', {
            'fields': ('date_joined', 'last_login'),
        }),
    )

    add_fieldsets = (
        ('Yangi foydalanuvchi', {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'role', 'auth_source'),
        }),
    )
