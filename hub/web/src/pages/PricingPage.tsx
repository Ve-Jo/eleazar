import { motion } from "framer-motion";
import { getSiteCopy } from "../content/siteContent";
import { useI18n } from "../state/i18n";

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

export default function PricingPage() {
  const { locale } = useI18n();
  const copy = getSiteCopy(locale).pricing;

  return (
    <section className="pricing-page">
      <motion.header
        className="section-head"
        initial="hidden"
        animate="show"
        variants={reveal}
        transition={{ duration: 0.55 }}
      >
        <span className="label-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </motion.header>

      <motion.div
        className="plans"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        {copy.plans.map((plan) => (
          <motion.article
            key={plan.name}
            className={`plan-row${plan.highlight ? " plan-row--highlight" : ""}`}
            variants={reveal}
            transition={{ duration: 0.45 }}
            whileHover={{ y: -2 }}
          >
            <div className="plan-name">
              <h2>{plan.name}</h2>
              <span className="plan-state">{plan.state}</span>
            </div>

            <div className="plan-copy">
              <p>{plan.blurb}</p>
              <ul>
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            <motion.a
              href="/api/auth/discord/login"
              className={`ui-btn ${plan.highlight ? "ui-btn-primary" : "ui-btn-secondary"}`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {plan.cta}
            </motion.a>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
