const Daily = (props) => {
  console.log("HELLO");
  const { interaction, amount, database, i18n, coloring } = props;
  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring;

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
        borderRadius: database.bannerUrl ? "0px" : "20px",
        padding: "10px 20px",
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        background: backgroundGradient,
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
              color: textColor,
            }}
          >
            🎁 {translations.title}!
          </div>
          <div
            style={{
              backgroundColor: overlayBackground,
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
                color: textColor,
              }}
            >
              💵 {database.economy?.balance?.toFixed(2) || "{balance}"}
              <span
                style={{
                  backgroundColor: coloring?.isDarkText
                    ? "rgba(115, 220, 133, 0.3)"
                    : "rgba(115, 220, 133, 1)",
                  color: textColor,
                  borderRadius: "10px",
                  padding: "5px 10px",
                  display: "flex",
                  fontSize: "16px",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                + {amount?.toFixed?.(2) || "{amount}"}
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
                backgroundColor: overlayBackground,
                padding: "5px 10px",
                borderRadius: "10px",
                display: "flex",
                color: textColor,
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
            backgroundColor: overlayBackground,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={
              interaction.user.avatarURL ||
              "https://cdn.discordapp.com/embed/avatars/0.png"
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
        <span
          style={{
            fontSize: "14px",
            color: tertiaryTextColor,
          }}
        >
          #{interaction.user.id || "{id}"}
        </span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: textColor,
          }}
        >
          {interaction.user.username ||
            interaction.user.displayName ||
            "{username}"}
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
