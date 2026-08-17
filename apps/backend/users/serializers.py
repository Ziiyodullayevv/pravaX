from rest_framework import serializers
from .models import User


class EmailOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class EmailOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate_otp(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('OTP faqat raqamlardan iborat bo\'lishi kerak.')
        return value


class TelegramLoginSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    username = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    photo_url = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class UserSerializer(serializers.ModelSerializer):
    is_premium = serializers.BooleanField(read_only=True)
    academy    = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'status',
            'is_premium',
            'auth_source',
            'telegram_id',
            'phone_number',
            'photo_url',
            'academy',
        ]
        read_only_fields = fields

    def get_academy(self, obj):
        """User a'zo bo'lgan academy haqida qisqacha ma'lumot yoki None."""
        membership = getattr(obj, 'academy_membership', None)
        if not membership:
            return None
        return {
            'id':          membership.academy.id,
            'name':        membership.academy.name,
            'invite_code': membership.academy.invite_code,
            'joined_at':   membership.joined_at,
        }


class TelegramPhoneVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('Kod faqat raqamlardan iborat bo\'lishi kerak.')
        return value


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone_number', 'photo_url']
