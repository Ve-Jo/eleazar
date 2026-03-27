import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { getSiteCopy } from "../content/siteContent";
import { useI18n } from "../state/i18n";

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

export default function FeaturesPage() {
  const { locale } = useI18n();
  const siteCopy = getSiteCopy(locale);
  const copy = siteCopy.features;
  const headerRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: headerRef, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 18, reduceMotion ? 0 : -18]);

  return (
    <section className="features-page">
      <motion.header
        ref={headerRef}
        className="section-head"
        style={{ y: headerY }}
        initial="hidden"
        animate="show"
        variants={reveal}
        transition={{ duration: 0.55 }}
      >
        <span className="label-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </motion.header>

      <motion.section
        className="track-grid"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        <h2>{copy.trackTitle}</h2>
        {copy.tracks.map((item) => (
          <motion.article key={item.title} className="track-item" variants={reveal} transition={{ duration: 0.45 }}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </motion.article>
        ))}
      </motion.section>

      <motion.section
        className="section-head"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={reveal}
        transition={{ duration: 0.45 }}
      >
        <h2>{copy.outcomesTitle}</h2>
        <div className="outcomes-row">
          {copy.outcomes.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="final-cta"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={reveal}
        transition={{ duration: 0.45 }}
      >
        <div className="section-head">
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaBody}</p>
        </div>
        <motion.a href="/api/auth/discord/login" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="ui-btn ui-btn-primary">
          {siteCopy.shared.oauthCta}
        </motion.a>
      </motion.section>
    </section>
  );
}
