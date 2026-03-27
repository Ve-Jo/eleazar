import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, WheelEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { getSiteCopy } from "../content/siteContent";
import { useI18n } from "../state/i18n";

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  const { locale } = useI18n();
  const siteCopy = getSiteCopy(locale);
  const copy = siteCopy.landing;
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [isPreviewAreaActive, setIsPreviewAreaActive] = useState(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(2);
  const [stackLayout, setStackLayout] = useState<Record<string, { x: number; y: number; rotate: number }>>({});
  const [activeScaleByPreviewId, setActiveScaleByPreviewId] = useState<Record<string, number>>({});
  const wheelTimestampRef = useRef(0);
  const previewRefs = useRef<Record<string, HTMLElement | null>>({});
  const heroRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -70]);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 1.03]);
  const previewCount = copy.previews.length;
  const activePreviewId =
    isPreviewAreaActive && previewCount > 0 ? (copy.previews[selectedPreviewIndex]?.id ?? null) : null;
  const activePreviewIndex = activePreviewId
    ? copy.previews.findIndex((preview) => preview.id === activePreviewId)
    : -1;

  useEffect(() => {
    if (selectedPreviewIndex < previewCount) {
      return;
    }
    setSelectedPreviewIndex(Math.max(0, previewCount - 1));
  }, [previewCount, selectedPreviewIndex]);

  useEffect(() => {
    if (!isPreviewHovered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPreviewHovered]);

  const moveSelection = (direction: 1 | -1) => {
    if (previewCount === 0) {
      return;
    }
    setSelectedPreviewIndex((current) => (current + direction + previewCount) % previewCount);
  };

  const handlePreviewWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (previewCount < 2) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 8) {
      return;
    }
    const now = performance.now();
    if (now - wheelTimestampRef.current < 120) {
      return;
    }
    wheelTimestampRef.current = now;
    setIsPreviewAreaActive(true);
    moveSelection(delta > 0 ? 1 : -1);
  };

  const handlePreviewKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (previewCount < 2) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      setIsPreviewAreaActive(true);
      moveSelection(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      setIsPreviewAreaActive(true);
      moveSelection(-1);
    }
  };

  useEffect(() => {
    if (!activePreviewId) {
      setStackLayout({});
      return;
    }

    const activeIndex = copy.previews.findIndex((item) => item.id === activePreviewId);
    if (activeIndex < 0) {
      setStackLayout({});
      return;
    }

    let rafId = 0;
    const recomputeLayout = () => {
      const activeElement = previewRefs.current[activePreviewId];
      if (!activeElement) {
        return;
      }

      const activeRect = activeElement.getBoundingClientRect();
      const nextLayout: Record<string, { x: number; y: number; rotate: number }> = {};

      copy.previews.forEach((preview, index) => {
        if (preview.id === activePreviewId) {
          return;
        }

        const previewElement = previewRefs.current[preview.id];
        if (!previewElement) {
          return;
        }

        const previewRect = previewElement.getBoundingClientRect();
        const side = index < activeIndex ? -1 : 1;
        const peek = Math.max(14, Math.min(28, activeRect.width * 0.1));
        const offsetX = side * (activeRect.width / 2 + previewRect.width / 2 - peek);

        nextLayout[preview.id] = {
          x: offsetX,
          y: side < 0 ? -6 : -4,
          rotate: side < 0 ? -8 : 8,
        };
      });

      setStackLayout(nextLayout);
    };

    const scheduleRecompute = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recomputeLayout);
    };

    scheduleRecompute();
    window.addEventListener("resize", scheduleRecompute);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleRecompute);
    };
  }, [activePreviewId, copy.previews]);

  useEffect(() => {
    let rafId = 0;

    const recomputeScale = () => {
      const widthEntries = copy.previews
        .map((preview) => ({
          id: preview.id,
          width: previewRefs.current[preview.id]?.getBoundingClientRect().width ?? 0,
        }))
        .filter((entry) => entry.width > 0);

      if (widthEntries.length === 0) {
        return;
      }

      const maxWidth = widthEntries.reduce((largest, entry) => Math.max(largest, entry.width), 0);
      const targetActiveWidth = maxWidth * 1.08;
      const nextScaleById: Record<string, number> = {};

      widthEntries.forEach(({ id, width }) => {
        const adaptiveScale = targetActiveWidth / width;
        nextScaleById[id] = Math.min(1.42, Math.max(1.08, adaptiveScale));
      });

      setActiveScaleByPreviewId(nextScaleById);
    };

    const scheduleRecompute = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recomputeScale);
    };

    scheduleRecompute();
    window.addEventListener("resize", scheduleRecompute);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleRecompute);
    };
  }, [copy.previews]);

  return (
    <div className="marketing-page">
      <section className="landing-hero" ref={heroRef}>
        <div className="landing-hero-inner">
          <motion.div
            className="hero-copy"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={reveal} transition={{ duration: 0.45 }} className="hero-brand">
              <span className="label-kicker">{copy.kicker}</span>
            </motion.div>

            <motion.h1 variants={reveal} transition={{ duration: 0.55 }} className="hero-title">
              {copy.title}
            </motion.h1>

            <motion.p variants={reveal} transition={{ duration: 0.55 }} className="hero-subtitle">
              {copy.subtitle}
            </motion.p>

            <motion.div variants={reveal} transition={{ duration: 0.45 }} className="hero-actions">
              <motion.a
                href="/api/auth/discord/login"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="ui-btn ui-btn-primary"
              >
                {copy.primaryCta}
              </motion.a>
              <motion.a href="#systems" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="ui-btn ui-btn-secondary">
                {copy.secondaryCta}
              </motion.a>
            </motion.div>

            <motion.div variants={reveal} transition={{ duration: 0.45 }} className="hero-chip-row">
              {copy.heroChips.map((chip) => (
                <span key={chip} className="hero-chip">
                  {chip}
                </span>
              ))}
            </motion.div>
          </motion.div>

          <motion.div className="hero-visual" style={{ y: visualY, scale: visualScale }}>
            <div
              className={`hero-visual-track${isPreviewAreaActive ? " is-interactive" : ""}`}
              aria-label="Eleazar render previews"
              onMouseEnter={() => {
                setIsPreviewHovered(true);
                setIsPreviewAreaActive(true);
              }}
              onMouseLeave={() => {
                setIsPreviewHovered(false);
                setIsPreviewAreaActive(false);
              }}
              onFocus={() => setIsPreviewAreaActive(true)}
              onBlur={() => setIsPreviewAreaActive(false)}
              onWheel={handlePreviewWheel}
              onKeyDown={handlePreviewKeyDown}
              tabIndex={0}
            >
              {copy.previews.map((preview, index) => (
                <motion.figure
                  key={preview.id}
                  ref={(element) => {
                    previewRefs.current[preview.id] = element;
                  }}
                  className={[
                    "hero-shot",
                    `hero-shot--fan-${index + 1}`,
                    index === 2 ? "hero-shot--primary" : "",
                    activePreviewId === preview.id ? "is-active" : "",
                    activePreviewId !== null && activePreviewId !== preview.id ? "is-stacked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 + index * 0.08, duration: 0.5 }}
                  style={(() => {
                    const style: CSSProperties & Record<string, string> = {};
                    const activeScale = activeScaleByPreviewId[preview.id];
                    if (activeScale && activePreviewId === preview.id) {
                      style["--active-card-scale"] = `${activeScale}`;
                    }

                    const stacked = stackLayout[preview.id];
                    if (!activePreviewId || activePreviewId === preview.id || !stacked) {
                      return Object.keys(style).length > 0 ? style : undefined;
                    }
                    const distanceFromActive =
                      activePreviewIndex >= 0 ? Math.abs(index - activePreviewIndex) : previewCount;
                    style["--stack-x"] = `${stacked.x}px`;
                    style["--stack-y"] = `${stacked.y}px`;
                    style["--stack-rotate"] = `${stacked.rotate}deg`;
                    style["--stack-z"] = `${Math.max(9, 18 - distanceFromActive)}`;
                    return style;
                  })()}
                >
                  <div className="hero-shot-frame">
                    <img
                      src={`/api/render-preview/${preview.id}?locale=${locale}&randomDiscordAvatars=true`}
                      alt={preview.alt}
                      loading="lazy"
                    />
                  </div>
                </motion.figure>
              ))}
              <div className="hero-scroll-hint" aria-hidden="true">
                <span>⇵</span>
                {copy.scrollHint}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section
        id="systems"
        className="marketing-section"
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55 }}
      >
        <div className="section-head">
          <span className="label-kicker">{copy.supportLabel}</span>
          <h2>{copy.supportTitle}</h2>
          <p>{copy.supportBody}</p>
        </div>
        <div className="support-layout">
          <ul className="support-points">
            {copy.supportPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="surface" style={{ padding: "0.55rem" }}>
            <img
              src={`/api/render-preview/gamelauncher?locale=${locale}&randomDiscordAvatars=true`}
              alt={copy.previews[0]?.alt ?? "Eleazar preview"}
              loading="lazy"
              style={{ borderRadius: "14px" }}
            />
          </div>
        </div>
      </motion.section>

      <motion.section
        className="marketing-section"
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55 }}
      >
        <div className="section-head">
          <span className="label-kicker">{copy.detailLabel}</span>
          <h2>{copy.detailTitle}</h2>
          <p>{copy.detailBody}</p>
        </div>
        <div className="detail-grid">
          {copy.detailSteps.map((step, index) => (
            <motion.article
              key={step.title}
              className="detail-step"
              whileHover={{ y: -3 }}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="marketing-section"
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.45 }}
      >
        <div className="final-cta">
          <div className="section-head">
            <span className="label-kicker">{copy.finalLabel}</span>
            <h2>{copy.finalTitle}</h2>
            <p>{copy.finalBody}</p>
          </div>
          <div style={{ display: "grid", gap: "0.55rem" }}>
            <motion.a href="/api/auth/discord/login" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="ui-btn ui-btn-primary">
              {copy.primaryCta}
            </motion.a>
            <Link to="/app" className="ui-btn ui-btn-secondary">
              {siteCopy.shared.dashboardCta}
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
