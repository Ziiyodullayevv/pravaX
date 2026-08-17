from rest_framework import serializers

from .models import Sign, SignSection


class SignSectionListSerializer(serializers.ModelSerializer):
    name        = serializers.SerializerMethodField()
    signs_count = serializers.IntegerField(source='signs.count', read_only=True)

    class Meta:
        model = SignSection
        fields = ['id', 'name', 'order', 'signs_count']

    def get_name(self, obj):
        return {'uzl': obj.name_uzl, 'uzk': obj.name_uzk, 'ru': obj.name_ru}


class SignListSerializer(serializers.ModelSerializer):
    name  = serializers.SerializerMethodField()
    image = serializers.ImageField()

    class Meta:
        model = Sign
        fields = ['id', 'number', 'name', 'image', 'order']

    def get_name(self, obj):
        return {'uzl': obj.name_uzl, 'uzk': obj.name_uzk, 'ru': obj.name_ru}


class SignDetailSerializer(serializers.ModelSerializer):
    name        = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    extra       = serializers.SerializerMethodField()
    image       = serializers.ImageField()
    section     = SignSectionListSerializer(read_only=True)

    class Meta:
        model = Sign
        fields = ['id', 'number', 'name', 'image', 'description', 'extra', 'order', 'section']

    def get_name(self, obj):
        return {'uzl': obj.name_uzl, 'uzk': obj.name_uzk, 'ru': obj.name_ru}

    def get_description(self, obj):
        return {'uzl': obj.description_uzl, 'uzk': obj.description_uzk, 'ru': obj.description_ru}

    def get_extra(self, obj):
        return {'uzl': obj.extra_uzl, 'uzk': obj.extra_uzk, 'ru': obj.extra_ru}
