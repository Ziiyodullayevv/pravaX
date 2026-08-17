# pravaX

pravaX — haydovchilik imtihoniga tayyorlanish platformasining yagona monoreposi.

## Tuzilishi

- `apps/mobile` — Expo/React Native mobil ilova (`prava-go`)
- `apps/academy` — pravaX Academy web boshqaruv paneli
- `backend` — Django REST API, quiz va to‘lov servislar

## Ishga tushirish

### Mobil ilova

```bash
cd apps/mobile
yarn install
yarn start
```

### Academy web

```bash
cd apps/academy
yarn install
yarn dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

Maxfiy `.env` fayllar repozitoriyga kiritilmaydi. Ishga tushirishdan oldin muhit o‘zgaruvchilarini alohida sozlang.
