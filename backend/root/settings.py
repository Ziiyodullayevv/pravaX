from pathlib import Path
from datetime import timedelta
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

# Tashqi tomondan kirish URL'i (Telegram bot tugmalari uchun)
# Production: https://api.pravax.uz
PUBLIC_BASE_URL = env('PUBLIC_BASE_URL', default='http://localhost:8000')

TELEGRAM_BOT_TOKEN    = env('TELEGRAM_BOT_TOKEN', default='')
TELEGRAM_BOT_USERNAME = env('TELEGRAM_BOT_USERNAME', default='pravagosuperbot')

# Payment botlari (alohida ikkita bot)
PAYMENT_USER_BOT_TOKEN     = env('PAYMENT_USER_BOT_TOKEN', default='')
PAYMENT_USER_BOT_USERNAME  = env('PAYMENT_USER_BOT_USERNAME', default='pravaXAdminBot')
PAYMENT_ADMIN_BOT_TOKEN    = env('PAYMENT_ADMIN_BOT_TOKEN', default='')
PAYMENT_ADMIN_BOT_USERNAME = env('PAYMENT_ADMIN_BOT_USERNAME', default='PravaXPayBot')

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'django_celery_results',

    'users',
    'quiz',
    'tokens',
    'contests',
    'signs',
    'payments',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'root.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'root.wsgi.application'

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

# ─── Redis Cache (OTP storage) ────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://localhost:6379/0'),
    }
}

# ─── Custom User Model ────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'

# ─── DRF ─────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # AVVAL academy auth — type='academy' tokenlar shunda ushlab olinadi
        'contests.auth.AcademyJWTAuthentication',
        # Keyin simplejwt — qolgan oddiy User tokenlar uchun
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# ─── drf-spectacular ──────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'Prava GO API',
    'DESCRIPTION': 'Prava imtihoniga tayyorlanish platformasi uchun REST API.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': r'/api/',
    'ENUM_NAME_OVERRIDES': {
        'UserRoleEnum': 'users.models.User.Role',
        'UserStatusEnum': 'users.models.User.Status',
        'UserAuthSourceEnum': 'users.models.User.AuthSource',
        'ExamSessionStatusEnum': 'quiz.models.ExamSession.Status',
        'QuestionDifficultyEnum': 'quiz.models.Question.Difficulty',
        'QuestionMediaTypeEnum': 'quiz.models.QuestionMedia.MediaType',
    },
}

# ─── SimpleJWT ────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── Email ────────────────────────────────────────────────────────────────────
RESEND_API_KEY = env('RESEND_API_KEY', default='')

if RESEND_API_KEY:
    EMAIL_BACKEND = 'anymail.backends.resend.EmailBackend'
    ANYMAIL = {'RESEND_API_KEY': RESEND_API_KEY}
else:
    # Domain yoki SMTP yo'q bo'lsa — OTP kodni Celery logidan ko'rish mumkin
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='Prava GO <noreply@prava.go>')

# ─── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'django-cache'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Tashkent'
# DEBUG rejimda Celery worker kerak bo'lmaydi — tasklar sinxron bajariladi
CELERY_TASK_ALWAYS_EAGER = DEBUG

from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    'transition-contests': {
        'task':     'contests.tasks.transition_contests',
        'schedule': 60.0,   # har 60 soniyada — UPCOMING→ACTIVE→FINISHED
    },
    'create-scheduled-global-contests': {
        'task':     'contests.tasks.create_scheduled_global_contests',
        'schedule': crontab(minute=1, hour=0),   # har kuni 00:01 (Asia/Tashkent)
    },
    'cleanup-expired-academy-memberships': {
        'task':     'contests.tasks.cleanup_expired_academy_memberships',
        'schedule': crontab(minute=0, hour=1),   # har kuni 01:00 — obuna tugaganlarning a'zoligini o'chiradi
    },
}

# ─── i18n ─────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = 'uz'
TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_TZ = True

# ─── CORS ────────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True   # dev only — file:// dan ham so'rov o'tishi uchun

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ─── Jazzmin (admin panel UI) ────────────────────────────────────────────────
JAZZMIN_SETTINGS = {
    'site_title':            'Prava GO Admin',
    'site_header':            'Prava GO',
    'site_brand':             'Prava GO',
    'site_logo':              None,
    'login_logo':             None,
    'site_logo_classes':      'img-circle',
    'site_icon':              None,
    'welcome_sign':           'Prava GO boshqaruv paneli',
    'copyright':              'Prava GO',
    'search_model':           ['users.User', 'quiz.Question', 'contests.Contest'],
    'user_avatar':            None,

    # Top menu
    'topmenu_links': [
        {'name': 'Bosh sahifa', 'url': 'admin:index', 'permissions': ['auth.view_user']},
        {'name': 'API hujjatlari', 'url': '/api/docs/', 'new_window': True},
        {'app': 'payments'},
        {'app': 'contests'},
    ],

    # User menu (top right)
    'usermenu_links': [
        {'name': 'API Docs', 'url': '/api/docs/', 'new_window': True},
        {'model': 'users.user'},
    ],

    # Side menu
    'show_sidebar':            True,
    'navigation_expanded':     False,
    'hide_apps':               [],
    'hide_models':             [],
    'order_with_respect_to':   [
        'users', 'quiz', 'tokens', 'payments', 'contests', 'signs',
        'auth', 'token_blacklist',
    ],

    # App va model uchun ikonkalar (Font Awesome 6)
    'icons': {
        'auth':                          'fas fa-users-cog',
        'auth.user':                     'fas fa-user',
        'auth.Group':                    'fas fa-users',

        'users.User':                    'fas fa-user-graduate',

        'quiz.Category':                 'fas fa-folder-open',
        'quiz.Question':                 'fas fa-question-circle',
        'quiz.ExamSession':              'fas fa-clipboard-list',
        'quiz.SavedQuestion':            'fas fa-bookmark',
        'quiz.CategoryProgress':         'fas fa-chart-line',

        'tokens.TokenWallet':            'fas fa-wallet',
        'tokens.TokenTransaction':       'fas fa-exchange-alt',
        'tokens.UserSubscription':       'fas fa-crown',

        'payments.Payment':              'fas fa-money-bill-wave',
        'payments.PaymentAdmin':         'fas fa-user-shield',

        'contests.Contest':              'fas fa-trophy',
        'contests.ContestParticipant':   'fas fa-users',
        'contests.AcademyProfile':       'fas fa-school',
        'contests.AcademyMembership':    'fas fa-id-card',
        'contests.AcademyIncomeRecord':  'fas fa-coins',

        'signs.Sign':                    'fas fa-traffic-light',
        'signs.SignSection':             'fas fa-folder',

        'token_blacklist':               'fas fa-ban',
    },
    'default_icon_parents':   'fas fa-chevron-circle-right',
    'default_icon_children':  'fas fa-circle',

    # UI tweaks
    'related_modal_active':      True,
    'use_google_fonts_cdn':      True,
    'show_ui_builder':           False,
    'changeform_format':         'horizontal_tabs',
    'changeform_format_overrides': {
        'auth.user':  'collapsible',
        'auth.group': 'vertical_tabs',
    },
}

JAZZMIN_UI_TWEAKS = {
    'navbar_small_text':       False,
    'footer_small_text':       False,
    'body_small_text':         False,
    'brand_small_text':        False,
    'brand_colour':            'navbar-primary',
    'accent':                  'accent-primary',
    'navbar':                  'navbar-primary navbar-dark',
    'no_navbar_border':        False,
    'navbar_fixed':            True,
    'layout_boxed':            False,
    'footer_fixed':            False,
    'sidebar_fixed':           True,
    'sidebar':                 'sidebar-dark-primary',
    'sidebar_nav_small_text':  False,
    'sidebar_disable_expand':  False,
    'sidebar_nav_child_indent':  True,
    'sidebar_nav_compact_style': False,
    'sidebar_nav_legacy_style':  False,
    'sidebar_nav_flat_style':    False,
    'theme':                     'flatly',
    'dark_mode_theme':           None,
    'button_classes': {
        'primary':   'btn-primary',
        'secondary': 'btn-secondary',
        'info':      'btn-info',
        'warning':   'btn-warning',
        'danger':    'btn-danger',
        'success':   'btn-success',
    },
    'actions_sticky_top': True,
}
