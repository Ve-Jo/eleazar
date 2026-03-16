# Eleazar Bot & Hub Architecture Guide

This document provides a comprehensive overview of the Eleazar Discord bot and its supporting hub services architecture.

## Executive Summary
- Two-workspace ESM TypeScript system: Discord bot (commands, games, music) + hub (AI, rendering, database, localization, shared contracts).
- Rendering uses Takumi first with logical dimensions + devicePixelRatio; raster Sharp path is fallback. AI service streams envelopes; database is Prisma/PostgreSQL.
- Current risks: DB port mismatch between bot default (3003) vs hub DB default (3001); crypto wallet service references missing `isTestWallet` field and `mexcService.disconnectWebSocket` implementation; one legacy JS game (`bot/src/games/risky/crypto2.js`).

### Read This When...
- Shipping a new command → Command System + Localization Sync.
- Adding a rendering component → JSX Component Guidelines + Performance Checklist.
- Debugging service calls → Service Communication + Service Configuration table.
- Hardening AI/tooling → AI Integration + AI Tooling Handshake notes.
- Doing local smoke tests → Local Development Quickstart + Smoke Tests.

## Table of Contents
1. [Bot Architecture](#bot-architecture)
2. [Hub Architecture](#hub-architecture)
3. [Service Communication](#service-communication)
4. [Development Guidelines](#development-guidelines)

---

## Bot Architecture

### Runtime & Quickstart
- **Runtime**: Bun (TypeScript, ESM).
- **Start bot**: `bun run start` (cwd: `/bot`).
- **Start hub**: `bun run start` (cwd: `/hub`).

### Project Structure
```
bot/
├── bot.ts                 # Main bot entry point
├── src/
│   ├── cmds/             # Slash commands organized by category
│   ├── events/           # Discord event handlers
│   ├── games/            # Game implementations (2048, Snake, etc.)
│   ├── handlers/         # Core request handlers
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions
│   ├── api/              # Hub client integration
│   └── types/            # TypeScript type definitions
```

### Command System

#### Category Structure
Commands are organized in `/bot/src/cmds/` with the following categories:
- **ai/** - AI interaction commands
- **counting/** - Counting game commands
- **economy/** - Economy and currency commands
- **emotions/** - Emotional expression commands
- **filters/** - Content filtering commands
- **forbidden/** - Restricted access commands
- **help/** - Help and information commands
- **images/** - Image generation and manipulation
- **marriage/** - Marriage system commands
- **music/** - Music player commands
- **personalization/** - User profile customization
- **settings/** - Bot configuration commands
- **voice-rooms/** - Voice room management

#### Command Loading Pattern
Each category follows this structure:
```typescript
// cmds/category/index.ts - Main command definition
const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("commandname")
      .setDescription("Command description");
  },
  
  localization_strings: {
    name: {
      en: "commandname",
      ru: "комманда",
      uk: "команда",
    },
    description: {
      en: "Command description",
      ru: "Описание команды",
      uk: "Опис команди",
    },
    // Additional translation keys...
  },
  
  // Optional pre-execution logic
  async preExecute(interaction, i18n): Promise<void> {
    // Validation logic
  },
  
  // Optional autocomplete handling
  async autocomplete(interaction): Promise<void> {
    // Autocomplete logic
  },
};
```

#### Subcommands
Subcommands are separate files in the category directory:
```typescript
// cmds/category/subcommand.ts
import { SlashCommandSubcommandBuilder } from "discord.js";

const subcommand = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("subcommand")
      .setDescription("Subcommand description");
  },
  
  localization_strings: {
    // Subcommand-specific translations
  },
  
  async execute(interaction, i18n): Promise<void> {
    // Subcommand logic
  },
};
```

### Localization System

#### Individual Command Localization
Each command/event file contains its own `localization_strings` object with support for:
- **English (en)** - Default language
- **Russian (ru)** - Russian translations
- **Ukrainian (uk)** - Ukrainian translations

#### Translation Structure
```typescript
localization_strings: {
  name: {
    en: "help",
    ru: "помощь", 
    uk: "допомога",
  },
  description: {
    en: "Get help with the bot",
    ru: "Получить помощь с ботом",
    uk: "Отримати допомогу з ботом",
  },
  // Nested keys for complex messages
  errorMessages: {
    notFound: {
      en: "Command not found",
      ru: "Команда не найдена",
      uk: "Команду не знайдено",
    },
  },
  // Template variables supported
  welcomeMessage: {
    en: "Welcome {{user}}!",
    ru: "Добро пожаловать {{user}}!",
    uk: "Ласкаво просимо {{user}}!",
  },
}
```

#### Auto-Syncing Functionality
The bot automatically syncs individual command translations to main JSON files in the hub localization service, ensuring consistency across the entire system.

### Hub Client Integration

The bot communicates with hub services through `/bot/src/api/hubClient.ts`:

```typescript
import hubClient from "../api/hubClient.ts";

// Example API calls
const userData = await hubClient.getUser(userId, guildId);
const balance = await hubClient.getBalance(userId, guildId);
const imageBuffer = await hubClient.generateImage(component, props);
```

### Database Layout

#### Core Models
The database uses PostgreSQL with Prisma ORM and includes these key models:

```prisma
model User {
  id              String           @map("user_id")
  guildId         String           @map("guild_id")
  bannerUrl       String?          @map("banner_url")
  lastActivity    BigInt           @default(0) @map("last_activity")
  locale          String?          @map("locale")
  realName        String?          @map("real_name")
  age             Int?             @map("age")
  gender          String?          @map("gender")
  countryCode     String?          @map("country_code")
  
  // Relations
  cooldowns       Cooldown?
  crates          Crate[]
  cryptoPositions CryptoPosition[]
  cryptoWallets   CryptoWallet[]
  economy         Economy?
  Level           Level?
  stats           Statistics?
  upgrades        Upgrade[]
  VoiceSession    VoiceSession?
  guild           Guild            @relation(fields: [guildId], references: [id])
}

model Guild {
  id       String   @id @map("guild_id")
  settings Json     @default("{}")
  users    User[]
}
```

#### Key Features
- **Multi-guild support** - Each user belongs to a specific guild
- **Economy system** - Balance, crates, upgrades, crypto trading
- **Leveling system** - XP, levels, roles
- **Voice sessions** - Voice room tracking and rewards
- **Personalization** - User profiles, banners, demographics

### Music Functionality

#### Architecture
The music system uses Lavalink for audio processing with the following components:

```typescript
// Music command structure
const musicCommand = {
  // Main command in index.ts
  data: () => new SlashCommandBuilder()
    .setName("music")
    .setDescription("Music control command"),
    
  // Subcommands: play, skip, loop, queue, etc.
  subcommands: {
    play: playSubcommand,
    skip: skipSubcommand,
    // ... other subcommands
  }
};
```

#### Key Features
- **Voice channel integration** - Automatic connection/disconnection
- **Queue management** - Add, remove, reorder tracks
- **Playback controls** - Play, pause, skip, seek, loop
- **Filters** - Audio effects and filters
- **Autoplay** - Automatic track suggestions
- **Multi-source support** - YouTube, Spotify, SoundCloud

---

## Hub Architecture

### Runtime & Quickstart
- **Runtime**: Bun (TypeScript, ESM).
- **Start hub**: `bun run start` (cwd: `/hub`).

### Service Structure
```
hub/
├── ai/                 # AI processing service
├── client/             # Client-side utilities
├── database/           # Database service and Prisma
├── localization/       # Translation management
├── rendering/          # Image generation service
└── shared/             # Shared utilities and types
```

### Rendering Backend

#### Technology Stack
The rendering service uses a multi-backend approach:

1. **Takumi Backend** (Primary)
   - React-based image generation
   - Uses `@takumi-rs/image-response`
   - Supports JSX components
   - High performance with caching

2. **Raster Backend** (Fallback)
   - SVG to WebP conversion
   - Sharp-based image processing
   - Used for simpler graphics

#### Image Generation Pipeline
```typescript
// Rendering service endpoint
app.post("/generate", async (req, res) => {
  const { component, props, scaling, locale, options } = req.body;
  
  const result = await generateImage(
    component,    // JSX component name
    props,         // Component props
    scaling,       // Image/emoji scaling factors
    i18n,          // Localization object
    options        // Additional options
  );
  
  // Returns WebP buffer or [buffer, coloring] array
});
```

#### Component System
Components are JSX files in `/hub/rendering/src/components/`:

```jsx
// Example component structure
const Balance = (props) => {
  const { interaction, database, i18n, coloring } = props;
  
  return (
    <div style={{ /* styles */ }}>
      {/* Component JSX */}
      <img src={emojiUrl} />
      <Text>{i18n.__("balance.title")}</Text>
    </div>
  );
};
```

#### Available Components
- **Balance.jsx** - User balance display
- **Leaderboard.jsx** - Server leaderboards
- **MusicPlayer.jsx** - Now playing display
- **LevelUp.jsx** - Level up notifications
- **Game components** - 2048, Snake, Tower, etc.
- **Economy components** - Crates, upgrades, transfers

### Emoji and Image System

#### Emoji Processing
- **Twemoji integration** - `@twemoji/api` for consistent emoji rendering
- **Caching system** - Multi-level emoji caching with TTL
- **SVG conversion** - Emojis converted to SVG for high-quality rendering
- **Scaling support** - Configurable emoji scaling per component

#### Image Processing
- **Sharp library** - High-performance image manipulation
- **Color extraction** - `color-thief-bun` for palette generation
- **Format support** - WebP, AVIF, PNG output formats
- **Asset caching** - Persistent asset caching with memory management

#### Why We Render Images
The system generates images for several reasons:
1. **Discord limitations** - Embed images provide richer interaction than text
2. **Consistency** - Ensures uniform appearance across devices
3. **Performance** - Pre-rendered images load faster than complex UIs
4. **Rich data visualization** - Charts, progress bars, game states

### AI Integration

#### AI Service Architecture
The AI service (`/hub/ai/`) provides:
- **Model management** - Multiple AI providers (Groq, Replicate, DeepInfra)
- **Stream processing** - Real-time AI responses
- **Tool execution** - AI can execute bot commands
- **Rate limiting** - Per-model rate limiting and cooldowns

#### AI Request Flow
```typescript
// Bot AI request
const aiResponse = await hubClient.processAIHubStream({
  prompt: userMessage,
  model: selectedModel,
  tools: availableCommands,
  userId: interaction.user.id,
});
```

### Localization System

#### Hub Localization Service
The localization service (`/hub/localization/`) manages:

```typescript
class I18n {
  private translations: Record<string, TranslationMap>;
  private currentLocale: string;
  private supportedLocales: string[]; // ["en", "ru", "uk"]
  
  __(key: string, variables?: Record<string, unknown>): string {
    // Translation lookup with variable interpolation
  }
  
  loadTranslations(locale: string): void {
    // Load JSON translation files
  }
}
```

#### Translation Files
Located in `/hub/localization/locales/`:
- **en.json** - English translations (62KB)
- **ru.json** - Russian translations (102KB)  
- **uk.json** - Ukrainian translations (101KB)

#### Auto-Sync Mechanism
1. Commands define individual `localization_strings`
2. Bot startup syncs these to hub JSON files
3. Hub serves consolidated translations to all services
4. Missing keys fallback to English

### JSX Component Guidelines

#### Basic Structure
```jsx
const ComponentName = (props) => {
  const { interaction, database, i18n, coloring } = props;
  
  // Component logic
  const formattedValue = formatNumber(database.value);
  
  return (
    <div style={{
      width: 400,
      height: 200,
      backgroundColor: coloring.primary,
      padding: 20,
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Component content */}
    </div>
  );
};
```

#### Styling Rules
1. **Inline styles only** - No CSS classes or external stylesheets
2. **Absolute positioning** - Use precise positioning for layout
3. **Font specification** - Always specify font family
4. **Color theming** - Use `coloring` prop for consistent theming
5. **Responsive design** - Components should work at different scales

#### Best Practices
- **Props destructuring** - Always destructure required props
- **Conditional rendering** - Use ternary operators for conditional content
- **Error handling** - Provide fallbacks for missing data
- **Performance** - Avoid complex calculations in render
- **Localization** - Always use `i18n.__()` for text content

#### Image and Emoji Usage
```jsx
// Emoji usage
const emojiUrl = getEmojiUrl("🎉", scaling.emoji);
<img src={emojiUrl} width={20} height={20} />

// Image usage
<img 
  src={user.bannerUrl} 
  style={{ 
    width: 80, 
    height: 80, 
    borderRadius: '50%',
    objectFit: 'cover' 
  }} 
/>
```

---

## Service Communication

### API Architecture
The bot and hub services communicate via HTTP APIs:

```typescript
// Hub client interface
interface HubClient {
  // User operations
  getUser(userId: string, guildId: string): Promise<User>;
  updateUser(userId: string, guildId: string, data: Partial<User>): Promise<User>;
  
  // Economy operations  
  getBalance(userId: string, guildId: string): Promise<BalanceResponse>;
  addBalance(userId: string, guildId: string, amount: number): Promise<BalanceResponse>;
  
  // AI operations
  processAIHubStream(request: AiProcessRequest): Promise<AiStreamChunk>;
  processAIHubRequest(request: AiProcessRequest): Promise<AiProcessSuccessEnvelope>;
  
  // Rendering operations
  generateImage(component: string, props: Record<string, unknown>): Promise<Buffer>;
  processImageColors(imageUrl: string): Promise<ColorPalette>;
}
```

### Service Configuration
Services use environment-specific configuration (align bot env with these defaults):

| Service        | Default Port | Default URL              | Key Env Var                      | Notes |
|----------------|--------------|--------------------------|----------------------------------|-------|
| Database       | 3001         | http://localhost:3001    | DATABASE_SERVICE_URL (bot)       | Bot sample defaults to 3003 — align to 3001 or change table consistently. |
| AI             | 3002         | http://localhost:3002    | AI_SERVICE_URL                   | Per-model rate limits enforced in service. |
| Rendering      | 3003         | http://localhost:3003    | RENDERING_SERVICE_URL            | Takumi primary, raster fallback. |
| Localization   | 3004         | http://localhost:3004    | LOCALIZATION_SERVICE_URL         | Auto-sync from bot command strings. |

---

## Development Guidelines

### Local Development Quickstart
- Copy envs: `cp bot/.env.example bot/.env` and `cp hub/.env.example hub/.env` (service-specific envs inside subpackages as needed).
- Start services (new shells per service):
  - Bot: `bun run start` (cwd: /bot)
  - Hub root (composes services where applicable): `bun run start` (cwd: /hub)
  - Rendering preview (if needed): `bun run preview` (cwd: /hub/rendering)
- Health checks / quick calls:
  - Rendering: `POST /generate`
  - AI: `POST /process` (stream/non-stream based on route)
  - DB: Prisma service routes (see hub/database)

### Smoke Tests
- Rendering: call `/generate` with 2048 component; verify no cropping and timely response.
- AI: send a short prompt via `processAIHubStream`; confirm start/data/end envelopes.
- Database: create + fetch a user or balance; verify port alignment.
- Localization: run bot once to ensure command strings sync to hub locales.

### Coding Conventions
- TypeScript-first, ESM. No `any` unless guarded; keep ts-debt budget green.
- Imports: built-ins, externals, internals (absolute), relatives — grouped, no unused.
- Errors: throw rich errors with context; avoid silent catches.
- Logging: structured with guild/user/command and request IDs when proxying.
- Rendering: inline styles only; box-sizing:border-box expected; avoid per-render randomness.

### Performance Checklist (Rendering Components)
- Keep fixed widths/heights; include padding in logical dimensions (border-box).
- Cache emoji URLs; avoid repeated expensive color extraction.
- Avoid heavy calculations in render; precompute outside JSX.
- Use explicit objectFit/size on images; prefer WebP/AVIF where applicable.

### AI Tooling Handshake
- Payload contracts live in `hub/shared/src/contracts/hub.ts` (AI stream/envelopes, tool execution).
- `processAIHubStream` yields start/data/end/error envelopes; bot handlers must handle end/error explicitly.
- Tool execution: validate allowed tools, sanitize user content before forwarding, respect per-model rate limits.

### Tech Stack & Tooling
- **Languages**: TypeScript-first (ESM), JSX for rendering components.
- **Key libraries**: discord.js, Takumi rendering backend (`@takumi-rs/image-response`), color-thief-bun, @twemoji/api.
- **Package/runtime**: Bun scripts; Prisma for DB; Lavalink for music.
- **Type safety & debt**: `bun run typecheck`, `bun run ts-debt` (see package scripts for thresholds).

### Auth & Security
- Service-to-service calls: currently unauthenticated (no shared secret); add headers/tokens before exposing beyond trusted network.
- Bot: ensure Discord token/secrets in env; set required intents/permissions per command category.
- Outbound calls: restrict to allowed providers (AI, Lavalink) and sanitize user content where applicable.

### Logging & Observability
- Logging: prefer structured logs with context (guild/user/command); include request IDs when proxying to hub services.
- Metrics/tracing: not yet standardized; consider adding request timers and error counters per service.

### AI Models & Limits
- Providers: Groq, Replicate, DeepInfra (configured in `/hub/ai`).
- Model choice + rate limits: enforced per-model in AI service; tool execution allowed when provided in payload.
- Streaming envelopes: `processAIHubStream` yields chunked responses; handle end/error envelopes in bot handler.

### Music (Lavalink)
- Requires Lavalink node configured via env; reconnect/backoff not detailed—ensure node URL/password set.
- Filters: standard Lavalink filters supported; source priority: YouTube/Spotify/SoundCloud via LavaSearch.

### Localization Sync
- Commands define `localization_strings`; bot startup syncs to hub JSON.
- If manual sync needed: run bot once or trigger sync script in bot startup pipeline (see `/bot/src` loaders).

### Testing & QA
- Type checks: `bun run typecheck` (bot/hub).
- TS debt gates: `bun run ts-debt` (bot/hub).
- Lint/tests: none standardized; run service-specific checks if added.

### Adding New Commands

1. **Create category directory** if needed
2. **Add index.ts** with main command definition
3. **Add subcommand files** for complex commands
4. **Include localization_strings** with all three languages
5. **Test command loading** via `loadCommands()` utility

### Creating New Components

1. **Create JSX file** in `/hub/rendering/src/components/`
2. **Follow component structure** with props destructuring
3. **Use inline styles** with proper theming
4. **Add localization** via `i18n.__()` calls
5. **Test rendering** via `/generate` endpoint

### Database Changes

1. **Update schema.prisma** with new models/fields
2. **Run migration** via Prisma CLI
3. **Update TypeScript types** if needed
4. **Test database service** endpoints
5. **Update bot integration** if required

### Localization Updates

1. **Add keys to command files** as needed
2. **Run sync process** to update JSON files
3. **Verify translations** in all languages
4. **Test fallback behavior** for missing keys

### Service Deployment

Each service is independently deployable:
- **Database service** - PostgreSQL + Prisma
- **AI service** - Node.js + AI provider APIs  
- **Rendering service** - Node.js + Takumi/Sharp
- **Localization service** - Node.js + JSON files
- **Bot** - Discord.js + all hub services

### Known Pitfalls
| Risk / TODO | Area | Status | Notes / Owner |
|-------------|------|--------|----------------|
| DB port mismatch | Config | Open | Bot sample env defaults to 3003; hub DB uses 3001. Align URLs or change defaults consistently. |
| Missing `isTestWallet` field | DB | Open | `cryptoWalletService` references field absent in Prisma schema; adjust schema or code before use. |
| `mexcService.disconnectWebSocket` unimplemented | DB | Open | Called from crypto wallet flow but not implemented; add or remove call. |
| Rendering sizing assumptions | Rendering | Mitigated | Takumi uses logical dimensions + devicePixelRatio; components expect `box-sizing: border-box` to avoid cropping. |
| Legacy JS file | Bot | Open | Migrate `bot/src/games/risky/crypto2.js` to TypeScript or accept debt. |

---

This architecture guide provides the foundation for understanding and extending the Eleazar bot ecosystem. For specific implementation details, refer to the individual service documentation and source code.
