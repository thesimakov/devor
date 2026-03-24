import { CONTENT_IMAGES } from "../lib/contentAssets";

const TIPS = [
  { icon: "🛡️", title: "Проверяйте контакты", text: "Уточняйте детали в чате или по телефону до встречи." },
  { icon: "📍", title: "Договоритесь о месте", text: "Обсудите адрес или выезд, если это услуга на дому." },
  { icon: "💬", title: "Сохраняйте переписку", text: "Важные условия лучше подтвердить письменно в чате." },
];

export default function ListingTipsBlock() {
  return (
    <section className="listing-section listing-tips-block" aria-labelledby="listing-tips-h">
      <div className="listing-tips-layout">
        <div className="listing-tips-copy">
          <h3 id="listing-tips-h">Полезно знать</h3>
          <p className="listing-tips-lead">Несколько советов для безопасной сделки через сервис.</p>
          <ul className="listing-tips-list">
            {TIPS.map((t) => (
              <li key={t.title} className="listing-tips-item">
                <span className="listing-tips-icon" aria-hidden>
                  {t.icon}
                </span>
                <div>
                  <strong>{t.title}</strong>
                  <p>{t.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="listing-tips-visual">
          <img src={CONTENT_IMAGES.listingTips} alt="" className="listing-tips-img" width={480} height={320} loading="lazy" />
        </div>
      </div>
    </section>
  );
}
