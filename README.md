# Eleazar Discord Bot

<img width="2523" height="866" alt="Untitled" src="https://github.com/user-attachments/assets/716e630a-fe5a-489d-82d4-c6bfb3386728" />

**Eleazar** is a multifunctional Discord bot featuring AI capabilities (text transcription, image generation, chatting), games, economy system, music playback, counting games, and image filters.

The main reason why this project is unique because of the vision how the things has to be looking. Its easy to use, has a lot of features and unique styling.

It supports localization to English, Ukraine and Russian.

<img width="3056" height="1127" alt="Frame 69" src="https://github.com/user-attachments/assets/66a1bc5e-9c66-43a1-88f6-d8fc32bd8c26" />

<img width="2718" height="2573" alt="Frame 37" src="https://github.com/user-attachments/assets/3b60ad87-eb77-445d-85e8-50896755b335" />

<img width="3338" height="2301" alt="Frame 70" src="https://github.com/user-attachments/assets/6cf75a67-8a5a-4c5c-a984-ec23c1c5e4ac" />

<img width="2690" height="990" alt="image" src="https://github.com/user-attachments/assets/e56d66dc-2e4f-4e3a-b47f-f9ebf186363d" />

## Development Notes!!!

> Most of this code has been AI-generated without specific plans or progression checking, so many things may look "messy" or overcomplicated and could be simplified significantly.
>
> I'm making this project public in case someone on the internet finds it helpful. Maybe together we could potentially finish this amazing project. I just need someones help to make this project to its end...
>
> My contacts are in the bottom of this README

## Setup Options

**Choose the setup method that best fits your needs:**

### Hub/Bot Setup (Recommended)

- **Simple:** Two-component setup with hub managing database operations and bot handling Discord interactions
- **Features:**
  - Clean separation of concerns
  - Scalable architecture
  - Easy to maintain and extend
  - Supports both Bun and Node.js runtimes
- **Note:** This is the current active setup, no Colyseus or activities required

> I'm also planning to add more simplier Docker or Railway template setup quide in future for this project.

---

### Prerequisites (Common for all setups)

- **Bun** runtime (v1.0.0 or higher) **OR** **Node.js** runtime (v16.0.0 or higher)
- **PostgreSQL** database server
- **Redis** server
- **Lavalink** server (for music functionality)
- **WSL** (recommended for Windows users)

### API Services Requirements

- **Discord Bot Token** (from Discord Developer Portal)
- **OpenRouter** AND **Groq** (for ai text models and voice transcription with groq)
- **HuggingFace** OR **DeepInfra** or **Replicate** (for image generating)
- **CoinMarketCap** for the bot's Crypto game support to show coin prices.

---

### Common Installation Steps

1. **Install Runtime** (choose one)

   **Option A: Install Bun** (recommended for performance)

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

   **Option B: Install Node.js** (if you prefer Node.js)

   ```bash
   # Using Node Version Manager (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install node

   # Or download directly from https://nodejs.org/
   ```

2. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd eleazar
   ```

3. **Set up PostgreSQL Database**

   - Install PostgreSQL on your system
   - Create a new database for the bot

4. **Set up Redis Server**

   - Install Redis on your system
   - Start Redis server:

   ```bash
   # Ubuntu/Debian
   sudo systemctl start redis-server
   # Or run directly
   redis-server
   ```

   - Verify Redis is running:

   ```bash
   redis-cli ping
   ```

5. **Create Discord Bot**

   - Go to Discord Developer Portal (https://discord.com/developers/applications)
   - Create a new application and bot
   - Copy the bot token
   - **Important:** Enable "Message Content Intent" in the Bot settings

6. **Configure Lavalink**
   Choose one of the following options:

   **Option 1: Run Your Own Lavalink Server**

   - Download Lavalink.jar from the official repository
   - Use the provided `application.yml` configuration file
   - Configure external Lavalink servers in `/src/utils/music.js` (lines 48-78)
   - Start Lavalink server:

   ```bash
   java -jar Lavalink.jar
   ```

   **Recommended Lavalink Plugins:**
   For enhanced functionality, consider adding these plugins to your `plugins/` folder:

   - **lavalink-2.6.1.jar** - Core Lavalink server
   - **lavalyrics-plugin-1.0.0.jar** - Lyrics support
   - **lavasearch-plugin-1.0.0.jar** - Enhanced search capabilities
   - **lavasrc-plugin-4.3.0.jar** - Additional audio sources
   - **skybot-lavalink-plugin-1.7.0.jar** - Extended platform support
   - **sponsorblock-plugin-3.0.1.jar** - SponsorBlock integration
   - **youtube-plugin-1.11.3.jar** - YouTube source support

   **Option 2: Use External Lavalink Servers (Recommended for beginners)**

   - Use free external Lavalink servers instead of running your own
   - Visit https://lavalink-list.darrennathanael.com/ for a list of available servers
   - Configure the servers in `/src/utils/music.js` (lines 48-78)
   - No need to run your own Lavalink instance

---

### Standalone Setup (Recommended)

Based on [THIS COMMIT b7b6abb](https://github.com/Ve-Jo/eleazar/tree/b7b6abb9e1e8e68a8ba0455a5489069d21ad0b6d)

**API Services Requirements:**
You'll need to obtain and configure these API keys in your `.env` file:

- **Discord Bot Token** (from Discord Developer Portal)
- **OpenRouter** AND **Groq** (for ai text models and voice transcription with groq)
- **HuggingFace** OR **DeepInfra** or **Replicate** (for image generating)
- **CoinMarketCap** for the bot's Crypto game support to show coin prices.

**After completing the common installation steps above:**

1. **Install Dependencies**

   ```bash
   bun install
   ```

2. **Set up Database with Prisma**

   ```bash
   bunx prisma generate
   bunx prisma db push  # For development
   # OR for production:
   bunx prisma migrate deploy
   ```

3. **Environment Configuration**

   - Copy `.env.example` to `.env`
   - Fill in the required environment variables:
     - Discord bot token
     - Database connection string (PostgreSQL)
     - Redis connection details
     - API keys for AI services
     - Lavalink server configuration

4. **Run the Bot**
   ```bash
   bun run bot
   ```

---

### Hub Setup

This setup uses a separate hub project that manages database operations and provides API endpoints for the bot.

**API Services Requirements:**
You'll need to obtain and configure these API keys in your `.env` file:

- **Discord Bot Token** (from Discord Developer Portal)
- **OpenRouter** AND **Groq** (for ai text models and voice transcription with groq)
- **HuggingFace** OR **DeepInfra** or **Replicate** (for image generating)
- **CoinMarketCap** for the bot's Crypto game support to show coin prices.

**After completing the common installation steps above:**

1. **Install All Dependencies**

   ```bash
   cd hub
   bun run install:all
   cd ..
   ```

   This command installs dependencies for both the main bot and hub projects.

2. **Set up Database with Prisma (Hub Project)**

   - Note: The Prisma database is now located in the hub project
   - Navigate to the hub directory and run:

   ```bash
   cd hub
   bunx prisma generate
   bunx prisma db push  # For development
   # OR for production:
   bunx prisma migrate deploy
   cd ..
   ```

3. **Environment Configuration**

   The project uses a distributed environment configuration system. You'll need to set up environment files in multiple locations:

   **Main Configuration Files:**

   - Copy `bot/.env.example` to `bot/.env`
   - Copy `hub/.env.example` to `hub/.env`

   **Service-Level Configuration Files:**

   - Copy `hub/ai/.env.example` to `hub/ai/.env`
   - Copy `hub/database/.env.example` to `hub/database/.env` (or use the existing one)
   - Copy `hub/rendering/.env.example` to `hub/rendering/.env` (or use the existing one)

   **Required Environment Variables:**

   - **Discord bot token** (in `bot/.env`)
   - **Database connection string** (PostgreSQL) (in `hub/.env` and `hub/database/.env`)
   - **Redis connection details** (in `bot/.env`, `hub/.env`, and `hub/ai/.env`)
   - **API keys for AI services** (in `bot/.env` and `hub/.env`)
   - **Lavalink server configuration** (in `bot/.env`)
   - **Service ports and hosts** (in individual service `.env` files)

4. **Run the Hub and Bot**

   ```bash
   # Start PostgreSQL and Redis services
   sudo service postgresql start
   sudo service redis-server start

   # Start the hub server
   cd hub && bun run start
   # Or with Node.js: cd hub && npm run start

   # In a separate terminal, start the main bot
   cd bot && bun run start
   # Or with Node.js: cd bot && npm run start
   ```

---

### Legacy Setups

**Note:** The following setups are deprecated and no longer maintained:

- **Standalone Setup** - Single-project setup (outdated but functional)
- **Activities Setup** - Required Colyseus and complex tunneling configuration

The **Hub/Bot Setup** above is the recommended and currently maintained approach.

---

### Contact

If you're interested in collaborating or have questions about the project, feel free to reach out:

- **Discord:** @vejoy\_
- **Telegram:** [VeJoy's Thoughts](https://t.me/vejoysthoughts) (ask about this project in comments somewhere and i'll reach to you and DM you)

_Feel free to contribute or reach out if you're interested in collaborating!_
