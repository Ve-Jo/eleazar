# README

> **⚠️ Work In Progress!**
>
> I'll add all needed information about how to setup and run this project later **DURING THIS DAY**.

## Setup Options

### Hub/Activities Setup (Recommended)

This setup uses a separate hub project that manages activities and database operations.

#### Prerequisites
- **Bun** runtime (v1.0.0 or higher)
- **PostgreSQL** database server
- **Redis** server
- **Lavalink** server (for music functionality)
- **WSL** (recommended for Windows users)

#### Installation Steps

1. **Install Bun Runtime** (if not already installed)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd eleazar
   ```

3. **Install All Dependencies**
   ```bash
   bun run install:all
   ```
   This command installs dependencies for both the main bot and hub projects.

4. **Set up PostgreSQL Database**
   - Install PostgreSQL on your system
   - Create a new database for the bot
   - Note: The Prisma database is now located in the hub project
   - Navigate to the hub directory and run:
   ```bash
   cd hub
   bunx prisma generate
   bunx prisma db push  # For development
   # OR for production:
   bunx prisma migrate deploy
   ```

5. **Set up Redis Server**
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

6. **Create Discord Bot**
   - Go to Discord Developer Portal (https://discord.com/developers/applications)
   - Create a new application and bot
   - Copy the bot token
   - **Important:** Enable "Message Content Intent" in the Bot settings

7. **Configure Lavalink**
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

8. **Environment Configuration**
   - Copy `.env.example` to `.env` in both main and hub directories
   - Fill in the required environment variables:
     - Discord bot token
     - Database connection string (PostgreSQL)
     - Redis connection details
     - API keys for AI services
     - Lavalink server configuration

9. **Set up Activities Project** (Optional - for Discord Activities)
   The activities project provides multiplayer games and interactive features through Discord Activities.
   
   - Navigate to the activities directory:
   ```bash
   cd ../eleazar-activities  # Assuming it's in a sibling directory
   ```
   
   - Install dependencies:
   ```bash
   bun install
   ```
   
   - Set up environment variables in `.env`:
   ```bash
   VITE_DISCORD_CLIENT_ID=your_discord_client_id
   VITE_DISCORD_CLIENT_SECRET=your_discord_client_secret
   VITE_BOT_API_URL=http://localhost:3003
   ```
   
   - Install and set up Cloudflared tunnels:
   ```bash
   # Install cloudflared (Ubuntu/Debian)
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   
   # Create tunnel for Vite client (port 5173) - Terminal 4
   cloudflared tunnel --url http://localhost:5173
   
   # Create tunnel for Colyseus server (port 2567) - Terminal 5
   cloudflared tunnel --url http://localhost:2567
   ```
   
   **Important:** Note the generated tunnel URLs (e.g., `random-name.trycloudflare.com`) as you'll need them for Discord Activity URL mappings.
   
   - Configure Discord Activity URL Mappings:
     1. Go to Discord Developer Portal: https://discord.com/developers/applications
     2. Select your application → Embedded App → URL Mappings
     3. Set up the mappings:
        - **Root Mapping:**
          - Prefix: `/`
          - Target: `your-vite-tunnel.trycloudflare.com` (from Vite tunnel)
        - **Proxy Path Mapping:**
          - Prefix: `/colyseus`
          - Target: `your-colyseus-tunnel.trycloudflare.com` (from Colyseus tunnel)
   
   - Run the activities services (requires 5 separate terminals):
   ```bash
   # Terminal 1: Start Colyseus multiplayer server
   bun run dev:colyseus
   
   # Terminal 2: Start activities API server
   bun run dev:server
   
   # Terminal 3: Start Vite client development server
   bun run dev:client
   
   # Terminal 4: Cloudflared tunnel for Vite (already running from step above)
   # Terminal 5: Cloudflared tunnel for Colyseus (already running from step above)
   ```

10. **Run the Hub and Bot**
    ```bash
    # Start the hub server
    bun run start
    
    # In a separate terminal, start the main bot
    bun run bot
    ```

### Standalone Setup (RECOMMENDED) based on [THIS COMMIT b7b6abb](https://github.com/Ve-Jo/eleazar/tree/b7b6abb9e1e8e68a8ba0455a5489069d21ad0b6d)

#### Prerequisites

- **Bun Runtime** (Node.js won't work)
- **PostgreSQL** database
- **Redis** server
- **Lavalink** music node
- **Windows users:** This project is developed and tested on WSL (Windows Subsystem for Linux), so WSL is recommended for Windows users (for music features)

#### Required API Keys

- **OpenRouter** API key (for AI text-to-text models)
- **Groq** API key (for AI text-to-text models)
- **HuggingFace** OR **DeepInfra** OR **Replicate** API key (for image generation)

#### Installation Steps

1. **Install Bun Runtime**

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone the Repository**

   ```bash
   git clone https://github.com/Ve-Jo/eleazar.git
   cd eleazar
   ```

3. **Install Dependencies**

   ```bash
   bun install
   ```

4. **Setup PostgreSQL**

   - Install PostgreSQL on your system
   - Create a database for the bot
   - Note down the connection details in .env
   - Set up the database schema using Prisma:

     ```bash
     # Generate Prisma client
     bunx prisma generate

     # Push schema to database (for development)
     bunx prisma db push

     # OR run migrations (for production)
     bunx prisma migrate deploy
     ```

5. **Setup Redis**
   - Install Redis on your system
   - Start the Redis server:
     ```bash
     # On Ubuntu/Debian
     sudo systemctl start redis-server
     
     # Or run directly
     redis-server
     
     # Verify Redis is running
     redis-cli ping
     ```
   - Default port: 6379

6. **Setup Discord Bot**

   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application and bot
   - Copy the bot token
   - **Important:** Enable "Message Content Intent" in Bot settings
   - Invite the bot to your server with appropriate permissions

7. **Setup Lavalink**
   - **Option 1: Run your own Lavalink server**
     - Download Lavalink from [official releases](https://github.com/lavalink-devs/Lavalink/releases)
     - Use the provided configuration file from `eleazar-lavalink/application.yml`
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

   - **Option 2: Use external Lavalink servers (Recommended for beginners)**
     - Find free Lavalink servers at: https://lavalink-list.darrennathanael.com/
     - Configure external servers in `/src/utils/music.js` (lines 48-78)
     - No need to run your own Lavalink instance

8. **Environment Configuration**

   - Copy `.env.example` to `.env`
   - Fill in all required environment variables:

     ```env
     # Database
     DATABASE_URL=postgresql://username:password@localhost:5432/eleazar

     # Redis
     REDIS_URL=redis://localhost:6379

     # Discord
     DISCORD_TOKEN=your_discord_bot_token

     # AI APIs
     OPENROUTER_API_KEY=your_openrouter_key
     GROQ_API_KEY=your_groq_key

     # Image Generation
     HUGGINGFACE_API_KEY=your_huggingface_key
     DEEPINFRA_API_KEY=your_deepinfra_key
     # OR
     REPLICATE_API_KEY=your_replicate_key

     # Lavalink
     LAVALINK_HOST=localhost
     LAVALINK_PORT=2333
     LAVALINK_PASSWORD=youshallnotpass
     ```

9. **Run the Bot**
   ```bash
   bun run bot.js
   ```

### Setup with Hub/Activities (Harder)

🚧 **Work In Progress**

## Requirements

### System Requirements

- **Bun Runtime** (latest version)
- **PostgreSQL** 12+
- **Redis** 6+
- **Java** 17+ (for Lavalink)

### API Services

- **Discord Bot Token** (from Discord Developer Portal)
- **OpenRouter** account and API key
- **Groq** account and API key
- **HuggingFace** account and API key
- **DeepInfra** or **Replicate** account and API key

## Project Structure

Currently, the latest commit of this project is being split up into three repositories:

- [eleazar](https://github.com/Ve-Jo/eleazar) - Main bot repository
- [eleazar-activities](https://github.com/Ve-Jo/eleazar-activities) - Voice activity repo
- [eleazar-hub](https://github.com/Ve-Jo/eleazar-hub) - Eleazar's hub module (where i migrate all main things for future scaling)

## Development Notes

> **Note:** Most of this code has been AI-generated without specific plans or progression checking, so many things may look "messy" or overcomplicated and could be simplified significantly.

## Project Status

I'm tired of working on this project alone until its release state, so I'm stepping away from making Discord bots and planning to work on something else.

I'm making this project public in case someone on the internet finds it helpful. Maybe together we could potentially finish this amazing project.

## Contact

If you're interested in collaborating or have questions about the project, feel free to reach out:

- **Discord:** @vejoy\_
- **Telegram:** [VeJoy's Thoughts](https://t.me/vejoysthoughts) (ask about this project in comments somewhere and i'll reach to you and DM you)

---

_Feel free to contribute or reach out if you're interested in collaborating!_
