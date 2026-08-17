#!/usr/bin/env python3
"""
Payment bot long-polling. Foydalanish:
    python payment_bot_polling.py --bot user
    python payment_bot_polling.py --bot admin

Supervisor entry namunasi:
    [program:payment_bot_user]
    command=/home/prava_go/venv/bin/python /home/prava_go/payment_bot_polling.py --bot user
    autostart=true
    autorestart=true
    user=root
    stderr_logfile=/var/log/payment_bot_user.err.log
    stdout_logfile=/var/log/payment_bot_user.out.log
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'root.settings')

import django  # noqa: E402
django.setup()

from django.conf import settings  # noqa: E402
from django.db import close_old_connections  # noqa: E402


def get_updates(token: str, offset: int, allowed: list) -> list:
    allowed_str = json.dumps(allowed, separators=(',', ':'))
    url = (
        f'https://api.telegram.org/bot{token}/getUpdates'
        f'?offset={offset}&timeout=30&allowed_updates={allowed_str}'
    )
    try:
        with urllib.request.urlopen(url, timeout=35) as resp:
            return json.loads(resp.read()).get('result', [])
    except urllib.error.URLError as e:
        print(f'[WARN] getUpdates: {e}', flush=True)
        time.sleep(5)
        return []
    except Exception as e:
        print(f'[ERR] getUpdates: {e}', flush=True)
        time.sleep(5)
        return []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bot', choices=['user', 'admin'], required=True)
    args = parser.parse_args()

    if args.bot == 'user':
        token   = settings.PAYMENT_USER_BOT_TOKEN
        from payments.bot_user import handle_user_update as handler
        allowed = ['message']
    else:
        token   = settings.PAYMENT_ADMIN_BOT_TOKEN
        from payments.bot_admin import handle_admin_update as handler
        allowed = ['message', 'callback_query']

    if not token:
        print(f'[ERR] {args.bot} bot tokeni .env da yo\'q. Tugatildi.', flush=True)
        sys.exit(1)

    print(f'[INFO] Payment {args.bot} bot polling boshlandi', flush=True)
    offset = 0
    while True:
        try:
            updates = get_updates(token, offset, allowed)
            for update in updates:
                # DB connection eskirgan/uzilgan bo'lsa tozalash
                close_old_connections()
                try:
                    handler(update)
                except Exception as e:
                    print(f'[ERR] update {update.get("update_id")}: {e}', flush=True)
                offset = update['update_id'] + 1
        except Exception as e:
            print(f'[ERR] polling loop: {e}', flush=True)
            close_old_connections()
            time.sleep(5)


if __name__ == '__main__':
    main()
