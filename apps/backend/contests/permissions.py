from rest_framework.permissions import BasePermission, IsAuthenticated

from .models import AcademyProfile


class IsAcademyAdmin(BasePermission):
    """request.user — AcademyProfile bo'lishi va is_active bo'lishi kerak."""
    message = 'Akademiya admin sifatida tizimga kirish talab qilinadi.'

    def has_permission(self, request, view):
        return isinstance(request.user, AcademyProfile) and request.user.is_active


class IsRealUser(IsAuthenticated):
    """Faqat haqiqiy User uchun (AcademyProfile uchun emas).

    Akademiya admin tokeni bilan kelganlarga ruxsat berilmaydi.
    Foydalanuvchi-spetsifik amallar uchun (test boshlash, to'lov, profil va h.k.).
    """
    message = 'Bu endpoint faqat oddiy foydalanuvchilar uchun (akademiya admin emas).'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return not isinstance(request.user, AcademyProfile)
