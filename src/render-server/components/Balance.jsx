import prettyMilliseconds from "pretty-ms";

const Balance = (props) => {
  const renderBanknotes = (
    amount,
    maxRowLength,
    startX,
    baseY,
    style,
    division,
    xspacing
  ) => {
    const totalBanknotes = Math.ceil(amount / division);

    const fullRows = Math.floor(totalBanknotes / maxRowLength);
    const remaining = totalBanknotes % maxRowLength;
    const rowsNeeded = fullRows + (remaining > 0 ? 1 : 0);

    const banknotes = [];
    let currentIndex = 0;

    for (let row = 0; row < rowsNeeded; row++) {
      const banknotesInThisRow = row < fullRows ? maxRowLength : remaining;

      const xSpacing = xspacing || 15;
      const totalWidth = banknotesInThisRow * xSpacing;
      const startXPos = startX - totalWidth / 2;

      // Place banknotes in this row
      for (let col = 0; col < banknotesInThisRow; col++) {
        if (currentIndex >= totalBanknotes) break;

        // Add small random offset for natural look
        const randomOffset = Math.random() * 3 - 1;
        const ySpacing = 5; // Vertical spacing between rows

        const xPos = startXPos + col * xSpacing + randomOffset;
        const yPos = baseY - row * ySpacing; // Rows stack upwards

        // Apply styling based on the style parameter
        if (style === "banknotes") {
          // Green banknotes with orange stripe
          banknotes.push(
            <div
              key={currentIndex}
              style={{
                position: "absolute",
                left: `${xPos}px`,
                top: `${yPos}px`,
                width: "15px",
                height: "5px",
                background: "#4CAF50",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: 0.3,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "3px",
                  height: "100%",
                  background: "#FF9800", // Orange stripe
                }}
              />
            </div>
          );
        } else if (style === "bars") {
          // Green golden bars (solid gold with green border for effect)
          banknotes.push(
            <div
              key={currentIndex}
              style={{
                position: "absolute",
                left: `${xPos}px`,
                top: `${yPos}px`,
                width: "15px",
                height: "5px",
                background: "#DAA520", // Gold gradient
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: 0.3,
              }}
            />
          );
        }
        currentIndex++;
      }
    }

    return banknotes;
  };

  // Example usage:
  // For 6000 units (6 banknotes), it will create a single row centered at X = 60
  // For 11000 units (11 banknotes), it will create a pyramid (e.g., 5, 4, 2) centered at X = 60

  const { interaction, database, i18n, coloring } = props;

  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring;

  //database.economy.bankBalance = 0;

  const bankStartTime = database?.economy?.bankStartTime || 0;
  const bankRate = database?.economy?.bankRate || 0;
  const bankBalance = database?.economy?.bankBalance || 0;
  const walletBalance = database?.economy?.balance || 0;

  const mainBackground = database?.bannerUrl
    ? "transparent"
    : backgroundGradient;
  return (
    <div
      style={{
        display: "flex",
        width: "400px",
        height: "235px",
        borderRadius: database?.bannerUrl ? "0px" : "20px",
        padding: "20px",
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        position: "relative",
        overflow: "hidden",
        background: mainBackground,
      }}
    >
      {renderBanknotes(walletBalance, 8, 95, 115, "banknotes", 50, 18)}

      {/* Banner Background */}
      {database?.bannerUrl && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <img
            src={database.bannerUrl}
            alt="Banner"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: "blur(8px)",
              transform: "scale(1.1)",
            }}
          />
        </div>
      )}
      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
        }}
      >
        <div
          style={{ width: "260px", display: "flex", flexDirection: "column" }}
        >
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
                interaction?.guild?.iconURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Guild Icon"
              width={24}
              height={24}
              style={{ borderRadius: "5px" }}
            />
            <h2
              style={{
                margin: "0",
                fontSize: "24px",
                display: "flex",
                color: textColor,
              }}
            >
              {i18n.__("title")}!
            </h2>
          </div>
          {renderBanknotes(bankBalance, 10, 95, 161, "bars", 100, 18)}
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
                display: "flex",
                backgroundColor: overlayBackground,
                borderRadius: "10px 10px 10px 0",
                padding: "5px 15px",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "150px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  marginRight: "15px",
                }}
              >
                💵
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    color: secondaryTextColor,
                    opacity: "0.8",
                  }}
                >
                  {i18n.__("wallet").toUpperCase()}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: textColor,
                  }}
                >
                  {walletBalance.toFixed(2) || "{balance}"}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                backgroundColor: overlayBackground,
                borderRadius:
                  bankStartTime > 0 && bankRate > 0
                    ? "0 10px 10px 0"
                    : "0 10px 10px 10px",
                padding: "5px 15px",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "150px",
                maxWidth: "300px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  marginRight: "15px",
                }}
              >
                💳
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: "14px",
                      opacity: "0.8",
                      color: secondaryTextColor,
                    }}
                  >
                    {i18n.__("bank").toUpperCase()}
                  </div>
                  {bankStartTime > 0 && bankRate > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        fontSize: "14px",
                        opacity: "0.6",
                        color: textColor,
                      }}
                    >
                      ≈
                      {(() => {
                        const MS_PER_HOUR = 60 * 60 * 1000;
                        const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
                        const hourlyRate =
                          (bankRate / 100) * (MS_PER_HOUR / MS_PER_YEAR);
                        return (bankBalance * hourlyRate).toFixed(3);
                      })()}
                      /h
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "28px",
                    fontWeight: "bold",
                    alignItems: "baseline",
                    width: "100%",
                  }}
                >
                  {bankStartTime > 0 ? (
                    <div style={{ display: "flex", alignItems: "baseline" }}>
                      <div style={{ display: "flex" }}>
                        {Math.floor(bankBalance)}
                      </div>
                      <div style={{ display: "flex" }}>.</div>
                      <div style={{ display: "flex" }}>
                        {(bankBalance % 1)
                          .toFixed(5)
                          .substring(2)
                          .split("")
                          .map((digit, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                fontSize: i < 2 ? 28 : 18,
                                paddingTop: i < 2 ? 0 : 10,
                              }}
                            >
                              {digit}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex" }}>
                      {bankBalance.toFixed(2) || "{bank}"}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {bankStartTime > 0 && bankRate > 0 ? (
              <div
                style={{
                  display: "flex",
                  backgroundColor: coloring?.isDarkText
                    ? "rgba(255, 166, 0, 0.3)"
                    : "rgba(255, 166, 0, 1)",
                  color: coloring?.isDarkText ? "#000" : "#FFF",
                  borderRadius: "0 10px 10px 10px",
                  padding: "5px 15px",
                  marginTop: "-5px",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  minWidth: "150px",
                  maxWidth: "300px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {bankRate || "{holdingPercentage}"}
                  {"% "}
                  {i18n.__("annual")} (
                  {prettyMilliseconds(Date.now() - Number(bankStartTime), {
                    colonNotation: true,
                    secondsDecimalDigits: 0,
                  })}
                  )
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: "110px",
            height: "110px",
            borderRadius: "25px",
            overflow: "hidden",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            position: "absolute",
            top: "5px",
            right: "5px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                interaction?.user?.avatarURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="User"
              width="110"
              height="110"
              style={{
                objectFit: "cover",
                borderRadius: "25px",
              }}
            />
          </div>
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
        <div
          style={{
            display: "flex",
            fontSize: "16px",
            color: textColor,
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          {interaction?.user?.username ||
            interaction?.user?.displayName ||
            "{username}"}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "12px",
            opacity: "0.4",
            color: tertiaryTextColor,
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          #{interaction?.user?.id || "{id}"}
        </div>
      </div>
      {/* Render banknotes above the Balance rectangle */}
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
