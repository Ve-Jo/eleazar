import type { Locale } from "../state/i18n";

type LandingPreview = {
  id: string;
  alt: string;
};

type SiteCopy = {
  nav: {
    features: string;
    dashboard: string;
    pricing: string;
    login: string;
    logout: string;
    localeLabel: string;
  };
  shared: {
    oauthCta: string;
    dashboardCta: string;
  };
  landing: {
    kicker: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    heroChips: string[];
    scrollHint: string;
    supportLabel: string;
    supportTitle: string;
    supportBody: string;
    supportPoints: string[];
    detailLabel: string;
    detailTitle: string;
    detailBody: string;
    detailSteps: Array<{ title: string; body: string }>;
    finalLabel: string;
    finalTitle: string;
    finalBody: string;
    previews: LandingPreview[];
  };
  features: {
    kicker: string;
    title: string;
    subtitle: string;
    trackTitle: string;
    tracks: Array<{ title: string; body: string }>;
    outcomesTitle: string;
    outcomes: string[];
    ctaTitle: string;
    ctaBody: string;
  };
  pricing: {
    kicker: string;
    title: string;
    subtitle: string;
    plans: Array<{
      name: string;
      state: string;
      blurb: string;
      bullets: string[];
      cta: string;
      highlight?: boolean;
    }>;
  };
  login: {
    kicker: string;
    title: string;
    subtitle: string;
    notes: string[];
  };
  authCallback: {
    kicker: string;
    title: string;
    subtitle: string;
  };
  dashboard: {
    kicker: string;
    title: string;
    subtitle: string;
    guildsLabel: string;
    guildsTitle: string;
    guildsLoading: string;
    guildsEmpty: string;
    statsLabel: string;
    statsTitle: string;
    statsEmpty: string;
    settingsLabel: string;
    settingsTitle: string;
    settingsEmpty: string;
    activeGuild: string;
    levelRoles: string;
    voiceMode: string;
    enabled: string;
    disabled: string;
  };
  account: {
    kicker: string;
    title: string;
    subtitle: string;
    identityLabel: string;
    identityTitle: string;
    localeLabel: string;
    localeTitle: string;
    userId: string;
    activeLocale: string;
  };
  guild: {
    kicker: string;
    title: string;
    subtitle: string;
    roleProgressLabel: string;
    roleProgressTitle: string;
    roleLoading: string;
    roleEmpty: string;
    removeRole: string;
    roleIdPlaceholder: string;
    roleLevelPlaceholder: string;
    replaceLowerRoles: string;
    addRoleRule: string;
    voiceLabel: string;
    voiceTitle: string;
    voiceLoading: string;
    joinChannelPlaceholder: string;
    categoryPlaceholder: string;
    panelPlaceholder: string;
    waitingCategoryPlaceholder: string;
    enableWaitingRooms: string;
    saveVoice: string;
    guildIdMissing: string;
    roleValidationError: string;
    loadError: string;
    saveVoiceError: string;
    addRoleError: string;
    removeRoleError: string;
    modeLabel: string;
    levelWord: string;
  };
};

const copy: Record<Locale, SiteCopy> = {
  en: {
    nav: {
      features: "Features",
      dashboard: "Dashboard",
      pricing: "Pricing",
      login: "Log in",
      logout: "Log out",
      localeLabel: "Language",
    },
    shared: {
      oauthCta: "Continue with Discord",
      dashboardCta: "Open dashboard",
    },
    landing: {
      kicker: "Discord control with game energy",
      title: "Eleazar turns your server into a playable system.",
      subtitle: "AI, economy, music, and voice workflows synced in one bot-first experience.",
      primaryCta: "Start with Discord",
      secondaryCta: "See systems",
      heroChips: ["AI TOOLING", "ECONOMY LOOP", "VOICE FLOW", "PROFILE IDENTITY"],
      scrollHint: "Hover cards and scroll to switch preview",
      supportLabel: "Support",
      supportTitle: "Live visual engine",
      supportBody: "Rendered previews come from the same components used inside the bot.",
      supportPoints: [
        "Locale-aware output for EN/RU/UK communities",
        "Discord-native UI previews generated on demand",
        "Fast media pipeline for image-heavy bot features",
      ],
      detailLabel: "Detail",
      detailTitle: "Operator rhythm",
      detailBody: "Launch the bot, tune rules in web, and let the community loop run in Discord.",
      detailSteps: [
        {
          title: "Connect",
          body: "Sign in with Discord and pull manageable guilds instantly.",
        },
        {
          title: "Configure",
          body: "Adjust leveling and voice-room flows without breaking momentum.",
        },
        {
          title: "Scale",
          body: "Expand AI, music, and economy systems as your server grows.",
        },
      ],
      finalLabel: "Final CTA",
      finalTitle: "Bring Eleazar into your server and run the full loop.",
      finalBody: "Start with OAuth, configure fast, and keep the experience in Discord.",
      previews: [
        { id: "balance", alt: "Balance preview" },
        { id: "gamelauncher", alt: "Game launcher preview" },
        { id: "cratesdisplay", alt: "Crates preview" },
        { id: "level2", alt: "Level preview" },
      ],
    },
    features: {
      kicker: "Bot-first architecture",
      title: "Built for operators, not screenshot decks.",
      subtitle: "Every feature aligns with day-to-day guild management and community activity.",
      trackTitle: "Capability track",
      tracks: [
        {
          title: "AI + media",
          body: "Generate, enhance, and transcribe content without leaving your guild workflow.",
        },
        {
          title: "Progression controls",
          body: "Run levels, rewards, and role gates with explicit configuration states.",
        },
        {
          title: "Voice orchestration",
          body: "Coordinate join-to-create and waiting-room behavior from a focused control surface.",
        },
        {
          title: "Locale continuity",
          body: "Web and bot copy stay consistent across English, Russian, and Ukrainian.",
        },
      ],
      outcomesTitle: "Operator outcomes",
      outcomes: [
        "Faster setup for new guilds",
        "Fewer context switches for moderators",
        "Clearer state visibility for progression systems",
      ],
      ctaTitle: "Deploy faster with Discord OAuth",
      ctaBody: "Enter once, then manage the parts that actually need web control.",
    },
    pricing: {
      kicker: "Pricing",
      title: "Simple plans, expanding power.",
      subtitle: "Start free, move up when your guild needs automation depth.",
      plans: [
        {
          name: "Free",
          state: "Live",
          blurb: "Core guild controls, profile context, and baseline operations.",
          bullets: ["Guild overview", "Voice-room settings", "Level role rules"],
          cta: "Use free now",
          highlight: true,
        },
        {
          name: "Pro",
          state: "Planned",
          blurb: "Advanced workflows and richer analytics for active communities.",
          bullets: ["Automation hooks", "Deeper activity insights", "Extended policy controls"],
          cta: "Join waitlist",
        },
        {
          name: "Enterprise",
          state: "Planned",
          blurb: "Governance layers for multi-team, high-volume Discord operations.",
          bullets: ["Team permissions", "Priority integrations", "SLA-oriented support"],
          cta: "Contact team",
        },
      ],
    },
    login: {
      kicker: "Secure access",
      title: "Sign in and manage your guild systems.",
      subtitle: "Discord OAuth keeps account identity and guild permissions aligned.",
      notes: [
        "Session-aware dashboard after authentication",
        "Guild-scoped management routes",
        "Localized interface with persistent locale",
      ],
    },
    authCallback: {
      kicker: "Session",
      title: "Authenticating",
      subtitle: "Finalizing Discord handshake and preparing your dashboard.",
    },
    dashboard: {
      kicker: "Operations",
      title: "Guild command center",
      subtitle: "Track manageable servers and jump straight into configuration.",
      guildsLabel: "Guilds",
      guildsTitle: "Manageable servers",
      guildsLoading: "Loading manageable guilds...",
      guildsEmpty: "No manageable guilds found for this account.",
      statsLabel: "Snapshot",
      statsTitle: "Selected guild metrics",
      statsEmpty: "No guild overview data available yet.",
      settingsLabel: "Voice",
      settingsTitle: "Voice room state",
      settingsEmpty: "Settings summary unavailable.",
      activeGuild: "Active guild",
      levelRoles: "Level roles",
      voiceMode: "Waiting mode",
      enabled: "enabled",
      disabled: "disabled",
    },
    account: {
      kicker: "Profile",
      title: "Account and locale",
      subtitle: "Session identity and language settings currently used by the dashboard.",
      identityLabel: "Identity",
      identityTitle: "Connected user",
      localeLabel: "Locale",
      localeTitle: "Active web language",
      userId: "User ID",
      activeLocale: "Active locale",
    },
    guild: {
      kicker: "Guild console",
      title: "Guild settings",
      subtitle: "Tune progression and voice orchestration for the selected server.",
      roleProgressLabel: "Progression",
      roleProgressTitle: "Level role rules",
      roleLoading: "Loading level role settings...",
      roleEmpty: "No configured level roles.",
      removeRole: "Remove",
      roleIdPlaceholder: "Role ID",
      roleLevelPlaceholder: "Required level",
      replaceLowerRoles: "Replace lower roles",
      addRoleRule: "Add role rule",
      voiceLabel: "Voice",
      voiceTitle: "Voice room orchestration",
      voiceLoading: "Loading voice room settings...",
      joinChannelPlaceholder: "Join-to-create channel ID",
      categoryPlaceholder: "Category ID",
      panelPlaceholder: "Panel channel ID",
      waitingCategoryPlaceholder: "Waiting room category ID",
      enableWaitingRooms: "Enable waiting rooms",
      saveVoice: "Save voice room settings",
      guildIdMissing: "Guild ID is missing.",
      roleValidationError: "Provide valid role ID and level (>= 1).",
      loadError: "Failed to load guild settings",
      saveVoiceError: "Failed to save voice room settings",
      addRoleError: "Failed to add level role",
      removeRoleError: "Failed to remove level role",
      modeLabel: "Mode",
      levelWord: "level",
    },
  },
  ru: {
    nav: {
      features: "Возможности",
      dashboard: "Панель",
      pricing: "Тарифы",
      login: "Войти",
      logout: "Выйти",
      localeLabel: "Язык",
    },
    shared: {
      oauthCta: "Продолжить через Discord",
      dashboardCta: "Открыть панель",
    },
    landing: {
      kicker: "Управление Discord с игровой энергией",
      title: "Eleazar превращает ваш сервер в живую игровую систему.",
      subtitle: "AI, экономика, музыка и голосовые сценарии работают как единый bot-first опыт.",
      primaryCta: "Запустить через Discord",
      secondaryCta: "Смотреть системы",
      heroChips: ["AI ИНСТРУМЕНТЫ", "ЭКОНОМИКА", "ГОЛОСОВОЙ ФЛОУ", "ПРОФИЛЬ"],
      scrollHint: "Наведите на карточки и крутите колёсико для выбора",
      supportLabel: "Основа",
      supportTitle: "Живой движок визуалов",
      supportBody: "Превью рендерятся из тех же компонентов, что используются в самом боте.",
      supportPoints: [
        "Локализованный вывод для EN/RU/UK",
        "Discord-ориентированные UI превью по запросу",
        "Быстрый медиапайплайн для визуальных команд",
      ],
      detailLabel: "Процесс",
      detailTitle: "Ритм работы",
      detailBody: "Запускаете бота, тонко настраиваете веб-слой и оставляете главный цикл в Discord.",
      detailSteps: [
        {
          title: "Подключение",
          body: "Вход через Discord и мгновенная загрузка управляемых серверов.",
        },
        {
          title: "Настройка",
          body: "Уровни и voice-room сценарии настраиваются без лишних переходов.",
        },
        {
          title: "Масштаб",
          body: "Подключайте AI, музыку и экономику по мере роста сообщества.",
        },
      ],
      finalLabel: "Финал",
      finalTitle: "Подключите Eleazar к серверу и запустите полный цикл.",
      finalBody: "OAuth вход, быстрая настройка и основной опыт внутри Discord.",
      previews: [
        { id: "balance", alt: "Превью баланса" },
        { id: "gamelauncher", alt: "Превью лаунчера игр" },
        { id: "cratesdisplay", alt: "Превью кейсов" },
        { id: "level2", alt: "Превью уровня" },
      ],
    },
    features: {
      kicker: "Bot-first архитектура",
      title: "Сделано для операторов, а не для витринных макетов.",
      subtitle: "Каждая возможность помогает в реальном управлении гильдией и активностью.",
      trackTitle: "Трек возможностей",
      tracks: [
        {
          title: "AI + медиа",
          body: "Генерация, улучшение и транскрибация контента без выхода из рабочего сценария.",
        },
        {
          title: "Контроль прогрессии",
          body: "Уровни, награды и role-gate правила с явными состояниями.",
        },
        {
          title: "Оркестрация голоса",
          body: "Join-to-create и waiting-room механики в фокусном интерфейсе.",
        },
        {
          title: "Непрерывная локализация",
          body: "Согласованный текст в вебе и боте для English, Russian и Ukrainian.",
        },
      ],
      outcomesTitle: "Операционные результаты",
      outcomes: [
        "Более быстрый запуск новых серверов",
        "Меньше переключений контекста у модераторов",
        "Понятные состояния систем прогрессии",
      ],
      ctaTitle: "Запускайте быстрее через Discord OAuth",
      ctaBody: "Один вход и управление только теми зонами, где веб действительно нужен.",
    },
    pricing: {
      kicker: "Тарифы",
      title: "Простые планы, растущие возможности.",
      subtitle: "Стартуйте бесплатно и масштабируйтесь, когда нужна глубже автоматизация.",
      plans: [
        {
          name: "Free",
          state: "Доступен",
          blurb: "Базовое управление серверами, профиль и операционный минимум.",
          bullets: ["Обзор гильдии", "Настройки voice-room", "Правила ролей по уровню"],
          cta: "Использовать бесплатно",
          highlight: true,
        },
        {
          name: "Pro",
          state: "Планируется",
          blurb: "Расширенные сценарии и более глубокая аналитика для активных сообществ.",
          bullets: ["Автоматизация", "Расширенная аналитика", "Доп. policy-контроль"],
          cta: "В лист ожидания",
        },
        {
          name: "Enterprise",
          state: "Планируется",
          blurb: "Слой управления для команд и high-volume операций в Discord.",
          bullets: ["Командные права", "Приоритетные интеграции", "SLA-поддержка"],
          cta: "Связаться с командой",
        },
      ],
    },
    login: {
      kicker: "Безопасный вход",
      title: "Войдите и управляйте системами вашей гильдии.",
      subtitle: "Discord OAuth синхронизирует идентичность аккаунта и права серверов.",
      notes: [
        "Сессионная панель после авторизации",
        "Маршруты управления с привязкой к гильдии",
        "Локализованный интерфейс с сохранением языка",
      ],
    },
    authCallback: {
      kicker: "Сессия",
      title: "Авторизация",
      subtitle: "Завершаем Discord handshake и подготавливаем панель.",
    },
    dashboard: {
      kicker: "Операции",
      title: "Командный центр гильдии",
      subtitle: "Следите за серверами и сразу переходите к настройкам.",
      guildsLabel: "Гильдии",
      guildsTitle: "Управляемые серверы",
      guildsLoading: "Загружаем управляемые серверы...",
      guildsEmpty: "Для этого аккаунта не найдено управляемых серверов.",
      statsLabel: "Срез",
      statsTitle: "Метрики выбранной гильдии",
      statsEmpty: "Данные обзора гильдии пока недоступны.",
      settingsLabel: "Голос",
      settingsTitle: "Состояние voice room",
      settingsEmpty: "Сводка настроек пока недоступна.",
      activeGuild: "Активная гильдия",
      levelRoles: "Ролей по уровню",
      voiceMode: "Режим ожидания",
      enabled: "включён",
      disabled: "выключен",
    },
    account: {
      kicker: "Профиль",
      title: "Аккаунт и язык",
      subtitle: "Текущая сессия и языковые настройки панели управления.",
      identityLabel: "Идентичность",
      identityTitle: "Подключённый пользователь",
      localeLabel: "Локаль",
      localeTitle: "Активный язык веба",
      userId: "ID пользователя",
      activeLocale: "Текущая локаль",
    },
    guild: {
      kicker: "Консоль гильдии",
      title: "Настройки гильдии",
      subtitle: "Настройте прогрессию и голосовую оркестрацию выбранного сервера.",
      roleProgressLabel: "Прогрессия",
      roleProgressTitle: "Правила ролей по уровню",
      roleLoading: "Загружаем настройки ролей...",
      roleEmpty: "Роли по уровням ещё не настроены.",
      removeRole: "Удалить",
      roleIdPlaceholder: "ID роли",
      roleLevelPlaceholder: "Требуемый уровень",
      replaceLowerRoles: "Заменять роли ниже",
      addRoleRule: "Добавить правило",
      voiceLabel: "Голос",
      voiceTitle: "Оркестрация voice room",
      voiceLoading: "Загружаем voice-настройки...",
      joinChannelPlaceholder: "ID канала join-to-create",
      categoryPlaceholder: "ID категории",
      panelPlaceholder: "ID панельного канала",
      waitingCategoryPlaceholder: "ID категории waiting room",
      enableWaitingRooms: "Включить комнаты ожидания",
      saveVoice: "Сохранить voice-настройки",
      guildIdMissing: "Не найден ID гильдии.",
      roleValidationError: "Укажите корректный ID роли и уровень (>= 1).",
      loadError: "Не удалось загрузить настройки гильдии",
      saveVoiceError: "Не удалось сохранить voice-настройки",
      addRoleError: "Не удалось добавить роль по уровню",
      removeRoleError: "Не удалось удалить роль по уровню",
      modeLabel: "Режим",
      levelWord: "уровень",
    },
  },
  uk: {
    nav: {
      features: "Можливості",
      dashboard: "Панель",
      pricing: "Тарифи",
      login: "Увійти",
      logout: "Вийти",
      localeLabel: "Мова",
    },
    shared: {
      oauthCta: "Продовжити через Discord",
      dashboardCta: "Відкрити панель",
    },
    landing: {
      kicker: "Керування Discord з ігровою енергією",
      title: "Eleazar перетворює ваш сервер на живу ігрову систему.",
      subtitle: "AI, економіка, музика і голосові сценарії зібрані в одному bot-first досвіді.",
      primaryCta: "Запустити через Discord",
      secondaryCta: "Дивитися системи",
      heroChips: ["AI ІНСТРУМЕНТИ", "ЕКОНОМІКА", "ГОЛОСОВИЙ ФЛОУ", "ПРОФІЛЬ"],
      scrollHint: "Наведіть на картки і прокрутіть коліщатко для вибору",
      supportLabel: "Основа",
      supportTitle: "Живий візуальний рушій",
      supportBody: "Прев'ю рендеряться з тих самих компонентів, що й у боті.",
      supportPoints: [
        "Локалізований вивід для EN/RU/UK",
        "Discord-орієнтовані UI прев'ю на запит",
        "Швидкий медіапайплайн для візуальних команд",
      ],
      detailLabel: "Процес",
      detailTitle: "Ритм оператора",
      detailBody: "Запускаєте бота, налаштовуєте веб-шар і залишаєте головний цикл у Discord.",
      detailSteps: [
        {
          title: "Підключення",
          body: "Вхід через Discord і миттєве завантаження керованих серверів.",
        },
        {
          title: "Налаштування",
          body: "Рівні та voice-room сценарії керуються без зайвих переходів.",
        },
        {
          title: "Масштаб",
          body: "Підключайте AI, музику й економіку в міру росту спільноти.",
        },
      ],
      finalLabel: "Фінал",
      finalTitle: "Додайте Eleazar до сервера та запустіть повний цикл.",
      finalBody: "OAuth вхід, швидке налаштування і головний досвід усередині Discord.",
      previews: [
        { id: "balance", alt: "Прев'ю балансу" },
        { id: "gamelauncher", alt: "Прев'ю лаунчера ігор" },
        { id: "cratesdisplay", alt: "Прев'ю кейсів" },
        { id: "level2", alt: "Прев'ю рівня" },
      ],
    },
    features: {
      kicker: "Bot-first архітектура",
      title: "Створено для операторів, а не для вітринних макетів.",
      subtitle: "Кожна можливість працює на щоденне керування гільдією та активністю.",
      trackTitle: "Трек можливостей",
      tracks: [
        {
          title: "AI + медіа",
          body: "Генерація, покращення та транскрипція контенту без виходу з робочого процесу.",
        },
        {
          title: "Контроль прогресії",
          body: "Рівні, винагороди та role-gate правила з чіткими станами.",
        },
        {
          title: "Голосова оркестрація",
          body: "Join-to-create і waiting-room механіки в сфокусованому інтерфейсі.",
        },
        {
          title: "Безперервна локалізація",
          body: "Єдина подача в вебі й боті для English, Russian і Ukrainian.",
        },
      ],
      outcomesTitle: "Операційний результат",
      outcomes: [
        "Швидший запуск нових серверів",
        "Менше перемикань контексту для модераторів",
        "Прозорі стани систем прогресії",
      ],
      ctaTitle: "Запускайте швидше через Discord OAuth",
      ctaBody: "Один вхід і керування лише тим, що справді потребує вебу.",
    },
    pricing: {
      kicker: "Тарифи",
      title: "Прості плани, зростаюча сила.",
      subtitle: "Починайте безкоштовно та масштабуйтесь, коли потрібна глибша автоматизація.",
      plans: [
        {
          name: "Free",
          state: "Доступний",
          blurb: "Базове керування гільдіями, профіль і операційний мінімум.",
          bullets: ["Огляд гільдії", "Налаштування voice-room", "Правила ролей за рівнем"],
          cta: "Використовувати безкоштовно",
          highlight: true,
        },
        {
          name: "Pro",
          state: "Планується",
          blurb: "Розширені сценарії та глибша аналітика для активних спільнот.",
          bullets: ["Автоматизація", "Розширена аналітика", "Додатковий policy-контроль"],
          cta: "У лист очікування",
        },
        {
          name: "Enterprise",
          state: "Планується",
          blurb: "Рівень керування для команд і high-volume Discord операцій.",
          bullets: ["Командні дозволи", "Пріоритетні інтеграції", "SLA-підтримка"],
          cta: "Зв'язатися з командою",
        },
      ],
    },
    login: {
      kicker: "Безпечний вхід",
      title: "Увійдіть і керуйте системами вашої гільдії.",
      subtitle: "Discord OAuth синхронізує ідентичність акаунта та права серверів.",
      notes: [
        "Сесійна панель після авторизації",
        "Маршрути керування з прив'язкою до гільдії",
        "Локалізований інтерфейс із збереженням мови",
      ],
    },
    authCallback: {
      kicker: "Сесія",
      title: "Авторизація",
      subtitle: "Завершуємо Discord handshake і готуємо вашу панель.",
    },
    dashboard: {
      kicker: "Операції",
      title: "Центр керування гільдією",
      subtitle: "Відстежуйте сервери та одразу переходьте до налаштувань.",
      guildsLabel: "Гільдії",
      guildsTitle: "Керовані сервери",
      guildsLoading: "Завантажуємо керовані сервери...",
      guildsEmpty: "Для цього акаунта не знайдено керованих серверів.",
      statsLabel: "Зріз",
      statsTitle: "Метрики обраної гільдії",
      statsEmpty: "Дані огляду гільдії поки недоступні.",
      settingsLabel: "Голос",
      settingsTitle: "Стан voice room",
      settingsEmpty: "Зведення налаштувань поки недоступне.",
      activeGuild: "Активна гільдія",
      levelRoles: "Ролей за рівнем",
      voiceMode: "Режим очікування",
      enabled: "увімкнено",
      disabled: "вимкнено",
    },
    account: {
      kicker: "Профіль",
      title: "Акаунт і мова",
      subtitle: "Поточна сесія та мовні налаштування панелі.",
      identityLabel: "Ідентичність",
      identityTitle: "Підключений користувач",
      localeLabel: "Локаль",
      localeTitle: "Активна мова вебу",
      userId: "ID користувача",
      activeLocale: "Поточна локаль",
    },
    guild: {
      kicker: "Консоль гільдії",
      title: "Налаштування гільдії",
      subtitle: "Налаштуйте прогресію і голосову оркестрацію для обраного сервера.",
      roleProgressLabel: "Прогресія",
      roleProgressTitle: "Правила ролей за рівнем",
      roleLoading: "Завантажуємо налаштування ролей...",
      roleEmpty: "Ролі за рівнями ще не налаштовані.",
      removeRole: "Видалити",
      roleIdPlaceholder: "ID ролі",
      roleLevelPlaceholder: "Потрібний рівень",
      replaceLowerRoles: "Замінювати нижчі ролі",
      addRoleRule: "Додати правило",
      voiceLabel: "Голос",
      voiceTitle: "Оркестрація voice room",
      voiceLoading: "Завантажуємо voice-налаштування...",
      joinChannelPlaceholder: "ID каналу join-to-create",
      categoryPlaceholder: "ID категорії",
      panelPlaceholder: "ID панельного каналу",
      waitingCategoryPlaceholder: "ID категорії waiting room",
      enableWaitingRooms: "Увімкнути кімнати очікування",
      saveVoice: "Зберегти voice-налаштування",
      guildIdMissing: "Не знайдено ID гільдії.",
      roleValidationError: "Вкажіть коректний ID ролі та рівень (>= 1).",
      loadError: "Не вдалося завантажити налаштування гільдії",
      saveVoiceError: "Не вдалося зберегти voice-налаштування",
      addRoleError: "Не вдалося додати роль за рівнем",
      removeRoleError: "Не вдалося видалити роль за рівнем",
      modeLabel: "Режим",
      levelWord: "рівень",
    },
  },
};

export function getSiteCopy(locale: Locale): SiteCopy {
  return copy[locale] ?? copy.en;
}
