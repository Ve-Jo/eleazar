const Cooldown = (props) => {
  const { i18n, coloring } = props;
  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring || {};

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(Cooldown.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const formatTime = (milliseconds) => {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getAdjacentNumbers = (time) => {
    const [hours, minutes, seconds] = time.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return [
      (totalSeconds + 2) % 86400,
      (totalSeconds + 1) % 86400,
      (totalSeconds - 1 + 86400) % 86400,
      (totalSeconds - 2 + 86400) % 86400,
    ].map((s) => {
      const sec = s % 60;
      return sec.toString().padStart(2, "0");
    });
  };

  const formattedTime = formatTime(props.nextDaily);
  const [nextTwo, nextOne, prevOne, prevTwo] =
    getAdjacentNumbers(formattedTime);

  return (
    <div
      style={{
        width: "450px",
        height: "200px",
        borderRadius: props.database?.banner_url ? "0px" : "20px",
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
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                color: textColor,
              }}
            >
              {formattedTime}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  opacity: 0.5,
                  position: "absolute",
                  right: "-5px",
                  top: "-90px",
                  lineHeight: "1",
                  color: secondaryTextColor,
                }}
              >
                <span style={{ filter: "blur(4px)" }}>{nextTwo}</span>
                <span style={{ filter: "blur(1px)" }}>{nextOne}</span>
                <span style={{ opacity: 0 }}>00</span>
                <span style={{ filter: "blur(1px)" }}>{prevOne}</span>
                <span style={{ filter: "blur(4px)" }}>{prevTwo}</span>
              </div>
              <span
                style={{
                  fontSize: "14px",
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, 115%)",
                  color: secondaryTextColor,
                }}
              >
                {translations.remaining}
              </span>
            </div>
          </div>
          <div
            style={{
              width: "100px",
              fontSize: "85px",
              height: "100px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: "25px",
            }}
          >
            {props.emoji || "🎁"}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "8px",
          width: "100%",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            color: tertiaryTextColor,
          }}
        >
          #{props.interaction.user.id || "{id}"}
        </span>
        <span style={{ fontSize: "16px", color: textColor }}>
          {props.interaction.user.username ||
            props.interaction.user.displayName ||
            "{username}"}
        </span>
      </div>
    </div>
  );
};

Cooldown.dimensions = {
  width: 450,
  height: 200,
};

// Static translations object that will be synchronized
Cooldown.localization_strings = {
  title: {
    en: "Cooldown",
    ru: "Перезарядка",
    uk: "Перезарядка",
  },
  remaining: {
    en: "remaining",
    ru: "осталось",
    uk: "залишилось",
  },
};

export default Cooldown;
