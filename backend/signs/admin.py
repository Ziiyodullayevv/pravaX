from django.contrib import admin
from django.utils.html import format_html

from .models import Sign, SignSection


class SignInline(admin.TabularInline):
    model  = Sign
    fields = ('number', 'name_uzl', 'image', 'order')
    extra  = 0


@admin.register(SignSection)
class SignSectionAdmin(admin.ModelAdmin):
    list_display       = ('order', 'name_uzl', 'name_uzk', 'name_ru', 'signs_count')
    list_display_links = ('name_uzl',)
    list_editable      = ('order',)
    inlines       = (SignInline,)

    def signs_count(self, obj):
        return obj.signs.count()
    signs_count.short_description = 'Belgilar soni'


@admin.register(Sign)
class SignAdmin(admin.ModelAdmin):
    list_display       = ('number', 'name_uzl', 'section', 'preview', 'order')
    list_display_links = ('number', 'name_uzl')
    list_filter        = ('section',)
    search_fields      = ('number', 'name_uzl', 'name_ru')
    list_editable      = ('order',)
    list_select_related = ('section',)

    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" height="40"/>', obj.image.url)
        return '—'
    preview.short_description = 'Rasm'
