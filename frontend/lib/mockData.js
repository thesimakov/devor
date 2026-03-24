import { servicesCategoryTree } from "./servicesCategoryTree";

export const fallbackSections = [
  { key: "services", name_ru: "Услуги", phase1_focus: true },
  { key: "realty", name_ru: "Недвижимость", coming_soon: true },
  { key: "transport", name_ru: "Транспорт", coming_soon: true },
];

export const fallbackCategoriesBySection = {
  /** Полное дерево подразделов (этап 1 — услуги). */
  services: servicesCategoryTree,
  realty: [
    { id: 101, name_ru: "Квартиры", slug: "realty-kvartiry", children: [] },
    { id: 102, name_ru: "Дома и дачи", slug: "realty-doma", children: [] },
    { id: 103, name_ru: "Коммерческая недвижимость", slug: "realty-kommercheskaya", children: [] },
  ],
  transport: [
    { id: 201, name_ru: "Легковые авто", slug: "transport-cars", children: [] },
    { id: 202, name_ru: "Мотоциклы", slug: "transport-moto", children: [] },
    { id: 203, name_ru: "Запчасти", slug: "transport-parts", children: [] },
  ],
};

export const fallbackListings = [
  // services (10)
  { id: 9001, title: "Настройка Windows и чистка ноутбуков", description: "Установка программ и ускорение работы ПК.", price: 120, city: "Душанбе", section: "services", category_slug: "kompyuternaya-pomosh", cover_image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80" },
  { id: 9002, title: "Ремонт квартир под ключ", description: "Штукатурка, плитка, электрика. Смета бесплатно.", price: null, city: "Худжанд", section: "services", category_slug: "remont-otdelka", cover_image_url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80" },
  { id: 9003, title: "Услуги сантехника 24/7", description: "Протечки, смесители, бойлеры, подключение техники.", price: 90, city: "Душанбе", section: "services", category_slug: "santehnika", cover_image_url: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200&q=80" },
  { id: 9004, title: "Электрик: монтаж и диагностика", description: "Проводка, автоматы, розетки, освещение.", price: 110, city: "Кулоб", section: "services", category_slug: "elektrika", cover_image_url: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&q=80" },
  { id: 9005, title: "Маникюр и педикюр на дому", description: "Стерильный инструмент, выезд по городу.", price: 85, city: "Бохтар", section: "services", category_slug: "beauty-manikyur-pedikyur", cover_image_url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80" },
  { id: 9006, title: "Косметологические процедуры", description: "Чистка лица, уход и консультация.", price: 180, city: "Худжанд", section: "services", category_slug: "beauty-kosmetologiya", cover_image_url: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=1200&q=80" },
  { id: 9007, title: "Фотосъемка мероприятий", description: "Свадьбы и ивенты, готовые фото за 48 часов.", price: 450, city: "Турсунзода", section: "services", category_slug: "photo-video", cover_image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&q=80" },
  { id: 9008, title: "Кейтеринг и доставка еды", description: "Бизнес-ланчи и банкетное меню.", price: 250, city: "Истаравшан", section: "services", category_slug: "dostavka-produktov", cover_image_url: "https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&q=80" },
  { id: 9009, title: "Грузоперевозки по Таджикистану", description: "Доставка мебели и стройматериалов.", price: 300, city: "Душанбе", section: "services", category_slug: "perevozki-dostavka", cover_image_url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&q=80" },
  { id: 9010, title: "Курсы английского и IELTS", description: "Индивидуальные и групповые занятия.", price: 220, city: "Худжанд", section: "services", category_slug: "obuchenie-kursy", cover_image_url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80" },

  // realty (10)
  { id: 9011, title: "2-комнатная квартира, 65 м²", description: "Новый ремонт, центр города.", price: 420000, city: "Душанбе", section: "realty", category_slug: "realty-kvartiry", cover_image_url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80" },
  { id: 9012, title: "1-комнатная квартира, новостройка", description: "Светлая квартира 40 м².", price: 285000, city: "Бохтар", section: "realty", category_slug: "realty-kvartiry", cover_image_url: "https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=1200&q=80" },
  { id: 9013, title: "3-комнатная квартира с мебелью", description: "Готова к заселению.", price: 510000, city: "Худжанд", section: "realty", category_slug: "realty-kvartiry", cover_image_url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=80" },
  { id: 9014, title: "Дом 180 м² с участком", description: "Сад и гараж на 2 машины.", price: 790000, city: "Кулоб", section: "realty", category_slug: "realty-doma", cover_image_url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80" },
  { id: 9015, title: "Дача у реки, 12 соток", description: "Летний дом и беседка.", price: 340000, city: "Турсунзода", section: "realty", category_slug: "realty-doma", cover_image_url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80" },
  { id: 9016, title: "Коттедж с террасой", description: "Панорамные окна, теплые полы.", price: 980000, city: "Душанбе", section: "realty", category_slug: "realty-doma", cover_image_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80" },
  { id: 9017, title: "Офис 120 м² в бизнес-центре", description: "С ремонтом и парковкой.", price: 620000, city: "Душанбе", section: "realty", category_slug: "realty-kommercheskaya", cover_image_url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80" },
  { id: 9018, title: "Помещение под магазин", description: "Первая линия, витринные окна.", price: 470000, city: "Худжанд", section: "realty", category_slug: "realty-kommercheskaya", cover_image_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80" },
  { id: 9019, title: "Склад 300 м²", description: "Охраняемая территория.", price: 560000, city: "Бохтар", section: "realty", category_slug: "realty-kommercheskaya", cover_image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80" },
  { id: 9020, title: "Студия 35 м² в центре", description: "Отлично для аренды.", price: 240000, city: "Истаравшан", section: "realty", category_slug: "realty-kvartiry", cover_image_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80" },

  // transport (10)
  { id: 9021, title: "Toyota Camry 2018", description: "Один владелец, отличное состояние.", price: 168000, city: "Бохтар", section: "transport", category_slug: "transport-cars", cover_image_url: "https://images.unsplash.com/photo-1493238792000-8113da705763?w=1200&q=80" },
  { id: 9022, title: "Hyundai Elantra 2017", description: "Экономичный седан, камера заднего вида.", price: 122000, city: "Душанбе", section: "transport", category_slug: "transport-cars", cover_image_url: "https://images.unsplash.com/photo-1549924231-f129b911e442?w=1200&q=80" },
  { id: 9023, title: "Lexus RX 350", description: "Полный привод, кожа, отличное состояние.", price: 235000, city: "Худжанд", section: "transport", category_slug: "transport-cars", cover_image_url: "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=1200&q=80" },
  { id: 9024, title: "Mercedes-Benz E-Class", description: "Комфортный бизнес-седан.", price: 210000, city: "Турсунзода", section: "transport", category_slug: "transport-cars", cover_image_url: "https://images.unsplash.com/photo-1617654112328-72fcbfa17433?w=1200&q=80" },
  { id: 9025, title: "Yamaha R3", description: "Городской мотоцикл, обслужен.", price: 62000, city: "Душанбе", section: "transport", category_slug: "transport-moto", cover_image_url: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80" },
  { id: 9026, title: "Honda CB 400", description: "Надежный классик, документы в порядке.", price: 54000, city: "Кулоб", section: "transport", category_slug: "transport-moto", cover_image_url: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200&q=80" },
  { id: 9027, title: "Скутер для города", description: "Экономичный и удобный.", price: 18000, city: "Бохтар", section: "transport", category_slug: "transport-moto", cover_image_url: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=1200&q=80" },
  { id: 9028, title: "Комплект зимних шин R17", description: "Состояние отличное, 1 сезон.", price: 5500, city: "Худжанд", section: "transport", category_slug: "transport-parts", cover_image_url: "https://images.unsplash.com/photo-1592840062661-5f1f8fc7b7f4?w=1200&q=80" },
  { id: 9029, title: "Оригинальные диски Toyota", description: "Комплект 4 шт, без дефектов.", price: 4200, city: "Душанбе", section: "transport", category_slug: "transport-parts", cover_image_url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80" },
  { id: 9030, title: "Аккумулятор 75Ah", description: "Почти новый, проверен.", price: 900, city: "Истаравшан", section: "transport", category_slug: "transport-parts", cover_image_url: "https://images.unsplash.com/photo-1558425635-46f5d6f5e9cf?w=1200&q=80" },
];
