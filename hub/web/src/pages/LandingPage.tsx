import botLogo from "../assets/bot-logo.png";
import { useI18n } from "../state/i18n";

export default function LandingPage() {
  const { locale } = useI18n();

  const copy = {
    en: {
      kicker: "Award-winning Discord bot experience",
      badge: "AI. Music. Economy. Identity.",
      title: "One Discord bot. An entire universe for your server.",
      subtitle:
        "Eleazar blends AI, progression, music, profiles, and guild systems into one polished Discord-native experience.",
      primaryCta: "Open dashboard",
      secondaryCta: "See bot systems",
      proofOneLabel: "Core idea",
      proofOneValue: "A premium Discord bot, not a random command pack",
      proofTwoLabel: "Built for",
      proofTwoValue: "Communities that want style, progression, and identity",
      marquee: ["AI", "ECONOMY", "MUSIC", "LEVELS", "VOICE ROOMS"],
      panelLabel: "Bot signal",
      panelTitle: "Eleazar in motion",
      stack: [
        {
          label: "Bot identity",
          title: "More personality than a generic dashboard",
          body: "Playful, useful, social, and visually distinct.",
          className: "prestige-stack-card prestige-stack-card-large",
        },
        {
          label: "AI tools",
          title: "Generate images, upscale results, and transcribe audio",
          body: "Creative tools that feel native to the bot.",
          className: "prestige-stack-card prestige-stack-card-soft",
        },
        {
          label: "Progression",
          title: "Economy, cases, work, crime, levels, and leaderboards",
          body: "Reward loops that keep members returning.",
          className: "prestige-stack-card prestige-stack-card-soft",
        },
        {
          label: "Guild command layer",
          title: "Music, voice-room flows, personalization, and server settings",
          body: "The web app supports the bot, not the other way around.",
          className: "prestige-stack-card prestige-stack-accent",
        },
      ],
      editorial: [
        {
          label: "What makes it special",
          title: "A bot with atmosphere, not just administration.",
          body: "Utility, identity, progression, and visual polish in one system.",
          className: "card prestige-editorial-card prestige-editorial-intro",
        },
        {
          label: "Creative systems",
          title: "AI that feels usable inside the bot",
          body: "Image generation, transcription, and enhancement for everyday use.",
          className: "card prestige-editorial-card prestige-editorial-wide",
        },
        {
          label: "Server energy",
          title: "Progression that turns activity into momentum",
          body: "Economy, rewards, risk, and levels that keep the server alive.",
          className: "card prestige-editorial-card",
        },
        {
          label: "Social gravity",
          title: "Voice and music for communities that actually hang out",
          body: "Built for real social activity, not just commands.",
          className: "card prestige-editorial-card",
        },
        {
          label: "Supporting web app",
          title: "A dashboard that reinforces the bot",
          body: "Guild configuration lives on the web while the main experience stays in Discord.",
          className: "card prestige-editorial-card prestige-editorial-wide prestige-editorial-muted",
        },
      ],
      stats: [
        {
          label: "Command surface",
          title: "AI, economy, music, profile, settings, and voice-room flows",
          body: "Everything needed to make a Discord community feel active.",
        },
        {
          label: "Experience design",
          title: "A bot identity with visual style, progression, and multilingual support",
          body: "Built like a product, not an oversized command list.",
        },
        {
          label: "Management layer",
          title: "A clean web companion for the guild settings that matter",
          body: "A simple companion app for the settings that matter.",
        },
      ],
      showcaseLabel: "Real bot visuals",
      showcaseTitle: "Rendered directly from Eleazar’s UI components.",
      showcaseBody: "Not mockups. These previews come from the same rendering system used by the bot.",
      ctaLabel: "Bring Eleazar into your server",
      ctaTitle: "Launch the bot experience first. Tune the details second.",
      ctaBody:
        "Use the dashboard for setup, then let Eleazar carry the experience inside Discord.",
    },
    ru: {
      kicker: "Discord-бот с премиальным ощущением",
      badge: "AI. Музыка. Экономика. Идентичность.",
      title: "Один Discord-бот. Целая вселенная для вашего сервера.",
      subtitle:
        "Eleazar объединяет AI-инструменты, прогрессию, музыку, профили и системы сервера в одном цельном опыте внутри Discord.",
      primaryCta: "Открыть панель",
      secondaryCta: "Посмотреть системы бота",
      proofOneLabel: "Главная идея",
      proofOneValue: "Discord-бот как цельный продукт, а не набор команд",
      proofTwoLabel: "Для кого",
      proofTwoValue: "Для сообществ, которым важны стиль, прогрессия и атмосфера",
      marquee: ["AI", "ЭКОНОМИКА", "МУЗЫКА", "УРОВНИ", "ГОЛОСОВЫЕ КОМНАТЫ"],
      panelLabel: "Сигнал бота",
      panelTitle: "Eleazar в движении",
      stack: [
        {
          label: "Идентичность бота",
          title: "Больше характера, чем у обычной панели",
          body: "Полезный, социальный, игровой и визуально выразительный.",
          className: "prestige-stack-card prestige-stack-card-large",
        },
        {
          label: "AI-инструменты",
          title: "Генерация изображений, улучшение результатов и расшифровка аудио",
          body: "Творческие инструменты, которые ощущаются частью бота.",
          className: "prestige-stack-card prestige-stack-card-soft",
        },
        {
          label: "Прогрессия",
          title: "Экономика, кейсы, работа, crime, уровни и лидерборды",
          body: "Циклы наград, которые мотивируют возвращаться.",
          className: "prestige-stack-card prestige-stack-card-soft",
        },
        {
          label: "Слой управления",
          title: "Музыка, голосовые комнаты, персонализация и настройки сервера",
          body: "Веб помогает боту, а не заменяет его.",
          className: "prestige-stack-card prestige-stack-accent",
        },
      ],
      editorial: [
        {
          label: "Почему это особенное",
          title: "Это бот с атмосферой, а не просто админка.",
          body: "Полезность, идентичность, прогрессия и визуальный стиль в одной системе.",
          className: "card prestige-editorial-card prestige-editorial-intro",
        },
        {
          label: "Творческие системы",
          title: "AI, который действительно удобно использовать внутри бота",
          body: "Генерация изображений, транскрибация и улучшение медиа на каждый день.",
          className: "card prestige-editorial-card prestige-editorial-wide",
        },
        {
          label: "Энергия сервера",
          title: "Прогрессия, которая превращает активность в движение",
          body: "Экономика, награды, риск и уровни оживляют сервер.",
          className: "card prestige-editorial-card",
        },
        {
          label: "Социальное ядро",
          title: "Голос и музыка для сообществ, которые действительно общаются",
          body: "Для живого общения, а не только для команд.",
          className: "card prestige-editorial-card",
        },
        {
          label: "Поддерживающий веб",
          title: "Панель усиливает бота",
          body: "Настройки живут в вебе, а главный опыт остаётся внутри Discord.",
          className: "card prestige-editorial-card prestige-editorial-wide prestige-editorial-muted",
        },
      ],
      stats: [
        {
          label: "Поверхность команд",
          title: "AI, экономика, музыка, профиль, настройки и голосовые сценарии",
          body: "Всё, что нужно для активного Discord-сообщества.",
        },
        {
          label: "Дизайн опыта",
          title: "Идентичность бота с визуальным стилем, прогрессией и мультиязычностью",
          body: "Сделан как продукт, а не как перегруженный список команд.",
        },
        {
          label: "Слой управления",
          title: "Чистый веб-компаньон для действительно важных настроек сервера",
          body: "Простой веб-компаньон для нужных настроек.",
        },
      ],
      showcaseLabel: "Реальные визуалы бота",
      showcaseTitle: "Рендерятся напрямую из UI-компонентов Eleazar.",
      showcaseBody: "Это не мокапы. Превью приходят из той же системы рендеринга, что и у самого бота.",
      ctaLabel: "Приведите Eleazar на свой сервер",
      ctaTitle: "Сначала запустите опыт бота. Потом отшлифуйте детали.",
      ctaBody:
        "Используйте панель для настройки, а основной опыт оставьте Eleazar внутри Discord.",
    },
    uk: {
      kicker: "Discord-бот із преміальним відчуттям",
      badge: "AI. Музика. Економіка. Ідентичність.",
      title: "Один Discord-бот. Цілий всесвіт для вашого сервера.",
      subtitle:
        "Eleazar поєднує AI-інструменти, прогресію, музику, профілі та серверні системи в одному цілісному досвіді всередині Discord.",
      primaryCta: "Відкрити панель",
      secondaryCta: "Переглянути системи бота",
      proofOneLabel: "Головна ідея",
      proofOneValue: "Discord-бот як цілісний продукт, а не набір команд",
      proofTwoLabel: "Для кого",
      proofTwoValue: "Для спільнот, яким важливі стиль, прогресія та атмосфера",
      marquee: ["AI", "ЕКОНОМІКА", "МУЗИКА", "РІВНІ", "ГОЛОСОВІ КІМНАТИ"],
      panelLabel: "Сигнал бота",
      panelTitle: "Eleazar у русі",
      stack: [
        {
          label: "Ідентичність бота",
          title: "Більше характеру, ніж у звичайної панелі",
          body: "Корисний, соціальний, ігровий і візуально виразний.",
          className: "prestige-stack-card prestige-stack-card-large",
        },
        {
          label: "AI-інструменти",
          title: "Генерація зображень, покращення результатів і розшифрування аудіо",
          body: "Творчі інструменти, які відчуваються частиною бота.",
          className: "prestige-stack-card prestige-stack-card-soft",
        },
        {
          label: "Прогресія",
          title: "Економіка, кейси, робота, crime, рівні та лідерборди",
          body: "Цикли винагород, які мотивують повертатися.",
          className: "prestige-stack-card prestige-stack-card-soft",
        },
        {
          label: "Шар керування",
          title: "Музика, голосові кімнати, персоналізація та налаштування сервера",
          body: "Веб допомагає боту, а не замінює його.",
          className: "prestige-stack-card prestige-stack-accent",
        },
      ],
      editorial: [
        {
          label: "Чому це особливе",
          title: "Це бот з атмосферою, а не просто адмінка.",
          body: "Корисність, ідентичність, прогресія та візуальний стиль в одній системі.",
          className: "card prestige-editorial-card prestige-editorial-intro",
        },
        {
          label: "Творчі системи",
          title: "AI, яким справді зручно користуватися всередині бота",
          body: "Генерація зображень, транскрипція й покращення медіа на щодень.",
          className: "card prestige-editorial-card prestige-editorial-wide",
        },
        {
          label: "Енергія сервера",
          title: "Прогресія, що перетворює активність на рух",
          body: "Економіка, винагороди, ризик і рівні оживляють сервер.",
          className: "card prestige-editorial-card",
        },
        {
          label: "Соціальне ядро",
          title: "Голос і музика для спільнот, які справді проводять час разом",
          body: "Для живого спілкування, а не лише для команд.",
          className: "card prestige-editorial-card",
        },
        {
          label: "Підтримувальний веб",
          title: "Панель підсилює бота",
          body: "Налаштування живуть у вебі, а головний досвід лишається в Discord.",
          className: "card prestige-editorial-card prestige-editorial-wide prestige-editorial-muted",
        },
      ],
      stats: [
        {
          label: "Поверхня команд",
          title: "AI, економіка, музика, профіль, налаштування та голосові сценарії",
          body: "Усе, що потрібно для активної Discord-спільноти.",
        },
        {
          label: "Дизайн досвіду",
          title: "Ідентичність бота з візуальним стилем, прогресією та мультимовністю",
          body: "Побудований як продукт, а не перевантажений список команд.",
        },
        {
          label: "Шар керування",
          title: "Чистий веб-компаньйон для справді важливих налаштувань сервера",
          body: "Простий веб-компаньйон для потрібних налаштувань.",
        },
      ],
      showcaseLabel: "Реальні візуали бота",
      showcaseTitle: "Рендеряться прямо з UI-компонентів Eleazar.",
      showcaseBody: "Це не мокапи. Прев’ю приходять із тієї ж системи рендерингу, що й у самого бота.",
      ctaLabel: "Запросіть Eleazar на свій сервер",
      ctaTitle: "Спершу запустіть досвід бота. Потім відшліфуйте деталі.",
      ctaBody:
        "Використовуйте панель для налаштування, а основний досвід залиште Eleazar усередині Discord.",
    },
  }[locale];

  const showcasePreviews = [
    { id: "balance", className: "primary", alt: "Eleazar balance preview" },
    { id: "cratesdisplay", className: "secondary", alt: "Eleazar crates preview" },
    { id: "gamelauncher", className: "wide", alt: "Eleazar work games preview" },
    { id: "level2", className: "tall", alt: "Eleazar level preview" },
  ];

  return (
    <section className="container page landing-page prestige-landing">
      <div className="prestige-atlas-hero">
        <div className="prestige-atlas-copy">
          <div className="prestige-brand-row">
            <div className="prestige-logo">
              <img src={botLogo} alt="Eleazar logo" className="prestige-logo-image" />
            </div>
            <div>
              <p className="prestige-kicker">{copy.kicker}</p>
              <span className="badge">{copy.badge}</span>
            </div>
          </div>

          <h1>{copy.title}</h1>
          <p className="prestige-subtitle">{copy.subtitle}</p>

          <div className="prestige-actions">
            <a href="/app" className="prestige-button-link btn-primary">
              {copy.primaryCta}
            </a>
            <a href="#bot-systems" className="prestige-button-link btn-secondary">
              {copy.secondaryCta}
            </a>
          </div>

          <div className="prestige-proof-strip prestige-proof-strip-open">
            <div>
              <span>{copy.proofOneLabel}</span>
              <strong>{copy.proofOneValue}</strong>
            </div>
            <div>
              <span>{copy.proofTwoLabel}</span>
              <strong>{copy.proofTwoValue}</strong>
            </div>
          </div>
        </div>

        <div className="prestige-atlas-visual">
          <div className="prestige-atmosphere prestige-atmosphere-one" aria-hidden="true" />
          <div className="prestige-atmosphere prestige-atmosphere-two" aria-hidden="true" />

          <div className="prestige-panel-top">
            <span>{copy.panelLabel}</span>
            <strong>{copy.panelTitle}</strong>
          </div>

          <div className="prestige-orbit-shell" aria-hidden="true">
            <div className="prestige-orbit-ring prestige-orbit-ring-one" />
            <div className="prestige-orbit-ring prestige-orbit-ring-two" />
            {copy.marquee.map((item, index) => (
              <span key={item} className={`prestige-orbit-chip prestige-orbit-chip-${index + 1}`}>
                {item}
              </span>
            ))}
            <div className="prestige-orbit-core">
              <img src={botLogo} alt="Eleazar logo" className="prestige-orbit-logo-image" />
            </div>
          </div>
        </div>
      </div>

      <div className="prestige-horizontal-scroll-shell">
        <div className="prestige-horizontal-scroll-copy">
          <span className="prestige-section-label">{copy.showcaseLabel}</span>
          <h2>{copy.showcaseTitle}</h2>
          <p>{copy.showcaseBody}</p>
        </div>

        <div className="prestige-horizontal-scroll-container">
          <div className="prestige-horizontal-scroll-track">
            {showcasePreviews.map((preview) => (
              <div key={preview.id} className={`prestige-horizontal-scroll-card ${preview.className}`}>
                <img src={`/api/render-preview/${preview.id}?locale=${locale}&randomDiscordAvatars=true`} alt={preview.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="prestige-editorial-shell">
        <div className="prestige-editorial-grid">
          {copy.editorial.map((item) => (
            <article key={item.title} className={item.className}>
              <span className="prestige-section-label">{item.label}</span>
              {item.className.includes("prestige-editorial-intro") ? <h2>{item.title}</h2> : <h3>{item.title}</h3>}
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="prestige-systems-band" id="bot-systems">
        {copy.stack.map((item) => (
          <article key={item.title} className={item.className}>
            <p>{item.label}</p>
            <strong>{item.title}</strong>
            <small>{item.body}</small>
          </article>
        ))}
      </div>

      <div className="prestige-stats-shell">
        <div className="prestige-stats-band">
          {copy.stats.map((item) => (
            <div key={item.title} className="prestige-stat-block">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card prestige-cta prestige-cta-open">
        <div>
          <span className="prestige-section-label">{copy.ctaLabel}</span>
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaBody}</p>
        </div>
        <a href="/app" className="prestige-button-link btn-primary">
          {copy.primaryCta}
        </a>
      </div>
    </section>
  );
}
