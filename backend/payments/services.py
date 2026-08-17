"""To'lov yaratish, qabul qilish, tasdiqlash/rad etish servislari."""
import os
import urllib.request
from decimal import Decimal
from html import escape

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from tokens.constants import PLAN_CONFIG
from tokens.services import SubscriptionService

from .bot_api import (
    admin_edit_caption,
    admin_edit_text,
    admin_send,
    admin_upload_document,
    admin_upload_photo,
    user_get_file_url,
    user_send,
)
from .models import Payment, PaymentAdmin


PLAN_DISPLAY = {
    Payment.Plan.MONTHLY: 'Pro Monthly (1 oy)',
    Payment.Plan.YEARLY:  'Pro Yearly (1 yil)',
}


def forward_support_to_admins(source: str, from_user: dict, text: str) -> int:
    """Foydalanuvchining /support murojaatini barcha aktiv adminlarga yuboradi.

    Args:
        source: '@pravaX_bot' yoki '@pravaXAdminBot' (qaysi botdan kelganini ko'rsatish)
        from_user: Telegram message['from'] dict: {id, first_name, last_name, username, ...}
        text: User yozgan support matni

    Returns:
        Necha admin'ga yuborilgani.
    """
    # User info — DB'da bormi tekshiramiz (telefon raqami olish uchun)
    from users.models import User
    db_user = User.objects.filter(telegram_id=from_user.get('id')).first()
    phone = db_user.phone_number if db_user and db_user.phone_number else '—'

    fullname = escape(
        (f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}").strip() or '—'
    )
    username = from_user.get('username', '')
    username_str = f'@{escape(username)}' if username else '—'
    text_escaped = escape(text or '(bo\'sh xabar)')

    caption = (
        f'💬 <b>Yangi murojaat</b>\n\n'
        f'📲 Manba: <b>{escape(source)}</b>\n'
        f'👤 Ism: <b>{fullname}</b>\n'
        f'🔗 Username: {username_str}\n'
        f'📞 Tel: <code>{escape(phone)}</code>\n'
        f'🆔 Telegram ID: <code>{from_user.get("id")}</code>\n\n'
        f'📝 Xabar:\n<i>{text_escaped}</i>'
    )

    # Admin bot orqali yuboramiz (adminlar @PravaXPayBot'ni boshlagan)
    sent = 0
    for admin in PaymentAdmin.objects.filter(is_active=True):
        res = admin_send(admin.telegram_id, caption)
        if res.get('ok'):
            sent += 1
        else:
            print(f'[SUPPORT] [ERR] admin#{admin.telegram_id}: {res}', flush=True)
    return sent


# ─── Yaratish ────────────────────────────────────────────────────────────────

def create_payment(user, plan_key: str) -> Payment:
    config = PLAN_CONFIG.get(plan_key)
    if not config or plan_key == 'free':
        raise ValueError(f'Noto\'g\'ri plan: {plan_key}')
    return Payment.objects.create(
        user=user,
        plan=plan_key,
        amount_som=Decimal(str(config['price'])),
    )


def get_deep_link(payment: Payment) -> str:
    bot_username = settings.PAYMENT_USER_BOT_USERNAME
    return f'https://t.me/{bot_username}?start={payment.payload_token}'


# ─── Fayl qabul qilish (user botdan) ─────────────────────────────────────────

def receive_payment_file(payment: Payment, file_id: str, kind: str) -> None:
    print(f'[PAY #{payment.id}] file received: kind={kind} file_id={file_id[:30]}...', flush=True)

    payment.file_telegram_id = file_id
    payment.file_kind        = kind
    payment.status           = Payment.Status.PENDING

    content = b''
    file_url = user_get_file_url(file_id)
    print(f'[PAY #{payment.id}] file_url: {file_url[:80] if file_url else "(empty)"}...', flush=True)

    if file_url:
        try:
            with urllib.request.urlopen(file_url, timeout=60) as resp:
                content = resp.read()
            print(f'[PAY #{payment.id}] downloaded {len(content)} bytes', flush=True)
            ext = '.jpg' if kind == 'photo' else _ext_from_url(file_url)
            payment.file.save(f'payment_{payment.id}{ext}', ContentFile(content), save=False)
        except Exception as e:
            print(f'[PAY #{payment.id}] [ERR] download failed: {e}', flush=True)
    else:
        print(f'[PAY #{payment.id}] [ERR] getFile qaytarmadi (file katta yoki Telegram xatosi)', flush=True)

    payment.save()
    print(f'[PAY #{payment.id}] saved, status=pending. Adminlarga yuborilmoqda...', flush=True)

    # Adminlarga fayl baytlari bilan yuboramiz (file_id bot-specific bo'lgani uchun)
    _send_to_admins(payment, content)
    print(f'[PAY #{payment.id}] flow complete', flush=True)


def _ext_from_url(url: str) -> str:
    path = url.rsplit('?', 1)[0].rsplit('/', 1)[-1]
    if '.' in path:
        return '.' + path.rsplit('.', 1)[-1]
    return ''


def _send_to_admins(payment: Payment, content: bytes = b'') -> None:
    user      = payment.user
    plan_name = PLAN_DISPLAY.get(payment.plan, payment.plan)
    # HTML caption uchun user kirishlarini escape qilamiz (<, >, & lar Telegram'ni urmasin)
    fullname = escape((f'{user.first_name or ""} {user.last_name or ""}').strip() or '—')
    phone    = escape(user.phone_number or '—')
    caption = (
        f'💰 <b>Yangi to\'lov</b>\n\n'
        f'👤 Ism: <b>{fullname}</b>\n'
        f'📞 Tel: <code>{phone}</code>\n'
        f'🆔 TG ID: <code>{user.telegram_id or "—"}</code>\n'
        f'🆔 User ID: <code>{user.id}</code>\n'
        f'📦 Tarif: <b>{escape(plan_name)}</b>\n'
        f'💵 Summa: <b>{int(payment.amount_som):,} so\'m</b>\n'
        f'#️⃣ Payment ID: <code>{payment.id}</code>'
    )
    keyboard = {
        'inline_keyboard': [[
            {'text': '✅ Tasdiqlash',   'callback_data': f'approve:{payment.id}'},
            {'text': '❌ Bekor qilish', 'callback_data': f'reject:{payment.id}'},
        ]],
    }

    admins = list(PaymentAdmin.objects.filter(is_active=True))
    if not admins:
        print(f'[WARN] payment#{payment.id}: aktiv PaymentAdmin yo\'q', flush=True)
        return

    # Agar content bo'sh bo'lsa, payment.file dan o'qib olamiz
    if not content and payment.file:
        try:
            with payment.file.open('rb') as fh:
                content = fh.read()
        except Exception as e:
            print(f'[ERR] payment#{payment.id}: file read: {e}', flush=True)

    filename = os.path.basename(payment.file.name) if payment.file else f'payment_{payment.id}.bin'

    print(f'[PAY #{payment.id}] sending to {len(admins)} admin(s), '
          f'kind={payment.file_kind}, content={len(content)} bytes, file={filename}', flush=True)

    for admin in admins:
        if payment.file_kind == 'photo' and content:
            res = admin_upload_photo(
                admin.telegram_id, content, filename,
                caption=caption, reply_markup=keyboard,
            )
            method = 'upload_photo'
        elif payment.file_kind == 'document' and content:
            res = admin_upload_document(
                admin.telegram_id, content, filename,
                caption=caption, reply_markup=keyboard,
            )
            method = 'upload_document'
        else:
            res = admin_send(admin.telegram_id, caption, reply_markup=keyboard)
            method = 'text_only'

        if res.get('ok'):
            print(f'[PAY #{payment.id}] [OK] admin#{admin.telegram_id} via {method}', flush=True)
        else:
            print(
                f'[PAY #{payment.id}] [ERR] admin#{admin.telegram_id} via {method}: {res}',
                flush=True,
            )


# ─── Approve / Reject ────────────────────────────────────────────────────────

@transaction.atomic
def approve_payment(payment: Payment, admin: PaymentAdmin) -> None:
    payment.status       = Payment.Status.APPROVED
    payment.processed_by = admin
    payment.processed_at = timezone.now()
    payment.save(update_fields=['status', 'processed_by', 'processed_at', 'updated_at'])

    # Pro aktivlashtirish: SubscriptionService welcome bonus + revenue share avtomatik
    SubscriptionService.subscribe(payment.user, payment.plan)

    if payment.user_chat_id:
        plan_name = PLAN_DISPLAY.get(payment.plan, payment.plan)
        user_send(payment.user_chat_id, (
            f'✅ <b>To\'lov tasdiqlandi!</b>\n\n'
            f'Tarif: <b>{plan_name}</b>\n'
            f'Pro tarif muvaffaqiyatli aktivlashtirildi.\n\n'
            f'Endi ilovaga qaytib, barcha Pro imkoniyatlardan foydalaning.'
        ))


@transaction.atomic
def reject_payment(payment: Payment, admin: PaymentAdmin, reason: str = '') -> None:
    payment.status           = Payment.Status.REJECTED
    payment.processed_by     = admin
    payment.processed_at     = timezone.now()
    payment.rejection_reason = reason
    payment.save(update_fields=[
        'status', 'processed_by', 'processed_at', 'rejection_reason', 'updated_at',
    ])

    if payment.user_chat_id:
        text = (
            '❌ <b>To\'lov tasdiqlanmadi.</b>\n\n'
            'Iltimos, to\'lov chekini qayta tekshirib, ilovadan qayta urinib ko\'ring.'
        )
        if reason:
            text += f'\n\nSabab: <i>{reason}</i>'
        user_send(payment.user_chat_id, text)


# ─── Admin xabarini yangilash (callback'dan keyin) ───────────────────────────

def update_admin_message_after_action(
    chat_id: int,
    message_id: int,
    original_caption: str,
    action_label: str,
    has_media: bool,
) -> None:
    new_text = f'{original_caption}\n\n{action_label}'
    empty_keyboard = {'inline_keyboard': []}
    if has_media:
        admin_edit_caption(chat_id, message_id, new_text, reply_markup=empty_keyboard)
    else:
        admin_edit_text(chat_id, message_id, new_text, reply_markup=empty_keyboard)
