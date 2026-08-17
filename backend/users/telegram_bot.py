import json
import uuid
import urllib.request
import urllib.error

from django.conf import settings

from .services import (
    generate_otp, normalize_phone,
    set_tg_otp,
    get_auth_session, set_auth_session_success,
    set_tg_token_map, get_tg_token_map, delete_tg_token_map,
)


def _api(method: str, payload: dict) -> dict:
    url = f'https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}'
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {'description': str(e)}
        return {'ok': False, **body}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def _is_valid_button_url(url: str) -> bool:
    """Telegram inline keyboard URL faqat http(s):// yoki tg:// qabul qiladi.
    Custom scheme'lar (pravax://, myapp://) rad etiladi → 400 Bad Request.
    """
    if not url:
        return False
    url = url.strip().lower()
    return url.startswith(('http://', 'https://', 'tg://'))


def _get_user_photo_url(telegram_id: int) -> str:
    """Telegram profile rasmini URL sifatida oladi."""
    try:
        result = _api('getUserProfilePhotos', {'user_id': telegram_id, 'limit': 1})
        photos = result.get('result', {}).get('photos', [])
        if not photos:
            return ''
        file_id = photos[0][-1]['file_id']
        result2 = _api('getFile', {'file_id': file_id})
        file_path = result2.get('result', {}).get('file_path', '')
        if not file_path:
            return ''
        return f'https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}'
    except Exception:
        return ''


def send_contact_request(chat_id: int) -> None:
    _api('sendMessage', {
        'chat_id': chat_id,
        'text': 'Prava X ga kirish uchun telefon raqamingizni ulashing:',
        'reply_markup': {
            'keyboard': [[{
                'text': '📱 Telefon raqamimni ulashish',
                'request_contact': True,
            }]],
            'resize_keyboard': True,
            'one_time_keyboard': True,
        },
    })


def send_otp(chat_id: int, phone: str, otp: str) -> None:
    _api('sendMessage', {
        'chat_id': chat_id,
        'text': (
            f'✅ Tasdiqlash kodingiz: <b>{otp}</b>\n\n'
            f'Ilovaga kiriting:\n'
            f'📱 Telefon: <code>{phone}</code>\n'
            f'🔑 Kod: <code>{otp}</code>\n\n'
            f'Kod 5 daqiqa davomida amal qiladi.'
        ),
        'parse_mode': 'HTML',
        'reply_markup': {'remove_keyboard': True},
    })


def _handle_deep_link_contact(chat_id: int, telegram_id: int, token: str, contact: dict, from_data: dict) -> None:
    """Deep link flow: token orqali kelgan foydalanuvchini login qiladi."""
    from rest_framework_simplejwt.tokens import RefreshToken
    from .models import User
    from .serializers import UserSerializer

    session = get_auth_session(token)
    if session is None:
        _api('sendMessage', {
            'chat_id': chat_id,
            'text': '❌ Sessiya muddati tugagan. Ilovadan qayta urinib ko\'ring.',
            'reply_markup': {'remove_keyboard': True},
        })
        delete_tg_token_map(telegram_id)
        return

    if session.get('status') == 'success':
        _api('sendMessage', {
            'chat_id': chat_id,
            'text': '✅ Siz allaqachon tizimga kirdingiz. Ilovaga qayting.',
            'reply_markup': {'remove_keyboard': True},
        })
        return

    phone       = normalize_phone(contact['phone_number'])
    first_name  = from_data.get('first_name', '')
    last_name   = from_data.get('last_name', '')
    tg_username = from_data.get('username', '')
    photo_url   = _get_user_photo_url(telegram_id)

    user, created = User.objects.get_or_create(
        telegram_id=telegram_id,
        defaults={
            'username':     tg_username or uuid.uuid4().hex[:16],
            'first_name':   first_name,
            'last_name':    last_name,
            'phone_number': phone,
            'photo_url':    photo_url or None,
            'auth_source':  User.AuthSource.TELEGRAM,
        },
    )

    if not created:
        updated = []
        for field, val in [
            ('phone_number', phone),
            ('first_name',   first_name),
            ('last_name',    last_name),
            ('photo_url',    photo_url or None),
        ]:
            if val and getattr(user, field) != val:
                setattr(user, field, val)
                updated.append(field)
        # Telegram @username o'zgarganda yangilash (telegram_id birlamchi kalit bo'lib qoladi)
        if tg_username and user.username != tg_username:
            if not User.objects.filter(username=tg_username).exclude(pk=user.pk).exists():
                user.username = tg_username
                updated.append('username')
        if updated:
            user.save(update_fields=updated)

    redirect_url = session.get('redirect_url', '')

    refresh = RefreshToken.for_user(user)
    set_auth_session_success(
        token,
        UserSerializer(user).data,
        str(refresh.access_token),
        str(refresh),
    )
    delete_tg_token_map(telegram_id)

    text = (
        f'✅ Xush kelibsiz, {first_name or "foydalanuvchi"}!\n\n'
        f'Ilovaga qayting — avtomatik tizimga kirasiz.'
    )
    payload = {'chat_id': chat_id, 'text': text}

    # Bot tugmasi: wrapper URL'ga yo'naltiramiz (Telegram custom scheme'ni rad etadi).
    # Wrapper sahifa user'ni app'ning deep link'iga (pravago://login-success) yo'naltiradi.
    # Frontchi: Linking + AppState listener'lar orqali login flow'ni yakunlaydi.
    if redirect_url:
        button_url = f'{settings.PUBLIC_BASE_URL.rstrip("/")}/r/{token}/'
        payload['reply_markup'] = {
            'inline_keyboard': [[{'text': '🚀 Ilovaga qaytish', 'url': button_url}]],
        }
    else:
        payload['reply_markup'] = {'remove_keyboard': True}

    res = _api('sendMessage', payload)
    if not res.get('ok'):
        print(f'[WARN] tg login bot sendMessage failed: {res}', flush=True)
        payload['reply_markup'] = {'remove_keyboard': True}
        _api('sendMessage', payload)


def handle_update(update: dict) -> None:
    message = update.get('message')
    if not message:
        return

    chat_id     = message['chat']['id']
    telegram_id = message['from']['id']
    from_data   = message['from']

    # ── /support [matn] ──────────────────────────────────────────────────────
    if 'text' in message and message['text'].startswith('/support'):
        parts = message['text'].split(maxsplit=1)
        support_text = parts[1].strip() if len(parts) > 1 else ''

        if not support_text:
            _api('sendMessage', {
                'chat_id': chat_id,
                'text': (
                    '💬 <b>Yordamga murojaat</b>\n\n'
                    'Murojaatingizni quyidagi shaklda yuboring:\n'
                    '<code>/support sizning xabaringiz</code>\n\n'
                    '<b>Misol:</b>\n'
                    '<code>/support Login bo\'lishda muammo bor</code>\n\n'
                    'Xabaringiz to\'g\'ridan-to\'g\'ri adminlarga yetadi.'
                ),
                'parse_mode': 'HTML',
            })
            return

        from payments.services import forward_support_to_admins
        sent = forward_support_to_admins('@pravaX_bot (login bot)', from_data, support_text)

        if sent > 0:
            _api('sendMessage', {
                'chat_id': chat_id,
                'text': (
                    '✅ Murojaatingiz qabul qilindi.\n\n'
                    'Adminlarimiz tez orada javob beradi. Iltimos, sabrli bo\'ling.'
                ),
            })
        else:
            _api('sendMessage', {
                'chat_id': chat_id,
                'text': '⚠️ Hozircha admin yo\'q. Iltimos, keyinroq urinib ko\'ring.',
            })
        return

    # ── /start [TOKEN] ────────────────────────────────────────────────────────
    if 'text' in message and message['text'].startswith('/start'):
        parts = message['text'].split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else None

        if token:
            session = get_auth_session(token)
            if session is None:
                _api('sendMessage', {
                    'chat_id': chat_id,
                    'text': '❌ Token yaroqsiz yoki muddati tugagan. Ilovadan qayta urinib ko\'ring.',
                })
                return
            if session.get('status') == 'success':
                _api('sendMessage', {'chat_id': chat_id, 'text': '✅ Allaqachon tizimga kirilgan. Ilovaga qayting.'})
                return
            set_tg_token_map(telegram_id, token)

        send_contact_request(chat_id)
        return

    # ── Contact ───────────────────────────────────────────────────────────────
    if 'contact' in message:
        contact = message['contact']

        if contact.get('user_id') != telegram_id:
            _api('sendMessage', {'chat_id': chat_id, 'text': 'Iltimos, faqat o\'z raqamingizni ulashing.'})
            return

        token = get_tg_token_map(telegram_id)

        if token:
            _handle_deep_link_contact(chat_id, telegram_id, token, contact, from_data)
        else:
            # Eski OTP flow
            phone = normalize_phone(contact['phone_number'])
            otp   = generate_otp()
            set_tg_otp(phone, otp, telegram_id)
            send_otp(chat_id, phone, otp)
