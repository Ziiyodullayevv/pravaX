"""Payment botlari uchun Telegram API helper'lari (2 ta bot uchun)."""
import json
import mimetypes
import urllib.error
import urllib.request
import uuid

from django.conf import settings


def _api(token: str, method: str, payload: dict) -> dict:
    if not token:
        return {'ok': False, 'error': 'Bot token configured emas.'}
    url = f'https://api.telegram.org/bot{token}/{method}'
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {'description': str(e)}
        return {'ok': False, **body}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def _api_multipart(token: str, method: str, fields: dict, file_field: str,
                   filename: str, content: bytes) -> dict:
    """multipart/form-data orqali fayl yuklash (botlar orasida fayllarni uzatish uchun)."""
    if not token:
        return {'ok': False, 'error': 'Bot token configured emas.'}
    url = f'https://api.telegram.org/bot{token}/{method}'
    boundary = '----TGBoundary' + uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\n'.encode())
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        parts.append(f'{value}\r\n'.encode())
    ctype = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    parts.append(f'--{boundary}\r\n'.encode())
    parts.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode()
    )
    parts.append(f'Content-Type: {ctype}\r\n\r\n'.encode())
    parts.append(content)
    parts.append(f'\r\n--{boundary}--\r\n'.encode())
    body = b''.join(parts)
    headers = {
        'Content-Type':   f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body)),
    }
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {'description': str(e)}
        return {'ok': False, **body}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


# ─── User Bot ────────────────────────────────────────────────────────────────

def user_send(chat_id: int, text: str, **kwargs) -> dict:
    return _api(settings.PAYMENT_USER_BOT_TOKEN, 'sendMessage', {
        'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', **kwargs,
    })


def user_get_file_url(file_id: str) -> str:
    res = _api(settings.PAYMENT_USER_BOT_TOKEN, 'getFile', {'file_id': file_id})
    file_path = (res.get('result') or {}).get('file_path', '')
    if not file_path:
        return ''
    return f'https://api.telegram.org/file/bot{settings.PAYMENT_USER_BOT_TOKEN}/{file_path}'


# ─── Admin Bot ───────────────────────────────────────────────────────────────

def admin_send(chat_id: int, text: str, **kwargs) -> dict:
    return _api(settings.PAYMENT_ADMIN_BOT_TOKEN, 'sendMessage', {
        'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', **kwargs,
    })


def admin_upload_photo(chat_id: int, content: bytes, filename: str,
                       caption: str = '', reply_markup: dict | None = None) -> dict:
    """Rasm baytlarini admin botga multipart upload qiladi."""
    fields = {
        'chat_id':    str(chat_id),
        'caption':    caption,
        'parse_mode': 'HTML',
    }
    if reply_markup is not None:
        fields['reply_markup'] = json.dumps(reply_markup)
    return _api_multipart(
        settings.PAYMENT_ADMIN_BOT_TOKEN, 'sendPhoto',
        fields, 'photo', filename, content,
    )


def admin_upload_document(chat_id: int, content: bytes, filename: str,
                          caption: str = '', reply_markup: dict | None = None) -> dict:
    """Hujjat baytlarini admin botga multipart upload qiladi."""
    fields = {
        'chat_id':    str(chat_id),
        'caption':    caption,
        'parse_mode': 'HTML',
    }
    if reply_markup is not None:
        fields['reply_markup'] = json.dumps(reply_markup)
    return _api_multipart(
        settings.PAYMENT_ADMIN_BOT_TOKEN, 'sendDocument',
        fields, 'document', filename, content,
    )


def admin_edit_caption(chat_id: int, message_id: int, caption: str, reply_markup: dict | None = None) -> dict:
    payload = {
        'chat_id':    chat_id,
        'message_id': message_id,
        'caption':    caption,
        'parse_mode': 'HTML',
    }
    if reply_markup is not None:
        payload['reply_markup'] = reply_markup
    return _api(settings.PAYMENT_ADMIN_BOT_TOKEN, 'editMessageCaption', payload)


def admin_edit_text(chat_id: int, message_id: int, text: str, reply_markup: dict | None = None) -> dict:
    payload = {
        'chat_id':    chat_id,
        'message_id': message_id,
        'text':       text,
        'parse_mode': 'HTML',
    }
    if reply_markup is not None:
        payload['reply_markup'] = reply_markup
    return _api(settings.PAYMENT_ADMIN_BOT_TOKEN, 'editMessageText', payload)


def admin_answer_callback(callback_id: str, text: str = '', show_alert: bool = False) -> dict:
    return _api(settings.PAYMENT_ADMIN_BOT_TOKEN, 'answerCallbackQuery', {
        'callback_query_id': callback_id,
        'text':              text,
        'show_alert':        show_alert,
    })
