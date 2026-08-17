# Academy Admin API Documentation

## Base URL

```bash
/api/
```

---

# Authentication

## Academy Admin Login

### Endpoint

```http
POST /contests/academy/login/
```

### Description

Akademiya admin username va password orqali tizimga kiradi.

### Request Body

```json
{
  "username": "string",
  "password": "string"
}
```

### Success Response — 200

```json
{
  "token": "string",
  "profile": {
    "id": 1,
    "username": "academy_admin"
  }
}
```

### Error Responses

#### 401 — Login yoki parol noto‘g‘ri

```json
{
  "detail": "Invalid credentials"
}
```

#### 403 — Akademiya faol emas

```json
{
  "detail": "Academy is inactive"
}
```

---

# Profile

## Current Academy Profile

### Endpoint

```http
GET /contests/academy/me/
```

### Description

Joriy academy admin profil ma’lumotlari.

### Response — 200

```json
{
  "id": 0,
  "username": "string",
  "fullname": "string",
  "email": "user@example.com",
  "name": "string",
  "phone": "string",
  "invite_code": "string",
  "balance": "61",
  "is_active": true,
  "last_login": "2026-05-15T04:55:53.183Z",
  "created_at": "2026-05-15T04:55:53.183Z"
}
```

---

# Dashboard

## Dashboard Statistics

### Endpoint

```http
GET /contests/academy/dashboard/
```

### Description

Akademiya statistikasi va dashboard ma’lumotlari.

### Response — 200

```json
{
  "id": 0,
  "name": "string",
  "phone": "string",
  "invite_code": "string",
  "balance": ".28",
  "is_active": true,
  "active_members": "string",
  "total_members": "string",
  "total_income": "string",
  "contest_count": "string",
  "recent_income": "string"
}
```

---

# Students

## Students List

### Endpoint

```http
GET /contests/academy/students/
```

### Description

Akademiyaga qo‘shilgan o‘quvchilar ro‘yxati.

### Response — 200

```json
[
  {
    "id": 0,
    "user": {
      "id": 0,
      "username": "string",
      "email": "user@example.com",
      "first_name": "string",
      "last_name": "string",
      "role": "user",
      "status": "standard",
      "is_premium": true,
      "auth_source": "email",
      "telegram_id": 0,
      "phone_number": "string",
      "photo_url": "string"
    },
    "joined_at": "2026-05-15T04:55:53.166Z",
    "is_active": true
  }
]
```

---

# Quiz Questions

Contest yaratishda savollarni olish uchun Question API ishlatiladi.

## Questions List

### Endpoint

```http
GET /quiz/questions/
```

### Description

Savollar ro‘yxatini olish.

Pagination va filter mavjud.

---

## Query Parameters

| Parameter   | Type    | Description                              |
| ------------| -------- | ---------------------------------------- |
| category    | integer  | Kategoriya ID                            |
| difficulty  | string   | Savol qiyinligi (`easy`, `medium`, `hard`) |
| page        | integer  | Sahifa raqami                            |
| page_size   | integer  | Sahifadagi savollar soni (max 100)       |

---

## Example Request

### Barcha oson savollar

```http
GET /quiz/questions/?difficulty=easy
```

### Kategoriya bo‘yicha

```http
GET /quiz/questions/?category=1
```

### Pagination bilan

```http
GET /quiz/questions/?page=1&page_size=20
```

---

## Response — 200

```json
{
  "count": 123,
  "next": "http://api.example.org/questions/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "number": 1,
      "text_uzl": "Savol matni",
      "text_uzk": "Савол матни",
      "text_ru": "Текст вопроса",
      "difficulty": "easy",
      "category": 2,
      "category_name": "Matematika"
    }
  ]
}
```

---

# Contest Workflow

## Contest yaratish jarayoni

### 1. Savollarni olish

Avval Question API orqali savollar olinadi.

```http
GET /quiz/questions/
```

Misol:

```http
GET /quiz/questions/?category=2&difficulty=medium&page_size=10
```

Response ichidagi `id` lar olinadi.

---

### 2. Contest yaratish

Olingan savol ID lar `questions` array orqali yuboriladi.

### Endpoint

```http
POST /contests/academy/contests/
```

### Request Body

```json
{
  "title": "Math Contest",
  "description": "Weekly math contest",
  "contest_type": "global",
  "recurrence": "none",
  "start_time": "2026-05-15T10:00:00Z",
  "end_time": "2026-05-15T11:00:00Z",
  "entry_token": 10,
  "question_count": 10,
  "time_limit": 1800,
  "question_source": "custom",
  "questions": [1, 2, 3, 4, 5]
}
```

---

# Contests

## Get Academy Contests

### Endpoint

```http
GET /contests/academy/contests/
```

### Description

Academy admin o‘z contestlarini ko‘radi.

### Response — 200

```json
[
  {
    "id": 0,
    "title": "string",
    "description": "string",
    "contest_type": "global",
    "recurrence": "none",
    "status": "upcoming",
    "start_time": "2026-05-15T04:55:53.176Z",
    "end_time": "2026-05-15T04:55:53.176Z",
    "entry_token": 2147483647,
    "question_count": 2147483647,
    "time_limit": 2147483647,
    "participants_count": 0,
    "is_joined": "string",
    "time_remaining": "string"
  }
]
```

---

## Create Contest

### Endpoint

```http
POST /contests/academy/contests/
```

### Description

Yangi contest yaratish.

### Request Body

```json
{
  "title": "string",
  "description": "string",
  "contest_type": "global",
  "recurrence": "none",
  "start_time": "2026-05-15T04:55:53.137Z",
  "end_time": "2026-05-15T04:55:53.137Z",
  "entry_token": 2147483647,
  "question_count": 2147483647,
  "time_limit": 2147483647,
  "question_source": "custom",
  "categories": [0],
  "questions": [0]
}
```

---

## Contest Fields

| Field              | Type      | Description                          |
| ------------------ | ---------- | ------------------------------------ |
| title              | string     | Contest nomi                         |
| description        | string     | Contest tavsifi                      |
| contest_type       | string     | Contest turi                         |
| recurrence         | string     | Takrorlanish turi                    |
| start_time         | datetime   | Boshlanish vaqti                     |
| end_time           | datetime   | Tugash vaqti                         |
| entry_token        | integer    | Contestga kirish tokeni              |
| question_count     | integer    | Savollar soni                        |
| time_limit         | integer    | Vaqt limiti (sekund)                 |
| question_source    | string     | Savollar manbasi                     |
| categories         | integer[]  | Kategoriya ID lar                    |
| questions          | integer[]  | Savol ID lar                         |

---

## Question Source Types

| Value      | Description                          |
| -----------| ------------------------------------ |
| custom     | Qo‘lda tanlangan savollar            |
| category   | Kategoriya orqali avtomatik savollar |

---

## Example — Custom Questions

```json
{
  "question_source": "custom",
  "questions": [1, 2, 3, 4, 5]
}
```

---

## Example — Category Questions

```json
{
  "question_source": "category",
  "categories": [1, 2]
}
```

---

# Contest Ranking

## Get Contest Ranking

### Endpoint

```http
GET /contests/academy/contests/{id}/ranking/
```

### Description

Contest reytingini olish.

### Path Parameters

| Parameter | Type    | Description |
| ---------- | ------- | ----------- |
| id         | integer | Contest ID  |

### Response — 200

```json
[
  {
    "rank": 1,
    "user": {
      "id": 1,
      "username": "student1"
    },
    "correct_count": 18,
    "wrong_count": 2,
    "duration_secs": 1200,
    "finished_at": "2026-05-15T04:55:53.179Z"
  }
]
```

---

# Income

## Income History

### Endpoint

```http
GET /contests/academy/income/
```

### Description

Academy daromad yozuvlari.

### Response — 200

```json
[
  {
    "id": 0,
    "user": {
      "id": 0,
      "username": "string"
    },
    "plan": "Premium",
    "amount_som": "50000",
    "created_at": "2026-05-15T04:55:53.181Z"
  }
]
```

---

# Authorization

Barcha protected endpointlarda Bearer Token ishlatiladi.

## Example

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

# Notes

- API JSON formatda ishlaydi.
- Contest yaratishda `questions` yoki `categories` ishlatiladi.
- `question_source=custom` bo‘lsa `questions` yuboriladi.
- `question_source=category` bo‘lsa `categories` yuboriladi.
- Questions API pagination qo‘llab-quvvatlaydi.
- `page_size` maksimum qiymati 100.
- Contest yaratish uchun academy admin bo‘lish kerak.
