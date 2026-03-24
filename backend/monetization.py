"""Тарифы и лимиты монетизации (MVP). В продакшене пополнение заменяется на платёжного провайдера."""

from decimal import Decimal
import os
from typing import Any

# Демо-пополнение кошелька (отключите в проде: DEVOR_DEMO_TOPUP=false)
DEMO_TOPUP_ENABLED = os.getenv("DEVOR_DEMO_TOPUP", "true").lower() in ("1", "true", "yes")

PROMOTION_PACKAGES: list[dict[str, Any]] = [
    {
        "id": "promo_3",
        "days": 3,
        "price_som": Decimal("19"),
        "title": "3 дня в топе",
        "description": "Объявление выше обычных в списках и поиске.",
    },
    {
        "id": "promo_7",
        "days": 7,
        "price_som": Decimal("39"),
        "title": "7 дней в топе",
        "description": "Больше просмотров за неделю.",
    },
    {
        "id": "promo_30",
        "days": 30,
        "price_som": Decimal("129"),
        "title": "30 дней в топе",
        "description": "Максимум видимости на месяц.",
    },
]

TOPUP_PRESETS_SOM = [50, 100, 200, 500]

MIN_TOPUP_SOM = Decimal("10")
MAX_TOPUP_SOM = Decimal("10000")


def get_promotion_package(package_id: str) -> dict[str, Any] | None:
    for pkg in PROMOTION_PACKAGES:
        if pkg["id"] == package_id:
            return pkg
    return None
