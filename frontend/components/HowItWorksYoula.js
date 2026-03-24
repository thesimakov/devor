import { useMemo } from "react";

import { useLanguage } from "../contexts/LanguageContext";
import { CONTENT_IMAGES } from "../lib/contentAssets";

export default function HowItWorksYoula() {
  const { t } = useLanguage();

  const steps = useMemo(
    () => [
      {
        key: "1",
        title: t("how.step1Title"),
        text: t("how.step1Text"),
        img: CONTENT_IMAGES.handshake,
        alt: t("how.step1Alt"),
      },
      {
        key: "2",
        title: t("how.step2Title"),
        text: t("how.step2Text"),
        img: CONTENT_IMAGES.city,
        alt: t("how.step2Alt"),
      },
      {
        key: "3",
        title: t("how.step3Title"),
        text: t("how.step3Text"),
        img: CONTENT_IMAGES.desk,
        alt: t("how.step3Alt"),
      },
    ],
    [t]
  );

  return (
    <section className="youla-section youla-how-section" aria-label={t("how.sectionAria")} aria-labelledby="youla-how-title">
      <div className="youla-how-head">
        <h2 id="youla-how-title" className="youla-section-title">
          {t("how.title")}
        </h2>
        <p className="youla-how-lead">{t("how.lead")}</p>
      </div>
      <div className="youla-how-grid">
        {steps.map((item) => (
          <article key={item.key} className="youla-how-card">
            <div className="youla-how-card-visual">
              <img src={item.img} alt={item.alt} className="youla-how-card-img" width={640} height={360} loading="lazy" />
            </div>
            <h3 className="youla-how-card-title">{item.title}</h3>
            <p className="youla-how-card-text">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
