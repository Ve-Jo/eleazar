const LinearGraph = ({
  width,
  height,
  data = [],
  color = "#5865F2",
  scale = 1,
}) => {
  const normalizeData = (data) => {
    if (data.length === 0) return [];
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = range * 0.1;
    return data.map(
      (value) =>
        height -
        ((value - min + padding) / (range + 2 * padding)) * height * 0.8
    );
  };

  const baseStrokeWidth = 2; // Base stroke width for scale=1
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const normalizedData = normalizeData(data);
  if (normalizedData.length < 2) return null;

  // Generate points using original dimensions
  const points = normalizedData.map((y, i) => ({
    x: (i / (data.length - 1)) * width,
    y,
  }));

  // Generate smooth path (using original dimensions)
  const pathData = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x},${point.y}`;

    const prev = arr[i - 1];
    const cp1 = {
      x: prev.x + (point.x - prev.x) * 0.25,
      y: prev.y,
    };
    const cp2 = {
      x: prev.x + (point.x - prev.x) * 0.85,
      y: point.y,
    };

    return `${acc} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${point.x},${point.y}`;
  }, "");

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        shapeRendering: "crispEdges",
        transformOrigin: "0 0",
      }}
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={baseStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathData} L ${width},${height} L 0,${height} Z`}
        fill="url(#gradient)"
        stroke="none"
      />
    </svg>
  );
};

const Statistics = (props) => {
  let { interaction, database, i18n } = props;

  const translations = {
    title: await i18n.__("components.Statistics.title") || "Статистика",
    servers:
      await i18n.__("components.Statistics.servers") ||
      `${Math.floor(Math.random() * 100) + 1} серверов`,
    latency:
      await i18n.__("components.Statistics.latency") ||
      `${Math.floor(Math.random() * 100) + 1} мс`,
    /*cache_latency:
      await i18n.__("components.Statistics.cache_latency") ||
      `Кэш: ${Math.floor(Math.random() * 10) + 1} мс`,*/
    shards: await i18n.__("components.Statistics.shards") || "Шарды",
    /*music: await i18n.__("components.Statistics.music") || "Музыкал. нода",
    music_players:
      await i18n.__("components.Statistics.music_players") ||
      `${Math.floor(Math.random() * 10) + 1} плееров`,
    render: await i18n.__("components.Statistics.render") || "Рендер сервер",
    render_requests:
      await i18n.__("components.Statistics.render_requests") ||
      `${Math.floor(Math.random() * 10) + 1} запросов`,
    database: await i18n.__("components.Statistics.database") || "База данных",
    database_ping:
      await i18n.__("components.Statistics.database_ping") ||
      `Сред. скорость: ${Math.floor(Math.random() * 10) + 1} мс`,*/
  };

  // Initialize database if not provided
  if (!database) {
    database = {
      bot_stats: {
        guilds_stats: Array.from({ length: 100 }, () => {
          return Math.floor(Math.random() * 100) + 1;
        }),
        /*database_pings: Array.from({ length: 10 }, () => {
          return Math.floor(Math.random() * 100) + 1;
        }),
        render_pings: Array.from({ length: 10 }, () => {
          return Math.floor(Math.random() * 100) + 1;
        }),
        music_pings: Array.from({ length: 10 }, () => {
          return Math.floor(Math.random() * 100) + 1;
        }),*/
      },
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
    };
  }

  if (!interaction?.bot) {
    interaction.bot = {
      shards: [
        {
          id: 1,
          guilds: Math.floor(Math.random() * 100) + 1,
          ping: Array.from(
            { length: 6 },
            () => Math.floor(Math.random() * 150) + 1
          ),
        },
        {
          id: 2,
          guilds: Math.floor(Math.random() * 100) + 1,
          ping: Array.from(
            { length: 6 },
            () => Math.floor(Math.random() * 150) + 1
          ),
        },
        {
          id: 3,
          guilds: Math.floor(Math.random() * 100) + 1,
          ping: Array.from(
            { length: 6 },
            () => Math.floor(Math.random() * 150) + 1
          ),
        },
        {
          id: 4,
          guilds: Math.floor(Math.random() * 100) + 1,
          ping: Array.from(
            { length: 6 },
            () => Math.floor(Math.random() * 150) + 1
          ),
        },
      ],
    };
  }

  return (
    <div
      style={{
        width: "320px",
        height: "210px",
        position: "relative",
        backgroundColor: "black",
        fontFamily: "Inter800, sans-serif",
        padding: "0px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/*Header with title on left and bot avatar on right*/}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "6px",
          gap: "10px",
        }}
      >
        {/*Header itself with Statistics and bot avatar*/}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div style={{ color: "white", fontSize: "32px", display: "flex" }}>
            {translations.title}
          </div>
          <div style={{ color: "white", display: "flex" }}>
            <img
              src={
                database?.avatar_url ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Bot Avatar"
              style={{ width: "35px", height: "35px", borderRadius: "25%" }}
            />
          </div>
        </div>
        {/*Servers counter with the line graph*/}
        <div
          style={{
            color: "white",
            fontSize: "16px",
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <div style={{ display: "flex" }}>{translations.servers}</div>
          {/*Graph itself*/}
          <div
            style={{
              width: "100%",
              height: "50px",
              marginTop: "4px",
              borderRadius: "4px",
              position: "relative",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: "scale(0.5)",
            }}
          >
            <LinearGraph
              width={320}
              height={40}
              data={database.bot_stats.guilds_stats}
              color="#5865F2"
              scale={2}
            />
          </div>
        </div>
        {/* Gray rectangle, right upper text "Shards" */}
        <div
          style={{
            display: "flex",
            color: "white",
            fontSize: "16px",
            backgroundColor: "#1D1D1D",
            flexDirection: "column",
            width: "100%",
            height: "65px",
            borderRadius: "10px",
            position: "relative",
            padding: "8px",
          }}
        >
          {/* Top right corner label */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              right: "8px",
              top: "4px",
              fontSize: "14px",
            }}
          >
            {translations.shards}
          </div>

          {/* Shards container */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              height: "100%",
              width: "100%",
              gap: "2%",
              padding: "0 2%",
            }}
          >
            {interaction.bot.shards.map((shard) => {
              // Dynamic calculations
              const totalShards = interaction.bot.shards.length;
              const baseWidth = 320; // Total container width
              const graphBaseWidth =
                (baseWidth / totalShards) *
                (0.8 - interaction.bot.shards.length * 0.1);

              // Font size decreases for higher shard IDs
              const fontSize = 65 * Math.pow(0.85, shard.id - 1);

              return (
                <div
                  key={shard.id}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-end",
                    flex: "1 1 0",
                    minWidth: "0",
                    height: "100%",
                  }}
                >
                  {/* Shard Number */}
                  <div
                    style={{
                      display: "flex",
                      fontSize: `${fontSize}px`,
                      color: "#A4A4A4",
                      fontWeight: "bold",
                      lineHeight: "0.8",
                      marginBottom: "-10px",
                      flexShrink: 0,
                      marginRight: "3px", // Space between number and stats
                    }}
                  >
                    {shard.id}
                  </div>

                  {/* Stats Container */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "flex-start",
                      height: "100%",

                      marginBottom: "-6px",
                      flex: "1 1 0",
                      minWidth: "0",
                    }}
                  >
                    {/* Server Count */}
                    <div
                      style={{
                        display: "flex",
                        fontSize: `${
                          8 - interaction.bot.shards.length * 0.5
                        }px`,
                        color: "#A4A4A4",
                        marginBottom: "2px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {translations.servers}
                    </div>

                    {/* Latency */}
                    <div
                      style={{
                        display: "flex",
                        fontSize: `${
                          10 - interaction.bot.shards.length * 0.5
                        }px`,
                        color: "#7AA973",
                        marginBottom: "20px",
                      }}
                    >
                      {translations.latency}
                    </div>

                    {/* Dynamic Graph */}
                    <div
                      style={{
                        display: "flex",
                        position: "absolute",
                        bottom: "15%",
                        left: "-25%",
                        width: "100%",
                        height: "15px",
                        transform: "scale(0.5)",
                      }}
                    >
                      <LinearGraph
                        width={graphBaseWidth}
                        height={15}
                        data={shard.ping}
                        color="#7AA973"
                        scale={2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Three rectangles container */}
        <div
          style={{
            opacity: 0,
            display: "flex",
            gap: "8px",
            width: "295px",
            marginTop: "0px",
          }}
        >
          {/* Music Node Rectangle */}
          <div
            style={{
              color: "white",
              backgroundColor: "#1D1D1D",
              width: "33%",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                display: "flex",
                color: "#A4A4A4",
                flexDirection: "column",
              }}
            ></div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  color: "#7AA973",
                  fontSize: "10px",
                  whiteSpace: "nowrap",
                  marginBottom: "10px",
                }}
              >
                {translations.latency}
              </div>
              <div
                style={{
                  display: "flex",
                  marginBottom: "5px",
                  position: "absolute",
                  bottom: "-10%",
                  right: "-30%",
                  transform: "scale(0.5)",
                }}
              >
                <LinearGraph
                  width={50}
                  height={15}
                  data={database.bot_stats.music_pings}
                  color="#7AA973"
                  scale={2}
                />
              </div>
            </div>
            <div
              style={{ color: "#A4A4A4", fontSize: "7px", marginTop: "-5px" }}
            ></div>
          </div>

          {/* Render Server Rectangle */}
          <div
            style={{
              color: "white",
              backgroundColor: "#1D1D1D",
              width: "33%",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                display: "flex",
                color: "#A4A4A4",
                flexDirection: "column",
              }}
            ></div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  color: "#7AA973",
                  fontSize: "10px",
                  whiteSpace: "nowrap",
                  marginBottom: "10px",
                }}
              >
                20 ms
              </div>
              <div
                style={{
                  display: "flex",
                  marginBottom: "5px",
                  position: "absolute",
                  bottom: "-10%",
                  right: "-30%",
                  transform: "scale(0.5)",
                }}
              >
                <LinearGraph
                  width={50}
                  height={15}
                  data={database.bot_stats.render_pings}
                  color="#7AA973"
                  scale={2}
                />
              </div>
            </div>
            <div
              style={{ color: "#A4A4A4", fontSize: "7px", marginTop: "-5px" }}
            >
              {translations.render_requests}
            </div>
          </div>

          {/* Database Rectangle */}
          <div
            style={{
              color: "white",
              backgroundColor: "#1D1D1D",
              width: "33%",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: "8px",
                display: "flex",
                top: "11px",
                backgroundColor: "#2D2D2D",
                padding: "4px",
                borderRadius: "4px",
                fontSize: "6px",
                color: "#A4A4A4",
              }}
            >
              {translations.cache_latency}
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                display: "flex",
                color: "#A4A4A4",
                flexDirection: "column",
              }}
            ></div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  color: "#7AA973",
                  fontSize: "10px",
                  whiteSpace: "nowrap",
                  marginBottom: "10px",
                }}
              >
                {translations.latency}
              </div>
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  bottom: "0",
                  right: "-30%",
                  transform: "scale(0.5)",
                }}
              >
                <LinearGraph
                  width={50}
                  height={15}
                  data={database.bot_stats.database_pings}
                  color="#7AA973"
                  scale={2}
                />
              </div>
            </div>
            <div
              style={{ color: "#A4A4A4", fontSize: "7px", marginTop: "-5px" }}
            >
              {translations.database_ping}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Statistics.dimensions = {
  width: 320,
  height: 210,
};

Statistics.localization_strings = {
  title: {
    en: "Statistics",
    ru: "Статистика",
    uk: "Статистика",
  },
  servers: {
    en: "{count} servers",
    ru: "{count} серверов",
    uk: "{count} серверів",
  },
  latency: {
    en: "{ping} ms",
    ru: "{ping} мс",
    uk: "{ping} мс",
  },
  cache_latency: {
    en: "Cache: {ping} ms",
    ru: "Кэш: {ping} мс",
    uk: "Кеш: {ping} мс",
  },
  shards: {
    en: "Shards",
    ru: "Шарды",
    uk: "Шарди",
  },
  music: {
    en: "Music Node",
    ru: "Музыкал. нода",
    uk: "Музична нода",
  },
  music_players: {
    en: "{count} players",
    ru: "{count} плееров",
    uk: "{count} плеєрів",
  },
  render: {
    en: "Render Server",
    ru: "Рендер сервер",
    uk: "Рендер сервер",
  },
  render_requests: {
    en: "{count} requests",
    ru: "{count} запросов",
    uk: "{count} запитів",
  },
  database: {
    en: "Database",
    ru: "База данных",
    uk: "База даних",
  },
  database_ping: {
    en: "Avg. speed: {ping} ms",
    ru: "Сред. скорость: {ping} мс",
    uk: "Сер. швидкість: {ping} мс",
  },
};

export default Statistics;
