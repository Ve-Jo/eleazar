import { motion } from "framer-motion";
import { getSiteCopy } from "../content/siteContent";
import { useI18n } from "../state/i18n";

const reveal = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export default function LoginPage() {
  const { locale } = useI18n();
  const copy = getSiteCopy(locale);

  return (
    <section className="auth-page">
      <motion.div
        className="auth-shell"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        <motion.span variants={reveal} className="label-kicker">
          {copy.login.kicker}
        </motion.span>
        <motion.h1 variants={reveal}>{copy.login.title}</motion.h1>
        <motion.p variants={reveal}>{copy.login.subtitle}</motion.p>

        <motion.a
          variants={reveal}
          href="/api/auth/discord/login"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="ui-btn ui-btn-primary"
        >
          {copy.shared.oauthCta}
        </motion.a>

        <motion.div variants={reveal} className="auth-notes">
          {copy.login.notes.map((note) => (
            <div key={note} className="auth-note">
              {note}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
