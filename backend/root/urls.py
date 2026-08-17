from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from users.views import RedirectToAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/',     include('users.urls')),
    path('api/quiz/',     include('quiz.urls')),
    path('api/tokens/',   include('tokens.urls')),
    path('api/contests/', include('contests.urls')),
    path('api/signs/',    include('signs.urls')),
    path('api/payments/', include('payments.urls')),

    # Bot tugmasi shu yerga ko'rsatadi → ilova deep link'iga 302 redirect
    path('r/<str:token>/', RedirectToAppView.as_view(), name='app-redirect'),

    # OpenAPI schema va UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui-root'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
