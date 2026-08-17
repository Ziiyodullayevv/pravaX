#!/usr/bin/env python3
"""
Telegram bot long-polling script.
Supervisor orqali ishga tushiriladi: /etc/supervisor/conf.d/prava_tgbot.conf
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'root.settings')

import django
django.setup()

from django.conf import settings
from django.db import close_old_connections
from users.telegram_bot import handle_update

BASE_URL = f'https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}'


def get_updates(offset: int) -> list:
    url = f'{BASE_URL}/getUpdates?offset={offset}&timeout=30&allowed_updates=["message"]'
    try:
        with urllib.request.urlopen(url, timeout=35) as resp:
            return json.loads(resp.read()).get('result', [])
    except urllib.error.URLError as e:
        print(f'[WARN] getUpdates: {e}', flush=True)
        time.sleep(5)
        return []


def main():
    print('[INFO] Telegram bot polling boshlandi', flush=True)
    offset = 0
    while True:
        try:
            updates = get_updates(offset)
            for update in updates:
                # DB connection eskirgan/uzilgan bo'lsa tozalash (idle uzun bo'lganda)
                close_old_connections()
                try:
                    handle_update(update)
                except Exception as e:
                    print(f'[ERR] update {update.get("update_id")}: {e}', flush=True)
                offset = update['update_id'] + 1
        except Exception as e:
            print(f'[ERR] polling: {e}', flush=True)
            close_old_connections()
            time.sleep(5)


if __name__ == '__main__':
    main()
