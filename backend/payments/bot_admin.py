"""Admin bot (PravaXPayBot): adminlar to'lovlarni tasdiqlaydi/rad etadi."""
from .bot_api import admin_answer_callback, admin_send
from .models import Payment, PaymentAdmin
from .services import approve_payment, reject_payment, update_admin_message_after_action


def handle_admin_update(update: dict) -> None:
    if 'callback_query' in update:
        return _handle_callback(update['callback_query'])
    if 'message' in update:
        return _handle_message(update['message'])


def _handle_message(msg: dict) -> None:
    chat_id = msg['chat']['id']
    text    = (msg.get('text') or '').strip()

    if text.startswith('/start') or text.startswith('/me'):
        try:
            admin = PaymentAdmin.objects.get(telegram_id=chat_id, is_active=True)
        except PaymentAdmin.DoesNotExist:
            admin_send(chat_id, (
                f'⛔ Sizga ruxsat yo\'q.\n\n'
                f'Admin sifatida qo\'shilish uchun bosh adminga quyidagi ID ni yuboring:\n'
                f'<code>{chat_id}</code>'
            ))
            return
        admin_send(chat_id, (
            f'✅ Salom, <b>{admin.name}</b>!\n\n'
            f'To\'lovlar shu yerga avtomatik keladi.\n'
            f'Tasdiqlash yoki bekor qilish uchun tugmalarni bosing.'
        ))
        return

    admin_send(chat_id, 'To\'lovlar avtomatik yuboriladi. Buyruqlar: /start')


def _handle_callback(cbq: dict) -> None:
    callback_id = cbq['id']
    from_id     = cbq['from']['id']
    data        = cbq.get('data', '')
    msg         = cbq.get('message') or {}

    try:
        admin = PaymentAdmin.objects.get(telegram_id=from_id, is_active=True)
    except PaymentAdmin.DoesNotExist:
        admin_answer_callback(callback_id, '⛔ Sizga ruxsat yo\'q.', show_alert=True)
        return

    if ':' not in data:
        admin_answer_callback(callback_id, '⚠️ Noto\'g\'ri buyruq.')
        return

    action, payment_id_str = data.split(':', 1)
    try:
        payment = Payment.objects.select_related('user').get(pk=int(payment_id_str))
    except (Payment.DoesNotExist, ValueError):
        admin_answer_callback(callback_id, '❌ To\'lov topilmadi.')
        return

    if payment.status != Payment.Status.PENDING:
        admin_answer_callback(
            callback_id,
            f'⚠️ Holat: {payment.get_status_display()}',
            show_alert=True,
        )
        return

    chat_id          = msg['chat']['id']
    message_id       = msg['message_id']
    original_caption = msg.get('caption') or msg.get('text') or ''
    has_media        = bool(msg.get('photo') or msg.get('document'))

    if action == 'approve':
        approve_payment(payment, admin)
        admin_answer_callback(callback_id, '✅ Tasdiqlandi')
        update_admin_message_after_action(
            chat_id, message_id, original_caption,
            f'✅ <b>Tasdiqlandi</b> — {admin.name}',
            has_media,
        )

    elif action == 'reject':
        reject_payment(payment, admin)
        admin_answer_callback(callback_id, '❌ Bekor qilindi')
        update_admin_message_after_action(
            chat_id, message_id, original_caption,
            f'❌ <b>Bekor qilindi</b> — {admin.name}',
            has_media,
        )

    else:
        admin_answer_callback(callback_id, '⚠️ Noma\'lum amal.')
