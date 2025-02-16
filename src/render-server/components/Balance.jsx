import React from "react";
import prettyMilliseconds from "pretty-ms";

const Balance = (props) => {
  const { interaction, database, i18n } = props;

  const containerStyle = {
    width: "400px",
    height: "235px",
    borderRadius: database.bannerUrl ? "0px" : "20px",
    padding: "20px",
    color: "white",
    fontFamily: "Inter600, sans-serif",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    backgroundColor: database.bannerUrl ? "rgba(0, 0, 0, 0.6)" : "#2196f3",
  };

  return (
    <div style={containerStyle}>
      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <img
              src={
                interaction.guild.iconURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Guild Icon"
              width={24}
              height={24}
              style={{ borderRadius: "5px" }}
            />
            <h2 style={{ margin: "0", fontSize: "24px", display: "flex" }}>
              {i18n.__("title")}!
            </h2>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "10px",
              gap: "5px",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px 10px 10px 0",
                padding: "5px 15px",
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "150px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  marginRight: "15px",
                  display: "flex",
                }}
              >
                💵
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{ fontSize: "14px", opacity: "0.8", display: "flex" }}
                >
                  {i18n.__("wallet").toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    display: "flex",
                  }}
                >
                  {database.economy.balance.toFixed(2) || "{balance}"}
                </span>
              </div>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius:
                  database.economy.bankStartTime > 0 &&
                  database.economy.bankRate > 0
                    ? "0 10px 10px 0"
                    : "0 10px 10px 10px",
                padding: "5px 15px",
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "150px",
                maxWidth: "300px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  marginRight: "15px",
                  display: "flex",
                }}
              >
                💳
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      opacity: "0.8",
                      display: "flex",
                    }}
                  >
                    {i18n.__("bank").toUpperCase()}
                  </span>
                  {database.economy.bankStartTime > 0 &&
                  database.economy.bankRate > 0 ? (
                    <span
                      style={{
                        fontSize: "14px",
                        opacity: "0.6",
                        color: "rgba(255, 255, 255, 1)",
                        display: "flex",
                      }}
                    >
                      ≈
                      {(() => {
                        const MS_PER_HOUR = 60 * 60 * 1000;
                        const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
                        const hourlyRate =
                          (database.economy.bankRate / 100) *
                          (MS_PER_HOUR / MS_PER_YEAR);
                        return (
                          database.economy.bankBalance * hourlyRate
                        ).toFixed(3);
                      })()}
                      /h
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "baseline",
                  }}
                >
                  {database.economy.bankStartTime > 0 ? (
                    <>
                      <span style={{ display: "flex" }}>
                        {Math.floor(database.economy.bankBalance)}
                      </span>
                      <span style={{ display: "flex" }}>.</span>
                      <div style={{ display: "flex" }}>
                        {(database.economy.bankBalance % 1)
                          .toFixed(5)
                          .substring(2)
                          .split("")
                          .map((digit, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: i < 2 ? 28 : 18,
                                paddingTop: i < 2 ? 0 : 10,
                                display: "flex",
                              }}
                            >
                              {digit}
                            </span>
                          ))}
                      </div>
                    </>
                  ) : (
                    <span style={{ display: "flex" }}>
                      {database.economy.bankBalance.toFixed(2) || "{bank}"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {database.economy.bankStartTime > 0 &&
            database.economy.bankRate > 0 ? (
              <div
                style={{
                  backgroundColor: "rgba(255, 166, 0, 1)",
                  borderRadius: "0 10px 10px 10px",
                  padding: "5px 15px",
                  display: "flex",
                  marginTop: "-5px",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  minWidth: "150px",
                  maxWidth: "300px",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    display: "flex",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {database.economy.bankRate || "{holdingPercentage}"}
                  {"% "}
                  {i18n.__("annual")} (
                  {prettyMilliseconds(
                    Date.now() - Number(database.economy.bankStartTime),
                    {
                      colonNotation: true,
                      secondsDecimalDigits: 0,
                    }
                  )}
                  )
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            width: "110px",
            height: "110px",
            borderRadius: "25px",
            overflow: "hidden",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
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
            width="110"
            height="110"
            style={{
              objectFit: "cover",
              borderRadius: "25px",
              display: "flex",
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          bottom: "10%",
          right: "6%",
        }}
      >
        <span style={{ fontSize: "16px", display: "flex" }}>
          {interaction.user.username ||
            interaction.user.displayName ||
            "{username}"}
        </span>
        <span style={{ fontSize: "12px", opacity: "0.4", display: "flex" }}>
          #{interaction.user.id || "{id}"}
        </span>
      </div>
    </div>
  );
};

// Add static dimensions property
Balance.dimensions = {
  width: 400,
  height: 235,
};

// Static translations object used by imageGenerator
Balance.localization_strings = {
  title: {
    en: "Balance",
    ru: "Баланс",
    uk: "Баланс",
  },
  wallet: {
    en: "WALLET",
    ru: "КОШЕЛЁК",
    uk: "ГАМАНЕЦЬ",
  },
  bank: {
    en: "BANK",
    ru: "БАНК",
    uk: "БАНК",
  },
  annual: {
    en: "annual",
    ru: "годовых",
    uk: "річних",
  },
};

export default Balance;
