const Crime = (props) => {
  const { i18n } = props;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(Crime.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  let victimUser = props.victim?.user || {
    id: "{id}",
    username: "{username}",
    displayName: "{displayName}",
  };
  let robberUser = props.robber?.user ||
    props.interaction.user || {
      id: "{id}",
      username: "{username}",
      displayName: "{displayName}",
    };

  return (
    <div
      style={{
        width: "450px",
        height: "200px",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "10px 20px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              backgroundColor: "#4CAF50",
              borderRadius: "10px",
              padding: "5px 10px",
              marginBottom: "5px",
            }}
          >
            {translations.victim}
          </div>
          <div
            style={{
              width: "80px",
              height: "120px",
              borderRadius: "15px",
              overflow: "hidden",
              backgroundColor: "#1565c0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                victimUser.avatarURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Victim"
              width="80"
              height="120"
              style={{ objectFit: "cover", borderRadius: "15px" }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: "0px",
              left: "95px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 25px 5px 10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              💵 {props.victim?.balance.toFixed(2) || "{balance}"}
            </span>
            {props.success !== undefined && (
              <span
                style={{
                  position: "absolute",
                  right: "5px",
                  top: "8px",
                  fontSize: "16px",
                  color: props.success ? "#C66161" : "#6EE78C",
                  fontWeight: "bold",
                }}
              >
                {props.success ? "-" : "+"}
                {props.amount?.toFixed(2) || "{amount}"}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              backgroundColor: "#F44336",
              borderRadius: "10px",
              padding: "5px 10px",
              marginBottom: "5px",
            }}
          >
            {translations.robber}
          </div>
          <div
            style={{
              width: "80px",
              height: "120px",
              borderRadius: "15px",
              overflow: "hidden",
              backgroundColor: "#1565c0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                robberUser.avatarURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Robber"
              width="80"
              height="120"
              style={{ objectFit: "cover", borderRadius: "15px" }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "0px",
              right: "95px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 25px 5px 10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              💵 {props.robber?.balance.toFixed(2) || "{balance}"}
            </span>
            {props.success !== undefined && (
              <span
                style={{
                  position: "absolute",
                  right: "5px",
                  top: "8px",
                  fontSize: "16px",
                  color: props.success ? "#6EE78C" : "#C66161",
                  fontWeight: "bold",
                }}
              >
                {props.success ? "+" : "-"}
                {props.amount?.toFixed(2) || "{amount}"}
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          bottom: "-5px",
        }}
      >
        <span style={{ fontSize: "10px", opacity: "0.3" }}>
          #{victimUser.id}
        </span>
        <span
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: props.success ? "#6EE78C" : "#FF6B6B",
          }}
        >
          {props.success ? translations.success : translations.fail}
        </span>
        <span style={{ fontSize: "10px", opacity: "0.3" }}>
          #{robberUser.id}
        </span>
      </div>
    </div>
  );
};

Crime.dimensions = {
  width: 450,
  height: 200,
};

// Static translations object that will be synchronized
Crime.localization_strings = {
  title: {
    en: "Crime",
    ru: "Преступление",
    uk: "Злочин",
  },
  victim: {
    en: "Victim",
    ru: "Жертва",
    uk: "Жертва",
  },
  robber: {
    en: "Robber",
    ru: "Грабитель",
    uk: "Грабіжник",
  },
  success: {
    en: "Successful Crime",
    ru: "Успешное ограбление",
    uk: "Успішний злочин",
  },
  fail: {
    en: "Failed Crime",
    ru: "Неудачное ограбление",
    uk: "Невдалий злочин",
  },
};

export default Crime;
