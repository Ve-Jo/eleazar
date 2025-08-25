# Eleazar Discord Bot

<img width="2523" height="866" alt="Untitled" src="https://github.com/user-attachments/assets/716e630a-fe5a-489d-82d4-c6bfb3386728" />

**Eleazar** is a multifunctional Discord bot featuring AI capabilities (text transcription, image generation, chatting), games, economy system, music playback, counting games, and image filters.

The main reason why this project is unique because of the vision how the things has to be looking. Its easy to use, has a lot of features and unique styling.

It supports localization to English, Ukraine and Russian.

<img width="3056" height="1127" alt="Frame 69" src="https://github.com/user-attachments/assets/66a1bc5e-9c66-43a1-88f6-d8fc32bd8c26" />

<img width="2718" height="2573" alt="Frame 37" src="https://github.com/user-attachments/assets/3b60ad87-eb77-445d-85e8-50896755b335" />

<img width="3338" height="2301" alt="Frame 70" src="https://github.com/user-attachments/assets/6cf75a67-8a5a-4c5c-a984-ec23c1c5e4ac" />

<img width="2690" height="990" alt="image" src="https://github.com/user-attachments/assets/e56d66dc-2e4f-4e3a-b47f-f9ebf186363d" />

## Project Structure

Currently, the latest commit of this project is being split up into three repositories:

- [eleazar](https://github.com/Ve-Jo/eleazar) - Main bot repository
- [eleazar-activities](https://github.com/Ve-Jo/eleazar-activities) - Voice activity repo
- [eleazar-hub](https://github.com/Ve-Jo/eleazar-hub) - Eleazar's hub module (where i migrate all main things for future scaling)

## Development Notes

> **Note:** Most of this code has been AI-generated without specific plans or progression checking, so many things may look "messy" or overcomplicated and could be simplified significantly.

## Project Status

I'm tired of working on this project alone until its release state, so I'm stepping away from making Discord bots and planning to work on something else. That means that currently this project is not in his final releasable state, so it can break and look broken.

I'm making this project public in case someone on the internet finds it helpful. Maybe together we could potentially finish this amazing project. I just need someones help to make this project to its end...

My contants are in the bottom of this README

## Setup Options

**Choose the setup method that best fits your needs:**

### Standalone Setup
- **Simple:** Single-project setup with all features in one place
- **Features:**
  - Complete functionality preset
  - Multiple built-in games, but they're simplier and can be demanding on scale
  - Games accessible via `/work` command
  - Interactive button-based updates
- **Note:** Slightly outdated but fully functional

### Hub/Activities Setup
- **Advanced:** Recommended for production environments
- **Features:**
  - 3D 2048 game implementation, but ITS ONLY ONE (standalone has more games, but they're 2D and simplier)
  - More easier code on eleazar's bot side, because other things gets moved separately
  - Multiplayer support via Colyseus
  - Production-ready scalable architecture
  - Possibilities in implementing other things to infrastructure (like websites or else)
- **Note:** Requires additional setup and configuration steps

### Prerequisites (Common for all setups)
- **Bun** runtime (v1.0.0 or higher)
- **PostgreSQL** database server
- **Redis** server
- **Lavalink** server (for music functionality)
- **WSL** (recommended for Windows users)

### API Services Requirements

- **Discord Bot Token** (from Discord Developer Portal)
- **OpenRouter** AND **Groq** (for ai text models and voice transcription with groq)
- **HuggingFace** OR **DeepInfra** or **Replicate** (for image generating)
- **CoinMarketCap** for the bot's Crypto game support to show coin prices.

### Common Installation Steps

1. **Install Bun Runtime** (if not already installed)
   ```bash
   curl -fsSL https://bun.sh/install | bash
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
   - Copy `.env.example` to `.env` in both main and hub directories
   - Fill in the required environment variables:
     - Discord bot token
     - Database connection string (PostgreSQL)
     - Redis connection details
     - API keys for AI services
     - Lavalink server configuration

4. **Run the Hub and Bot**
   ```bash
   # Start the hub server
   bun run start
   
   # In a separate terminal, start the main bot
   bun run bot
   ```

---

### Activities Setup (Optional)

The activities project provides multiplayer games and interactive features through Discord Activities. This is completely separate from the Hub setup.

**Prerequisites:**
- Hub setup must be completed first
- **Cloudflared** (for tunneling)
- Access to the `eleazar-activities` project

**API Services Requirements:**
You'll need to obtain and configure these API keys in your `.env` file:
- **Discord Bot Token** (from Discord Developer Portal)
- **OpenRouter** AND **Groq** (for ai text models and voice transcription with groq)
- **HuggingFace** OR **DeepInfra** or **Replicate** (for image generating)
- **CoinMarketCap** for the bot's Crypto game support to show coin prices.

**Setup Steps:**

1. **Navigate to Activities Directory**
   ```bash
   cd ../eleazar-activities  # Assuming it's in a sibling directory
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Environment Configuration**
   Set up environment variables in `.env`:
   ```bash
   VITE_DISCORD_CLIENT_ID=your_discord_client_id
   VITE_DISCORD_CLIENT_SECRET=your_discord_client_secret
   VITE_BOT_API_URL=http://localhost:3003
   ```

4. **Install and Configure Cloudflared**
   ```bash
   # Install cloudflared (Ubuntu/Debian)
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

5. **Set up Cloudflared Tunnels**
   ```bash
   # Create tunnel for Vite client (port 5173) - Terminal 4
   cloudflared tunnel --url http://localhost:5173
   
   # Create tunnel for Colyseus server (port 2567) - Terminal 5
   cloudflared tunnel --url http://localhost:2567
   ```
   
   **Important:** Note the generated tunnel URLs (e.g., `random-name.trycloudflare.com`) as you'll need them for Discord Activity URL mappings.

6. **Configure Discord Activity URL Mappings**
   1. Go to Discord Developer Portal: https://discord.com/developers/applications
   2. Select your application → Embedded App → URL Mappings
   3. Set up the mappings:
      - **Root Mapping:**
        - Prefix: `/`
        - Target: `your-vite-tunnel.trycloudflare.com` (from Vite tunnel)
      - **Proxy Path Mapping:**
        - Prefix: `/colyseus`
        - Target: `your-colyseus-tunnel.trycloudflare.com` (from Colyseus tunnel)

7. **Run Activities Services**
   Run the following commands in separate terminals (requires 5 total terminals):
   ```bash
   # Terminal 1: Start Colyseus multiplayer server
   bun run dev:colyseus
   
   # Terminal 2: Start activities API server
   bun run dev:server
   
   # Terminal 3: Start Vite client development server
   bun run dev:client
   
   # Terminal 4: Cloudflared tunnel for Vite (already running from step 5)
   # Terminal 5: Cloudflared tunnel for Colyseus (already running from step 5)
   ```

---

### Contact

If you're interested in collaborating or have questions about the project, feel free to reach out:

- **Discord:** @vejoy\_
- **Telegram:** [VeJoy's Thoughts](https://t.me/vejoysthoughts) (ask about this project in comments somewhere and i'll reach to you and DM you)

_Feel free to contribute or reach out if you're interested in collaborating!_
