import prettyMilliseconds from "pretty-ms";
import Decimal from "decimal.js";



const Balance = (props) => {
  const renderBanknotes = (
    amount,
    startX,
    baseY,
    style,
    division,
    xspacing,
    containerBounds = null
  ) => {
    const totalBanknotes = Math.ceil(amount / division);

    // If no banknotes to render, return empty array
    if (totalBanknotes <= 0) {
      return [];
    }

    const banknotes = [];
    let currentIndex = 0;

    // Default container bounds if not provided
    const bounds = containerBounds || {
      left: 0,
      top: 0,
      right: 400, // Component width
      bottom: 235, // Component height
      padding: 0,
    };

    // Calculate effective boundaries with padding
    const effectiveLeft = bounds.left + (bounds.padding || 0);
    const effectiveTop = bounds.top + (bounds.padding || 0);
    const effectiveRight = bounds.right - (bounds.padding || 0);
    const effectiveBottom = bounds.bottom - (bounds.padding || 0);

    // Calculate maximum available width and height
    const availableWidth = effectiveRight - effectiveLeft;
    const availableHeight = effectiveBottom - effectiveTop;

    // Banknote dimensions
    const banknoteWidth = 15; // Width of a single banknote
    const banknoteHeight = 5; // Height of a banknote

    // Dynamically calculate spacing based on container width
    // Ensure minimum spacing of 5px and maximum of provided xspacing
    const minSpacing = 5;
    const providedSpacing = xspacing || 15;

    // Calculate optimal spacing based on container width
    // Try to fit at least 3 banknotes if possible
    const minBanknotesPerRow = Math.min(3, totalBanknotes);
    const optimalSpacing = Math.min(
      providedSpacing,
      Math.max(minSpacing, availableWidth / Math.max(minBanknotesPerRow, 1))
    );

    // Use the calculated spacing
    const xSpacing = Math.min(optimalSpacing, providedSpacing);

    // Calculate how many banknotes can fit in a row with the calculated spacing
    const maxFittingInRow = Math.floor(availableWidth / xSpacing);

    // We're not limiting by maxRowLength anymore since we're using container bounds
    const adjustedMaxRowLength = maxFittingInRow;

    // If we can't fit even one banknote, don't render any
    if (adjustedMaxRowLength <= 0) {
      return [];
    }

    // Calculate how many rows we can fit before hitting the top
    const ySpacing = 5; // Vertical spacing between rows

    // Add a buffer to prevent touching the top (at least 5px from top)
    const safeTopMargin = 5;
    const maxRows = Math.max(
      1,
      Math.floor((baseY - effectiveTop - safeTopMargin) / ySpacing)
    );

    // Calculate rows needed for all banknotes
    const fullRows = Math.floor(totalBanknotes / adjustedMaxRowLength);
    const remaining = totalBanknotes % adjustedMaxRowLength;
    const rowsNeeded = fullRows + (remaining > 0 ? 1 : 0);

    // Limit the number of rows to prevent touching the top
    const limitedRows = Math.min(rowsNeeded, maxRows);

    // Calculate how many banknotes we can display in the limited rows
    const maxBanknotesToShow = limitedRows * adjustedMaxRowLength;
    const limitedBanknotes = Math.min(totalBanknotes, maxBanknotesToShow);

    // Recalculate rows with limited banknotes
    const limitedFullRows = Math.floor(limitedBanknotes / adjustedMaxRowLength);
    const limitedRemaining = limitedBanknotes % adjustedMaxRowLength;

    // Render banknotes row by row
    for (let row = 0; row < limitedRows; row++) {
      const banknotesInThisRow =
        row < limitedFullRows
          ? adjustedMaxRowLength
          : row === limitedFullRows
          ? limitedRemaining
          : 0;

      if (banknotesInThisRow <= 0) continue;

      // Calculate the total width of banknotes in this row
      const totalWidth = banknotesInThisRow * xSpacing;

      // Center the banknotes within the available space
      // If startX is within the container, center around it
      // Otherwise, center within the container
      const rowCenterX =
        startX >= effectiveLeft && startX <= effectiveRight
          ? startX
          : effectiveLeft + availableWidth / 2;

      const startXPos = Math.max(
        effectiveLeft,
        Math.min(rowCenterX - totalWidth / 2, effectiveRight - totalWidth)
      );

      // Place banknotes in this row
      for (let col = 0; col < banknotesInThisRow; col++) {
        if (currentIndex >= limitedBanknotes) break;

        // Add small random offset for natural look (but constrained)
        const randomOffset = Math.random() * 2 - 1; // Reduced randomness

        // Calculate position with constraints
        const xPos = Math.max(
          effectiveLeft,
          Math.min(
            startXPos + col * xSpacing + randomOffset,
            effectiveRight - banknoteWidth
          )
        );

        // Ensure banknotes don't touch the top
        const yPos = Math.max(
          effectiveTop + safeTopMargin,
          Math.min(baseY - row * ySpacing, effectiveBottom - banknoteHeight)
        );

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

  const { interaction, database, i18n, coloring } = props;

  // --- Marriage Check ---
  const isMarried = database?.marriageStatus?.status === "MARRIED";
  const combinedBankBalanceProp = database?.combinedBankBalance;
  // --- End Marriage Check ---

  /*database.crypto2 = {};
  database.crypto2.openPositions = [
    {
      id: "cm9xd67nd000596povftodbh2",
      symbol: "APTUSDT",
      direction: "LONG",
      entryPrice: 5.57822764,
      quantity: 17.926841,
      leverage: 10,
      pnlPercent: 0.31,
      pnlAmount: 0.03,
      stakeValue: 10,
    },
  ];*/



  const translations = Object.entries(Balance.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring;

  //database.economy.bankBalance = 0;
  console.log("------------");
  console.log(props?.database?.crypto2?.openPositions);

  const bankStartTime = database?.economy?.bankStartTime || 0;
  const bankRate = database?.economy?.bankRate || 0;
  // Use combined balance if married, otherwise use individual
  let bankBalanceForDisplay = new Decimal(database?.economy?.bankBalance || 0);
  const individualBankBalance = database?.individualBankBalance // Get individual balance prop
    ? new Decimal(database.individualBankBalance)
    : new Decimal(0);
  // --- Use props passed from balance.js ---
  const partnerAvatarUrl =
    database?.partnerAvatarUrl ||
    "https://cdn.discordapp.com/embed/avatars/0.png";
  const partnerUsername = database?.partnerUsername || "Partner";
  const marriageCreatedAt = database?.marriageStatus?.createdAt;
  // --- End Use props ---

  if (isMarried && combinedBankBalanceProp !== undefined) {
    bankBalanceForDisplay = new Decimal(combinedBankBalanceProp);
  }
  let walletBalance = new Decimal(database?.economy?.balance || 0);

  // Use the potentially combined balance for visual banknote calculation
  let visualBankBalanceAmount = bankBalanceForDisplay.toNumber();
  let visualWalletBalanceAmount = walletBalance.toNumber();

  let visualwallet = visualWalletBalanceAmount.toFixed(0).toString().length;
  let visualbank = visualBankBalanceAmount.toFixed(0).toString().length;

  console.log(`visualwallet: ${visualwallet}, visualbank: ${visualbank}`);

  const mainBackground = database?.bannerUrl
    ? "transparent"
    : backgroundGradient;
  return (
    <div
      style={{
        display: "flex",
        width: "400px",
        height: isMarried ? "260px" : "235px", // Use minHeight instead of fixed height
        borderRadius: database?.bannerUrl ? "0px" : "20px",
        padding: "20px",
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        position: "relative",
        overflow: "hidden",
        background: mainBackground,
      }}
    >
      {/* Define wallet container bounds */}
      {renderBanknotes(walletBalance, 95, 115, "banknotes", 50, 18, {
        left: 20,
        top: 45,
        right: 180 + (visualwallet - 3) * 20,
        bottom: 130,
        padding: 5,
      })}

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
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex" }}>
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
                {translations.title}
              </h2>
            </div>
            {/* Define bank container bounds - use the amount used for visuals */}
            {renderBanknotes(
              visualBankBalanceAmount,
              95,
              161,
              "bars",
              100,
              18,
              {
                left: 0,
                top: 90,
                right: 190 + (visualbank - 3) * 20,
                bottom: 180,
                padding: 5,
              }
            )}
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
                  position: "relative", // Added for proper positioning context
                  overflow: "hidden", // Added to clip overflowing banknotes
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
                    {translations.wallet.toUpperCase()}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "28px",
                      fontWeight: "bold",
                      color: textColor,
                    }}
                  >
                    {/* Use Decimal for formatting wallet */}
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
                  position: "relative", // Added for proper positioning context
                  overflow: "hidden", // Added to clip overflowing banknotes
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
                      {translations.bank.toUpperCase()}
                      {/* Add clarification if married */}
                      {isMarried && (
                        <span
                          style={{
                            opacity: 0.7,
                            marginLeft: "2px",
                            marginTop: "4px",
                            fontSize: "8px",
                          }}
                        >
                          ({translations.yours}:{" "}
                          {individualBankBalance.toFixed(2)})
                        </span>
                      )}
                    </div>
                    {/* Show user's bank rate even if balance is combined */}
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
                          return (bankBalanceForDisplay * hourlyRate).toFixed(
                            3
                          );
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
                    {/* Display logic using bankBalanceForDisplay */}
                    {bankStartTime > 0 || isMarried ? ( // Show detailed format if interest running OR married
                      <div style={{ display: "flex", alignItems: "baseline" }}>
                        <div style={{ display: "flex" }}>
                          {Math.floor(bankBalanceForDisplay.toNumber())}
                        </div>
                        <div style={{ display: "flex" }}>.</div>
                        <div style={{ display: "flex" }}>
                          {(bankBalanceForDisplay.toNumber() % 1)
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
                        {/* Fallback simple format */}
                        {bankBalanceForDisplay.toFixed(2) || "{bank}"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Bank Annual Rate Display */}
              {bankStartTime > 0 && bankRate > 0 ? (
                <div
                  style={{
                    display: "flex",
                    backgroundColor: coloring?.isDarkText
                      ? "rgba(255, 166, 0, 0.3)"
                      : "rgba(255, 166, 0, 1)",
                    color: coloring?.isDarkText ? "#000" : "#FFF",
                    borderRadius: isMarried
                      ? "0 10px 10px 0"
                      : "0 10px 10px 10px",
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
                    {translations.annual} (
                    {prettyMilliseconds(Date.now() - Number(bankStartTime), {
                      colonNotation: true,
                      secondsDecimalDigits: 0,
                    })}
                    )
                  </div>
                </div>
              ) : null}

              {/* NEW: Marriage Status Display */}
              {isMarried && marriageCreatedAt && (
                <div
                  style={{
                    display: "flex",
                    backgroundColor: coloring?.isDarkText
                      ? "rgba(255, 100, 100, 0.3)" // Light red for dark text
                      : "rgba(200, 50, 50, 0.8)", // Darker red for light text
                    color: coloring?.isDarkText ? "#000" : "#FFF",
                    borderRadius:
                      bankStartTime > 0 && bankRate > 0
                        ? "0px 10px 10px 10px"
                        : "10px",
                    padding: "5px 10px", // Adjusted padding
                    marginTop: "-5px", // Overlap slightly if annual rate exists
                    alignItems: "center",
                    alignSelf: "flex-start",
                    minWidth: "150px",
                    maxWidth: "300px",
                    gap: "8px", // Add gap between items
                  }}
                >
                  <span style={{ fontSize: "18px" }}>💍</span>
                  {/* Use the passed avatar URL and username */}
                  <img
                    src={partnerAvatarUrl}
                    alt={partnerUsername}
                    width={18} // Smaller avatar
                    height={18}
                    style={{ borderRadius: "50%" }} // Circular avatar
                  />
                  <div
                    style={{
                      display: "flex",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {translations.married} (
                    {prettyMilliseconds(
                      Date.now() - new Date(marriageCreatedAt).getTime()
                    )}
                    )
                  </div>
                </div>
              )}
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
          <div
            style={{
              position: "absolute",
              display: "flex",
              fontSize: "16px",
              top: "120px",
              right: "5px",
              textAlign: "center",
              color: textColor,
              width: "110px",
              justifyContent: "center",
            }}
          >
            {interaction?.user?.username ||
              interaction?.user?.displayName ||
              "{username}"}
          </div>

          <div
            style={{
              position: "absolute",
              textAlign: "center",
              top: "140px",
              right: "5px",
              display: "flex",
              fontSize: "8px",
              opacity: "0.4",
              color: tertiaryTextColor,
              width: "110px",
              justifyContent: "center",
            }}
          >
            #{interaction?.user?.id || "{id}"}
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
      ></div>
      {/* Render banknotes above the Balance rectangle */}
    </div>
  );
};

// Update the dimensions calculation
Balance.dimensions = {
  width: 400,
  height: (props) => {
    console.log("PROPS")
    console.log(props)
    const isMarried = props?.database?.marriageStatus?.status;
    return isMarried ? 260 : 235;
  },
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
  married: {
    // Added translation for 'Married'
    en: "Married",
    ru: "В браке",
    uk: "У шлюбі",
  },
  yours: {
    en: "yours",
    ru: "ваши",
    uk: "ваші",
  },

};

export default Balance;
