"""User bot (pravaXAdminBot): foydalanuvchi to'lov chekini yuboradi."""
from .bot_api import user_send
from .models import Payment
from .services import forward_support_to_admins, receive_payment_file


def handle_user_update(update: dict) -> None:
    msg = update.get('message') or {}
    chat = msg.get('chat') or {}
    chat_id = chat.get('id')
    if not chat_id:
        return

    from_data = msg.get('from') or {}
    text      = (msg.get('text') or '').strip()

    # /support [matn]
    if text.startswith('/support'):
        parts = text.split(maxsplit=1)
        support_text = parts[1].strip() if len(parts) > 1 else ''
        return _handle_support(chat_id, from_data, support_text)

    # /start <payload>
    if text.startswith('/start'):
        parts = text.split(maxsplit=1)
        payload = parts[1].strip() if len(parts) > 1 else ''
        return _handle_start(chat_id, payload)

    # File yuborildi
    photo    = msg.get('photo')
    document = msg.get('document')
    if photo or document:
        return _handle_file(chat_id, photo, document)

    user_send(chat_id, (
        '📩 To\'lov chekini yuborish uchun rasm, PDF yoki DOCX yuboring.\n\n'
        'Agar to\'lov yaratmadingizmi — ilovadan tarif tanlang va botga qayting.'
    ))


def _handle_support(chat_id: int, from_data: dict, text: str) -> None:
    if not text:
        user_send(chat_id, (
            '💬 <b>Yordamga murojaat</b>\n\n'
            'Murojaatingizni quyidagi shaklda yuboring:\n'
            '<code>/support sizning xabaringiz</code>\n\n'
            '<b>Misol:</b>\n'
            '<code>/support To\'lov yuborishda muammo bor</code>\n\n'
            'Xabaringiz to\'g\'ridan-to\'g\'ri adminlarga yetadi.'
        ))
        return

    sent = forward_support_to_admins('@pravaXAdminBot (to\'lov bot)', from_data, text)
    if sent > 0:
        user_send(chat_id, (
            '✅ Murojaatingiz qabul qilindi.\n\n'
            'Adminlarimiz tez orada javob beradi. Iltimos, sabrli bo\'ling.'
        ))
    else:
        user_send(chat_id, '⚠️ Hozircha admin yo\'q. Iltimos, keyinroq urinib ko\'ring.')


def _handle_start(chat_id: int, payload: str) -> None:
    if not payload:
        user_send(chat_id, (
            '👋 Salom! Bu bot Pro tarif to\'lovlarini qabul qiladi.\n\n'
            'Iltimos, ilovadan Pro tarif tanlab, botga qaytib keling.'
        ))
        return

    try:
        payment = Payment.objects.select_related('user').get(payload_token=payload)
    except Payment.DoesNotExist:
        user_send(chat_id, '❌ To\'lov topilmadi. Ilovadan qaytadan urinib ko\'ring.')
        return

    if payment.status == Payment.Status.APPROVED:
        user_send(chat_id, '✅ Bu to\'lov allaqachon tasdiqlangan.')
        return
    if payment.status == Payment.Status.REJECTED:
        user_send(chat_id, '❌ Bu to\'lov rad etilgan. Iltimos, ilovadan yangi to\'lov yarating.')
        return
    if payment.status == Payment.Status.PENDING:
        user_send(chat_id, '⏳ Bu to\'lov admin tasdiqlashini kutmoqda. Sabr qiling.')
        return

    payment.user_chat_id = chat_id
    payment.status       = Payment.Status.AWAITING
    payment.save(update_fields=['user_chat_id', 'status', 'updated_at'])

    plan_name = 'Pro Monthly (1 oy)' if payment.plan == Payment.Plan.MONTHLY else 'Pro Yearly (1 yil)'
    user_send(chat_id, (
        f'💳 <b>Siz Pro tarif tanladingiz</b>\n\n'
        f'Tarif: <b>{plan_name}</b>\n'
        f'Narx: <b>{int(payment.amount_som):,} so\'m</b>\n\n'
        f'To\'lovni amalga oshirib, chekni quyidagilardan birini yuboring:\n'
        f'📷 Screenshot (rasm)\n'
        f'📄 PDF\n'
        f'📝 DOCX\n\n'
        f'Admin tasdiqlagandan so\'ng Pro tarif aktivlashadi.'
    ))


def _handle_file(chat_id: int, photo, document) -> None:
    payment = (
        Payment.objects
        .filter(user_chat_id=chat_id, status=Payment.Status.AWAITING)
        .order_by('-created_at')
        .first()
    )
    if payment is None:
        user_send(chat_id, '⚠️ Avval ilovadan to\'lov yarating va botga qayting.')
        return

    if photo:
        file_id = photo[-1]['file_id']  # eng katta o'lcham
        kind    = 'photo'
    else:
        file_id = document['file_id']
        kind    = 'document'

    receive_payment_file(payment, file_id, kind)
    user_send(chat_id, (
        '✅ To\'lov chekini qabul qildik!\n\n'
        'Admin tekshirib chiqayotganda kuting. Tasdiqlanganda sizga xabar beriladi.'
    ))
