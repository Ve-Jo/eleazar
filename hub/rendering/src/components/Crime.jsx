import InfoRectangle from "./unified/InfoRectangle.jsx";
import Banknotes from "./unified/Banknotes.jsx";

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

  const victimBalance = Number(props.victim?.balance || 0);
  const robberBalance = Number(props.robber?.balance || 0);
  const delta = Number(props.amount || 0);
  const showDelta = props.success !== undefined;

  return (
    <div
      style={{
        width: "450px",
        height: "200px",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "10px 20px",
        color: "white",
        fontFamily: "Inter", fontWeight: 500,
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
          <div style={{ position: "absolute", top: "-6px", left: "95px", width: "180px" }}>
            <InfoRectangle
              icon="💵"
              background="rgba(255, 255, 255, 0.2)"
              borderRadius="12px"
              padding="6px 10px"
              minWidth="0px"
              maxWidth="200px"
              iconSize="18px"
              iconMarginRight="6px"
              title={translations.victim}
              titleStyle={{ fontSize: "11px", opacity: 0.85, letterSpacing: "0.08em", color: "#fff" }}
              value={
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", color: "#fff" }}>
                  <span style={{ fontSize: "22px", fontWeight: 700 }}>
                    {victimBalance.toFixed(2)}
                  </span>
                  {showDelta && (
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: props.success ? "#C66161" : "#6EE78C",
                      }}
                    >
                      {props.success ? "-" : "+"}
                      {delta.toFixed(2)}
                    </span>
                  )}
                </div>
              }
              style={{ position: "relative", width: "100%", boxSizing: "border-box", minHeight: "60px" }}
            >
              <Banknotes
                amount={Math.max(victimBalance, 0)}
                style="banknotes"
                division={50}
                xspacing={18}
                styleOverrides={{
                  container: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 },
                  banknote: { width: "10px", height: "3px" },
                }}
              />
            </InfoRectangle>
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
          <div style={{ position: "absolute", bottom: "-6px", right: "95px", width: "180px" }}>
            <InfoRectangle
              icon="💵"
              background="rgba(255, 255, 255, 0.2)"
              borderRadius="12px"
              padding="6px 10px"
              minWidth="0px"
              maxWidth="200px"
              iconSize="18px"
              iconMarginRight="6px"
              title={translations.robber}
              titleStyle={{ fontSize: "11px", opacity: 0.85, letterSpacing: "0.08em", color: "#fff" }}
              value={
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", color: "#fff" }}>
                  <span style={{ fontSize: "22px", fontWeight: 700 }}>
                    {robberBalance.toFixed(2)}
                  </span>
                  {showDelta && (
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: props.success ? "#6EE78C" : "#C66161",
                      }}
                    >
                      {props.success ? "+" : "-"}
                      {delta.toFixed(2)}
                    </span>
                  )}
                </div>
              }
              style={{ position: "relative", width: "100%", boxSizing: "border-box", minHeight: "60px" }}
            >
              <Banknotes
                amount={Math.max(robberBalance, 0)}
                style="banknotes"
                division={50}
                xspacing={18}
                styleOverrides={{
                  container: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 },
                  banknote: { width: "10px", height: "3px" },
                }}
              />
            </InfoRectangle>
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
