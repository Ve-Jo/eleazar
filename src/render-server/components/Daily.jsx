const Daily = (props) => {
  const { interaction, amount, database, i18n } = props;
  const { user, guild } = interaction;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(Daily.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  return (
    <div
      style={{
        width: "450px",
        height: "200px",
        backgroundColor: database.bannerUrl ? "rgba(0, 0, 0, 0.6)" : "#2196f3",
        borderRadius: database.bannerUrl ? "0px" : "20px",
        padding: "10px 20px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: i18n.getLocale() === "en" ? "45px" : "25px",
              textAlign: "left",
              display: "flex",
              marginBottom: "10px",
              maxWidth: "200px",
              wordWrap: "break-word", // Allow text to wrap
            }}
          >
            🎁 {translations.title}!
          </div>
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 10px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              maxWidth: "300px", // Added maxWidth to contain content
            }}
          >
            <span
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                display: "flex",
                flexWrap: "wrap", // Allow content to wrap
                gap: "10px", // Space between wrapped items
                alignItems: "center",
              }}
            >
              💵 {database.economy.balance.toFixed(2) || "{balance}"}
              <span
                style={{
                  backgroundColor: "rgba(115, 220, 133, 1)",
                  borderRadius: "10px",
                  padding: "5px 10px",
                  display: "flex",
                  fontSize: "16px",
                  color: "#FFFFFF",
                  fontWeight: "bold",
                  whiteSpace: "nowrap", // Keep the amount on one line
                }}
              >
                + {amount.toFixed(2) || "{amount}"}
              </span>
            </span>
          </div>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                padding: "5px 10px",
                borderRadius: "10px",
                display: "flex",
              }}
            >
              🕐 24:00:00
            </div>
          </span>
        </div>
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "25px",
            overflow: "hidden",
            backgroundColor: "#1565c0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={
              user.avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User"
            width="100"
            height="100"
            style={{ objectFit: "cover", borderRadius: "25px" }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          width: "100%",
          marginTop: "8px",
        }}
      >
        <span style={{ fontSize: "14px", opacity: "0.2" }}>
          #{user.id || "{id}"}
        </span>
        <span style={{ fontSize: "16px", fontWeight: "bold" }}>
          {user.username || user.displayName || "{username}"}
        </span>
      </div>
    </div>
  );
};

Daily.dimensions = {
  width: 450,
  height: 200,
};

// Static translations object that will be synchronized
Daily.localization_strings = {
  title: {
    en: "Daily",
    ru: "Ежедневная награда",
    uk: "Щоденна нагорода",
  },
  reward: {
    en: "Reward",
    ru: "Награда",
    uk: "Нагорода",
  },
  cooldown: {
    en: "Next daily in",
    ru: "Следующая награда через",
    uk: "Наступна нагорода через",
  },
};

export default Daily;
