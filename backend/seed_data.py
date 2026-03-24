import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy.orm import Session
from passlib.context import CryptContext

from models import Category, Listing, ListingImage, ListingStatus, Section, User, UserRole


DEFAULT_CATEGORIES = [
    {"name_ru": "Автосервис, аренда", "name_tj": "Хизматрасонии авто, иҷора", "slug": "avtoservis-arenda"},
    {"name_ru": "Перевозки и доставка", "name_tj": "Нақлиёт ва расондан", "slug": "perevozki-dostavka"},
    {"name_ru": "Пассажирские перевозки", "name_tj": "Нақлиёти мусофиркаш", "slug": "passazhirskie-perevozki"},
    {"name_ru": "Грузчики, складские услуги", "name_tj": "Боркашон, хизматҳои анбор", "slug": "gruzchiki-sklad"},
    {"name_ru": "Услуги эвакуатора", "name_tj": "Хизматҳои эвакуатор", "slug": "evakuator"},
    {"name_ru": "Ремонт и отделка", "name_tj": "Таъмир ва пардоз", "slug": "remont-otdelka"},
    {"name_ru": "Строительство", "name_tj": "Сохтмон", "slug": "stroitelstvo"},
    {"name_ru": "Сад, благоустройство", "name_tj": "Боғ ва ободонӣ", "slug": "sad-blagoustroystvo"},
    {"name_ru": "Компьютерная помощь", "name_tj": "Кумаки компютерӣ", "slug": "kompyuternaya-pomosh"},
    {"name_ru": "Красота", "name_tj": "Зебоӣ", "slug": "krasota"},
    {"name_ru": "Здоровье", "name_tj": "Саломатӣ", "slug": "zdorovie"},
    {"name_ru": "Ремонт и обслуживание техники", "name_tj": "Таъмир ва хизматрасонии техника", "slug": "remont-tehniki"},
    {"name_ru": "Оборудование, производство", "name_tj": "Таҷҳизот ва истеҳсолот", "slug": "oborudovanie-proizvodstvo"},
    {"name_ru": "Обучение, курсы", "name_tj": "Омӯзиш ва курсҳо", "slug": "obuchenie-kursy"},
    {"name_ru": "Деловые услуги", "name_tj": "Хизматҳои тиҷоратӣ", "slug": "delovye-uslugi"},
    {"name_ru": "Услуги посредников", "name_tj": "Хизматҳои миёнаравон", "slug": "uslugi-posrednikov"},
    {"name_ru": "Вывоз мусора и вторсырья", "name_tj": "Баровардани партов ва ашёи дуюм", "slug": "vyvoz-musora"},
    {"name_ru": "Уборка", "name_tj": "Тозакунӣ", "slug": "uborka"},
    {"name_ru": "Бытовые услуги", "name_tj": "Хизматҳои маишӣ", "slug": "bytovye-uslugi"},
    {"name_ru": "Праздники, мероприятия", "name_tj": "Идҳо ва чорабиниҳо", "slug": "prazdniki-meropriyatiya"},
    {"name_ru": "Доставка продуктов, десертов, кейтеринг", "name_tj": "Расонидани маҳсулот, десерт ва кейтеринг", "slug": "dostavka-produktov"},
    {"name_ru": "Фото- и видеосъёмка", "name_tj": "Аксбардорӣ ва наворбардорӣ", "slug": "photo-video"},
    {"name_ru": "Искусство", "name_tj": "Санъат", "slug": "iskusstvo"},
    {"name_ru": "Другое", "name_tj": "Дигар", "slug": "drugoe"},
]


REPAIR_CHILDREN = [
    {"name_ru": "Сантехника", "name_tj": "Сантехника", "slug": "santehnika"},
    {"name_ru": "Электрика", "name_tj": "Барқкорӣ", "slug": "elektrika"},
    {"name_ru": "Малярные работы", "name_tj": "Рангубор", "slug": "malyarnye-raboty"},
    {"name_ru": "Плиточные работы", "name_tj": "Кафелкорӣ", "slug": "plitochnye-raboty"},
]


EQUIPMENT_CHILDREN = [
    {"name_ru": "Аренда оборудования", "name_tj": "Иҷораи таҷҳизот", "slug": "arenda-oborudovaniya"},
]

BEAUTY_CHILDREN = [
    {"name_ru": "Маникюр, педикюр", "name_tj": "Маникюр, педикюр", "slug": "beauty-manikyur-pedikyur"},
    {"name_ru": "Услуги парикмахера", "name_tj": "Хизматҳои сартарош", "slug": "beauty-parikmaherskie-uslugi"},
    {"name_ru": "Ресницы, брови", "name_tj": "Мижгон ва абрувон", "slug": "beauty-resnitsy-brovi"},
    {"name_ru": "Перманентный макияж", "name_tj": "Ороиши доимӣ", "slug": "beauty-permanentnyy-makiyazh"},
    {"name_ru": "Косметология", "name_tj": "Косметология", "slug": "beauty-kosmetologiya"},
    {"name_ru": "Эпиляция", "name_tj": "Эпилятсия", "slug": "beauty-epilyatsiya"},
    {"name_ru": "Макияж", "name_tj": "Ороиш", "slug": "beauty-makiyazh"},
    {"name_ru": "СПА-услуги, массаж", "name_tj": "Хизматҳои SPA, массаж", "slug": "beauty-spa-massazh"},
    {"name_ru": "Тату, пирсинг", "name_tj": "Тату ва пирсинг", "slug": "beauty-tatu-pirsing"},
    {"name_ru": "Аренда рабочего места", "name_tj": "Иҷораи ҷои кор", "slug": "beauty-arenda-rabochego-mesta"},
    {"name_ru": "Другое", "name_tj": "Дигар", "slug": "beauty-drugoe"},
]


REALTY_CATEGORIES = [
    {"name_ru": "Квартиры", "name_tj": "Ҳуҷраҳо", "slug": "realty-kvartiry"},
    {"name_ru": "Дома, дачи", "name_tj": "Хона ва дача", "slug": "realty-doma"},
    {"name_ru": "Коммерческая недвижимость", "name_tj": "Амволи тиҷоратӣ", "slug": "realty-kommercheskaya"},
]


TRANSPORT_CATEGORIES = [
    {"name_ru": "Легковые авто", "name_tj": "Мошинҳои сабукрав", "slug": "transport-cars"},
    {"name_ru": "Мотоциклы", "name_tj": "Мотосиклҳо", "slug": "transport-moto"},
    {"name_ru": "Запчасти", "name_tj": "Қисмҳои эҳтиётӣ", "slug": "transport-parts"},
]


DEMO_LISTINGS = [
    # SERVICES (10)
    {
        "section": "services",
        "category_slug": "kompyuternaya-pomosh",
        "title": "Настройка Windows и чистка ноутбуков",
        "description": "Выезд по Душанбе в день обращения. Установка программ, драйверов, ускорение работы ПК.",
        "price": 120,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80"],
        "promoted_days": 21,
    },
    {
        "section": "services",
        "category_slug": "remont-otdelka",
        "title": "Ремонт квартир под ключ",
        "description": "Бригада с опытом 10+ лет. Штукатурка, покраска, плитка, электрика. Смета бесплатно.",
        "price": None,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80"],
        "promoted_days": 14,
    },
    {
        "section": "services",
        "category_slug": "santehnika",
        "title": "Услуги сантехника 24/7",
        "description": "Устраним протечки, заменим смесители, подключим бойлер и стиральную машину.",
        "price": 90,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "elektrika",
        "title": "Электрик: монтаж и диагностика",
        "description": "Проводка, автоматы, розетки, освещение. Безопасно и с гарантией.",
        "price": 110,
        "city": "Кулоб",
        "images": ["https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "beauty-manikyur-pedikyur",
        "title": "Маникюр и педикюр на дому",
        "description": "Стерильный инструмент, современный дизайн, выезд по городу.",
        "price": 85,
        "city": "Бохтар",
        "images": ["https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "beauty-kosmetologiya",
        "title": "Косметологические процедуры",
        "description": "Чистка лица, уход, консультация и подбор домашнего ухода.",
        "price": 180,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "photo-video",
        "title": "Фотосъемка мероприятий",
        "description": "Свадьбы, дни рождения, корпоративы. Готовые фото в течение 48 часов.",
        "price": 450,
        "city": "Турсунзода",
        "images": ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "dostavka-produktov",
        "title": "Кейтеринг и доставка еды",
        "description": "Бизнес-ланчи, банкетное меню, доставка для офисов и мероприятий.",
        "price": 250,
        "city": "Истаравшан",
        "images": ["https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "perevozki-dostavka",
        "title": "Грузоперевозки по Таджикистану",
        "description": "Доставим мебель, стройматериалы и технику. Аккуратные грузчики.",
        "price": 300,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&q=80"],
    },
    {
        "section": "services",
        "category_slug": "obuchenie-kursy",
        "title": "Курсы английского и IELTS",
        "description": "Группы и индивидуальные занятия. Подготовка к экзаменам и собеседованиям.",
        "price": 220,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80"],
    },
    # REALTY (10)
    {
        "section": "realty",
        "category_slug": "realty-kvartiry",
        "title": "2-комнатная квартира, 65 м²",
        "description": "Новый ремонт, центр города, рядом школа и садик. Без посредников.",
        "price": 420000,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-kvartiry",
        "title": "1-комнатная квартира, новостройка",
        "description": "Светлая квартира, 40 м², лифт, охраняемый двор.",
        "price": 285000,
        "city": "Бохтар",
        "images": ["https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-kvartiry",
        "title": "3-комнатная квартира с мебелью",
        "description": "Полностью меблирована, техника включена, готова к заселению.",
        "price": 510000,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-doma",
        "title": "Дом 180 м² с участком",
        "description": "Тихий район, фруктовый сад, гараж на 2 машины.",
        "price": 790000,
        "city": "Кулоб",
        "images": ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-doma",
        "title": "Дача у реки, 12 соток",
        "description": "Летний дом, беседка, вода и электричество подключены.",
        "price": 340000,
        "city": "Турсунзода",
        "images": ["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-doma",
        "title": "Коттедж с террасой",
        "description": "Современный дом, панорамные окна, теплые полы.",
        "price": 980000,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-kommercheskaya",
        "title": "Офис 120 м² в бизнес-центре",
        "description": "С ремонтом, отдельный вход, парковка для клиентов.",
        "price": 620000,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-kommercheskaya",
        "title": "Помещение под магазин",
        "description": "Первая линия, высокий трафик, витринные окна.",
        "price": 470000,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-kommercheskaya",
        "title": "Склад 300 м²",
        "description": "Удобный подъезд для фур, охраняемая территория.",
        "price": 560000,
        "city": "Бохтар",
        "images": ["https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"],
    },
    {
        "section": "realty",
        "category_slug": "realty-kvartiry",
        "title": "Студия 35 м² в центре",
        "description": "Идеально для аренды, пешком до транспорта и рынка.",
        "price": 240000,
        "city": "Истаравшан",
        "images": ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80"],
    },
    # TRANSPORT (10)
    {
        "section": "transport",
        "category_slug": "transport-cars",
        "title": "Toyota Camry 2018",
        "description": "Автомат, бензин, в отличном состоянии. Один владелец, пробег родной.",
        "price": 168000,
        "city": "Бохтар",
        "images": ["https://images.unsplash.com/photo-1493238792000-8113da705763?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-cars",
        "title": "Hyundai Elantra 2017",
        "description": "Экономичный седан, кондиционер, камера заднего вида.",
        "price": 122000,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1549924231-f129b911e442?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-cars",
        "title": "Lexus RX 350",
        "description": "Полный привод, кожа, аккуратная эксплуатация.",
        "price": 235000,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1550355291-bbee04a92027?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-cars",
        "title": "Mercedes-Benz E-Class",
        "description": "Комфортный бизнес-седан, сервисная история.",
        "price": 210000,
        "city": "Турсунзода",
        "images": ["https://images.unsplash.com/photo-1617654112328-72fcbfa17433?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-moto",
        "title": "Yamaha R3",
        "description": "Отличный городской мотоцикл, обслужен, готов к сезону.",
        "price": 62000,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-moto",
        "title": "Honda CB 400",
        "description": "Надежный классик, документы в порядке.",
        "price": 54000,
        "city": "Кулоб",
        "images": ["https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-moto",
        "title": "Скутер для города",
        "description": "Экономичный, легкий в управлении, свежая резина.",
        "price": 18000,
        "city": "Бохтар",
        "images": ["https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-parts",
        "title": "Комплект зимних шин R17",
        "description": "Состояние отличное, 1 сезон использования.",
        "price": 5500,
        "city": "Худжанд",
        "images": ["https://images.unsplash.com/photo-1592840062661-5f1f8fc7b7f4?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-parts",
        "title": "Оригинальные диски Toyota",
        "description": "Без сварки, без трещин, комплект 4 шт.",
        "price": 4200,
        "city": "Душанбе",
        "images": ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80"],
    },
    {
        "section": "transport",
        "category_slug": "transport-parts",
        "title": "Аккумулятор 75Ah",
        "description": "Почти новый аккумулятор, проверен под нагрузкой.",
        "price": 900,
        "city": "Истаравшан",
        "images": ["https://images.unsplash.com/photo-1558425635-46f5d6f5e9cf?w=1200&q=80"],
    },
]
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_or_create_section(db: Session, key: str, name_ru: str, name_tj: str, slug: str) -> Section:
    section = db.query(Section).filter(Section.key == key).first()
    if section:
        return section
    section = Section(key=key, name_ru=name_ru, name_tj=name_tj, slug=slug)
    db.add(section)
    db.flush()
    return section


def _seed_section_categories(db: Session, section: Section, categories: list[dict]) -> None:
    existing = db.query(Category.id).filter(Category.section_id == section.id).first()
    if existing:
        return
    for item in categories:
        db.add(
            Category(
                section_id=section.id,
                name_ru=item["name_ru"],
                name_tj=item["name_tj"],
                slug=item["slug"],
                level=0,
            )
        )


def _sync_services_category_tree_from_json(db: Session, section_id: int, json_path: Path) -> bool:
    """Импорт полного дерева «Услуги» из frontend/lib/services_category_tree.json (идемпотентно)."""
    if not json_path.is_file():
        return False
    with json_path.open(encoding="utf-8") as f:
        tree: list[dict] = json.load(f)

    def upsert(nodes: list[dict], parent_id: int | None, level: int) -> None:
        for node in nodes:
            slug = node["slug"]
            name_ru = node["name_ru"]
            name_tj = node.get("name_tj") or name_ru
            existing = (
                db.query(Category)
                .filter(Category.section_id == section_id, Category.slug == slug)
                .first()
            )
            if existing:
                existing.name_ru = name_ru
                existing.name_tj = name_tj
                existing.parent_id = parent_id
                existing.level = level
                row = existing
            else:
                row = Category(
                    section_id=section_id,
                    name_ru=name_ru,
                    name_tj=name_tj,
                    slug=slug,
                    parent_id=parent_id,
                    level=level,
                )
                db.add(row)
                db.flush()
            children = node.get("children") or []
            if children:
                upsert(children, row.id, level + 1)

    upsert(tree, None, 0)
    return True


def _ensure_children_for_parent(db: Session, section_id: int, parent_slug: str, children: list[dict]) -> None:
    parent = db.query(Category).filter(Category.section_id == section_id, Category.slug == parent_slug).first()
    if not parent:
        return

    for item in children:
        exists = (
            db.query(Category.id)
            .filter(
                Category.section_id == section_id,
                Category.slug == item["slug"],
            )
            .first()
        )
        if exists:
            continue
        db.add(
            Category(
                section_id=section_id,
                name_ru=item["name_ru"],
                name_tj=item["name_tj"],
                slug=item["slug"],
                parent_id=parent.id,
                level=parent.level + 1,
            )
        )


def seed_categories(db: Session) -> None:
    services_section = _get_or_create_section(db, "services", "Услуги", "Хизматҳо", "services")
    _get_or_create_section(db, "realty", "Недвижимость", "Амволи ғайриманқул", "realty")
    _get_or_create_section(db, "transport", "Транспорт", "Нақлиёт", "transport")

    services_json = Path(__file__).resolve().parent.parent / "frontend" / "lib" / "services_category_tree.json"
    synced = _sync_services_category_tree_from_json(db, services_section.id, services_json)

    if not synced and not db.query(Category.id).filter(Category.section_id == services_section.id).first():
        created: dict[str, Category] = {}
        for item in DEFAULT_CATEGORIES:
            category = Category(
                section_id=services_section.id,
                name_ru=item["name_ru"],
                name_tj=item["name_tj"],
                slug=item["slug"],
                level=0,
            )
            db.add(category)
            db.flush()
            created[item["slug"]] = category

        repair_parent = created["remont-otdelka"]
        for child in REPAIR_CHILDREN:
            db.add(
                Category(
                    section_id=services_section.id,
                    name_ru=child["name_ru"],
                    name_tj=child["name_tj"],
                    slug=child["slug"],
                    parent_id=repair_parent.id,
                    level=1,
                )
            )

        equipment_parent = created["oborudovanie-proizvodstvo"]
        for child in EQUIPMENT_CHILDREN:
            db.add(
                Category(
                    section_id=services_section.id,
                    name_ru=child["name_ru"],
                    name_tj=child["name_tj"],
                    slug=child["slug"],
                    parent_id=equipment_parent.id,
                    level=1,
                )
            )

    realty_section = db.query(Section).filter(Section.key == "realty").first()
    transport_section = db.query(Section).filter(Section.key == "transport").first()
    if realty_section:
        _seed_section_categories(db, realty_section, REALTY_CATEGORIES)
    if transport_section:
        _seed_section_categories(db, transport_section, TRANSPORT_CATEGORIES)

    if not synced:
        _ensure_children_for_parent(db, services_section.id, "remont-otdelka", REPAIR_CHILDREN)
        _ensure_children_for_parent(db, services_section.id, "oborudovanie-proizvodstvo", EQUIPMENT_CHILDREN)
        _ensure_children_for_parent(db, services_section.id, "krasota", BEAUTY_CHILDREN)

    db.commit()


def seed_staff_users(db: Session) -> None:
    """Учётки для панели /staff (логин + пароль; смените в продакшене)."""
    if not db.query(User).filter(User.login == "admin").first():
        db.add(
            User(
                login="admin",
                password_hash=pwd_context.hash("admin"),
                name="Главный админ (создатели)",
                role=UserRole.ADMIN,
                phone="+992 90 999 99 01",
                balance_som=Decimal("0"),
            )
        )
    if not db.query(User).filter(User.login == "manager").first():
        db.add(
            User(
                login="manager",
                password_hash=pwd_context.hash("manager_devor_change_me"),
                name="Менеджер модерации",
                role=UserRole.MANAGER,
                phone="+992 90 999 99 02",
                balance_som=Decimal("0"),
            )
        )
    db.commit()


def seed_demo_listings(db: Session) -> None:
    demo_user = db.query(User).filter(User.login == "demo").first()
    if not demo_user:
        demo_user = User(
            login="demo",
            password_hash=pwd_context.hash("demo12345"),
            name="Demo Seller",
            role=UserRole.USER,
            phone="+992 90 111 22 33",
            balance_som=Decimal("500"),
        )
        db.add(demo_user)
        db.flush()
    else:
        if (demo_user.balance_som or Decimal("0")) < Decimal("50"):
            demo_user.balance_som = Decimal("500")
            db.commit()

    existing_titles = {title for (title,) in db.query(Listing.title).all()}

    for item in DEMO_LISTINGS:
        if item["title"] in existing_titles:
            continue
        section = db.query(Section).filter(Section.key == item["section"]).first()
        if not section:
            continue
        category = (
            db.query(Category)
            .filter(Category.section_id == section.id, Category.slug == item["category_slug"])
            .first()
        )
        if not category:
            continue

        promo_days = item.get("promoted_days")
        promoted_until = (
            datetime.now(timezone.utc) + timedelta(days=int(promo_days)) if promo_days else None
        )
        listing = Listing(
            title=item["title"],
            description=item["description"],
            price=item["price"],
            category_id=category.id,
            user_id=demo_user.id,
            city=item["city"],
            views_count=0,
            status=ListingStatus.ACTIVE,
            promoted_until=promoted_until,
        )
        db.add(listing)
        db.flush()
        existing_titles.add(item["title"])

        for index, image_url in enumerate(item["images"]):
            db.add(
                ListingImage(
                    listing_id=listing.id,
                    file_url=image_url,
                    is_primary=index == 0,
                    sort_order=index,
                )
            )
    db.commit()
