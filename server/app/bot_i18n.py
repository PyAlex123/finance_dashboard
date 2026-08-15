"""Сообщения Telegram-бота на языке пользователя.

Почему только бот, а не весь сервер. Поле ``detail`` из ответов API до человека
не доходит: фронт его никогда не читает, а показывает собственные сообщения,
выбранные по HTTP-статусу. Значит локализация ``detail`` в main.py не дала бы
видимой пользы — и её сознательно не делаем. Сообщения бота, наоборот,
единственный серверный текст, который пользователь читает глазами, а Telegram
отдаёт язык бесплатно в каждом апдейте (``message.from.language_code``).

Только стандартная библиотека — как и весь bot.py.
"""

DEFAULT_LANG = "ru"

MESSAGES: dict[str, dict[str, str]] = {
    "ru": {
        "login.failed": "Не удалось подготовить вход. Попробуйте ещё раз через минуту.",
        "login.body": (
            "Вход в finlo\n\n"
            "Нажмите кнопку ниже — откроется браузер, и вы сразу окажетесь в кабинете.\n"
            "Ссылка одноразовая и действует несколько минут."
        ),
        "login.open": "🚀 Открыть finlo",
        "login.start": "✅ Начать бесплатно",
        "login.inTelegram": "📱 Открыть здесь, в Telegram",
    },
    "en": {
        "login.failed": "Could not prepare the sign-in. Please try again in a minute.",
        "login.body": (
            "Sign in to finlo\n\n"
            "Press the button below — your browser will open and take you straight "
            "to your workspace.\n"
            "The link is single-use and valid for a few minutes."
        ),
        "login.open": "🚀 Open finlo",
        "login.start": "✅ Start for free",
        "login.inTelegram": "📱 Open here, in Telegram",
    },
    "uz": {
        "login.failed": "Kirishni tayyorlab boʻlmadi. Bir daqiqadan soʻng qayta urinib koʻring.",
        "login.body": (
            "finlo tizimiga kirish\n\n"
            "Quyidagi tugmani bosing — brauzer ochiladi va siz toʻgʻridan-toʻgʻri "
            "ish maydoniga oʻtasiz.\n"
            "Havola bir martalik va bir necha daqiqa amal qiladi."
        ),
        "login.open": "🚀 finlo’ni ochish",
        "login.start": "✅ Bepul boshlash",
        "login.inTelegram": "📱 Shu yerda, Telegram’da ochish",
    },
}


def lang_of(user: dict | None) -> str:
    """Язык пользователя Telegram: «en-GB» → «en». Неизвестный — русский."""
    code = ((user or {}).get("language_code") or "")[:2].lower()
    return code if code in MESSAGES else DEFAULT_LANG


def bt(key: str, user: dict | None) -> str:
    """Строка бота на языке пользователя, с откатом на русский эталон."""
    lang = lang_of(user)
    return MESSAGES[lang].get(key) or MESSAGES[DEFAULT_LANG][key]
