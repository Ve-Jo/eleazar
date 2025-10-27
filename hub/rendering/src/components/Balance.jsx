import prettyMilliseconds from "pretty-ms";
import Decimal from "decimal.js";
import { getCountryFlag, countryFlags } from "../utils/countryFlagsRender.js";
import Banknotes from "./unified/Banknotes.jsx";

// Function to get gender emoji
const getGenderEmoji = (gender) => {
  if (!gender) return null;
  const genderLower = gender.toLowerCase();

  switch (genderLower) {
    case "male":
    case "man":
    case "boy":
      return "♂️";
    case "female":
    case "woman":
    case "girl":
      return "♀️";
    case "non-binary":
    case "nonbinary":
      return "⚧️";
    case "other":
    case "prefer not to say":
      return "🧑";
    default:
      return "🧑";
  }
};

const Balance = (props) => {
  const { interaction, database, i18n, coloring } = props;

  // --- Personalization Data ---
  const userRealName = database?.realName;
  const userAge = database?.age;
  const userCountryCode = database?.countryCode;
  const userGender = database?.gender;

  // Function to format personalization display
  const formatPersonalizationDisplay = () => {
    if (!userRealName && !userAge) return null;

    const parts = [];
    if (userRealName) parts.push(userRealName);
    if (userAge) parts.push(`${userAge}y.o`);

    // Add gender emoji if available
    if (userGender) {
      const genderEmoji = getGenderEmoji(userGender);
      if (genderEmoji) parts.push(genderEmoji);
    }

    if (userCountryCode) {
      const countryFlag = getCountryFlag(userCountryCode);
      if (countryFlag) parts.push(countryFlag);
    }

    return parts.join(", ");
  };

  const isMarried = props?.database?.marriageStatus?.status === "MARRIED";

  const combinedBankBalanceProp = database?.combinedBankBalance;

  // --- XP Data for Level Bars ---
  // Use the pre-calculated level data from hubClient.calculateLevel (passed via levelProgress)
  const chatLevelData = database?.levelProgress?.chat;
  const gameLevelData = database?.levelProgress?.game;

  // --- Level Data ---
  const chattingLevel = chatLevelData?.level || 1;
  const gamingLevel = gameLevelData?.level || 1;
  const cachesCount = database?.caches?.count || 2;

  // Extract XP data for fill calculations
  const chatFillRatio = chatLevelData
    ? Math.min(chatLevelData.currentXP / chatLevelData.requiredXP, 1)
    : 0;
  const gameFillRatio = gameLevelData
    ? Math.min(gameLevelData.currentXP / gameLevelData.requiredXP, 1)
    : 0;

  const translations = Object.entries(Balance.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale()] || translations.en,
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

  const bankStartTime = database?.economy?.bankStartTime || 0;
  const bankRate = database?.economy?.bankRate || 0;
  // Use combined balance if married, otherwise use individual
  let bankBalanceForDisplay = new Decimal(database?.economy?.bankBalance || 0);
  const individualBankBalance = database?.individualBankBalance // Get individual balance prop
    ? new Decimal(database.individualBankBalance)
    : new Decimal(0);

  // CSS-only approach - no manual width calculation needed
  // The flexbox layout will naturally size based on content
  const partnerAvatarUrl =
    database?.partnerAvatarUrl ||
    "https://cdn.discordapp.com/embed/avatars/0.png";
  const partnerUsername = database?.partnerUsername || "Partner";
  const marriageCreatedAt = database?.marriageStatus?.createdAt;

  if (isMarried && combinedBankBalanceProp !== undefined) {
    bankBalanceForDisplay = new Decimal(combinedBankBalanceProp);
  }
  let walletBalance = new Decimal(database?.economy?.balance || 0);

  // Use the potentially combined balance for visual banknote calculation
  let visualBankBalanceAmount = bankBalanceForDisplay.toNumber();
  let visualWalletBalanceAmount = walletBalance.toNumber();

  let visualwallet = visualWalletBalanceAmount.toFixed(0).toString().length;
  let visualbank = visualBankBalanceAmount.toFixed(0).toString().length;

  const mainBackground = database?.bannerUrl
    ? "transparent"
    : backgroundGradient;

  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          display: "flex",
          width: "400px", // Keep original width
          height: "235px", // Only height changes when married
          borderRadius: database?.bannerUrl ? "0px" : "20px",
          padding: "20px",
          color: textColor,
          fontFamily: "Inter600, sans-serif",
          position: "relative",
          overflow: "hidden",
          background: mainBackground,
        }}
      >
        {/* Banknotes are now inside the wallet rectangle */}

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
                transform: "scale(1.1)",
                opacity: "0.6",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
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
              style={{
                width: "260px", // Keep original width
                display: "flex",
                flexDirection: "column",
                marginLeft: "0px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "10px",
                  left: "1px",
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
                    marginLeft: "10px",
                    color: textColor,
                    alignItems: "center",
                  }}
                >
                  {translations.title}
                  <span
                    style={{
                      fontSize: "14px",
                      opacity: "0.5",
                      marginLeft: "8px",
                      lineHeight: "24px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {interaction?.user?.username ||
                      interaction?.user?.displayName ||
                      "{username}"}
                  </span>
                </h2>
              </div>

              {/* Banknotes are now inside the bank rectangle */}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "10px",
                  gap: "5px",
                  marginLeft: "42px",
                }}
              >
                {/* Wallet Section - Independent container */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "auto", // Natural width based on content
                    minWidth: "200px", // Minimum reasonable width
                    maxWidth: "320px", // Maximum width limit
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: overlayBackground,
                      borderRadius: "10px 10px 10px 0px",
                      padding: "5px 12px",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      position: "relative",
                      overflow: "hidden",
                      boxSizing: "border-box",
                      flexShrink: 0,
                      width: "auto", // Natural width based on content
                    }}
                  >
                    {/* Wallet banknotes inside the rectangle */}
                    <Banknotes
                      amount={walletBalance}
                      style="banknotes"
                      division={50}
                      xspacing={24}
                      styleOverrides={{
                        container: {
                          position: "absolute",
                          overflow: "hidden",
                          top: "10px",
                        },
                        banknote: {
                          width: "12px",
                          height: "4px",
                        },
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        fontSize: "24px",
                        marginRight: "15px",
                        flexShrink: 0,
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      💵
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                        position: "relative",
                        zIndex: 1,
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
                </div>

                {/* Bank Section - Independent container */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0px",
                    marginLeft: "0px",
                    width: "auto", // Natural width based on content
                    minWidth: "200px", // Minimum reasonable width
                    maxWidth: "320px", // Maximum width limit
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: overlayBackground,
                      borderRadius: "0 10px 0px 0",
                      padding: "5px 12px",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      position: "relative",
                      overflow: "hidden",
                      boxSizing: "border-box",
                      flexShrink: 0,
                      width: "100%", // Full width to match annual + distribution panel
                    }}
                  >
                    {/* Bank banknotes inside the rectangle */}
                    <Banknotes
                      amount={visualBankBalanceAmount}
                      style="bars"
                      division={100}
                      xspacing={24}
                      styleOverrides={{
                        container: {
                          position: "absolute",
                          top: "10px",
                          overflow: "hidden",
                        },
                        banknote: {
                          width: "12px",
                          height: "4px",
                        },
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        fontSize: "24px",
                        marginRight: "15px",
                        flexShrink: 0,
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      💳
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
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

                              const effectiveAnnualRate = bankRate / 100;
                              const hourlyRate =
                                effectiveAnnualRate *
                                (MS_PER_HOUR / MS_PER_YEAR);
                              return bankBalanceForDisplay
                                .mul(hourlyRate)
                                .toFixed(3);
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
                        }}
                      >
                        {/* Display logic using bankBalanceForDisplay */}
                        {bankStartTime > 0 || isMarried ? (
                          <div
                            style={{ display: "flex", alignItems: "baseline" }}
                          >
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

                  {/* Bank Annual Rate Display - Now inside bank container */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0px",
                      alignItems: "stretch",
                      alignSelf: "flex-start",
                      flexShrink: 0,
                      width: "auto", // Natural width based on content
                      minWidth: "200px", // Minimum reasonable width
                      maxWidth: "320px", // Same max width as bank balance above
                    }}
                  >
                    {/* Annual Rate - Left side */}
                    <div
                      style={{
                        display: "flex",
                        background:
                          bankStartTime == 0
                            ? "rgba(137, 137, 137, 0.5)"
                            : "rgba(210, 210, 210, 0.5)",
                        color: coloring?.isDarkText ? "#000" : "#FFF",
                        borderRadius: "0 0px 0px 10px",
                        padding: "8px 8px",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "50%",
                        minWidth: "100px",
                        position: "relative",
                        overflow: "hidden",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          left: "5px",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span style={{ fontSize: "16px", fontWeight: "600" }}>
                          {bankRate}%
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            right: "5px",
                            opacity: 0.8,
                            alignSelf: "flex-start",
                            marginTop: "-2px",
                          }}
                        >
                          {translations.annual}
                        </span>
                      </div>
                      {/* Time text - bottom right */}
                      {bankStartTime > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "8px",
                            fontSize: "8px",
                            opacity: 0.6,
                          }}
                        >
                          {(() => {
                            const now = Date.now();
                            // Handle different timestamp formats
                            let startTimeMs;
                            if (bankStartTime > 1000000000000) {
                              // Already in milliseconds (JavaScript timestamp)
                              startTimeMs = bankStartTime;
                            } else if (bankStartTime > 1000000000) {
                              // Unix timestamp in seconds - convert to milliseconds
                              startTimeMs = bankStartTime * 1000;
                            } else {
                              // Fallback to current time if invalid
                              startTimeMs = now;
                            }

                            const diffMs = now - startTimeMs;
                            const diffDays = Math.floor(
                              diffMs / (1000 * 60 * 60 * 24)
                            );
                            const diffHours = Math.floor(
                              (diffMs % (1000 * 60 * 60 * 24)) /
                                (1000 * 60 * 60)
                            );
                            const diffMinutes = Math.floor(
                              (diffMs % (1000 * 60 * 60)) / (1000 * 60)
                            );

                            if (diffDays > 0) {
                              return `${diffDays}${translations.timeDay} ${
                                diffHours % 24
                              }${translations.timeHour}`;
                            } else if (diffHours > 0) {
                              return `${diffHours}${translations.timeHour} ${diffMinutes}${translations.timeMinute}`;
                            } else if (diffMinutes > 0) {
                              return `${diffMinutes}${translations.timeMinute}`;
                            } else {
                              return translations.timeLessThanMinute;
                            }
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Distribution Reward - Right side */}
                    {(() => {
                      const vaultEarnings = database?.vaultEarnings || 0;
                      const vaultDistributions =
                        database?.vaultDistributions || [];
                      const hasEarnings = Number(vaultEarnings) > 0;

                      // Show empty placeholder when no earnings
                      if (!hasEarnings) {
                        return (
                          <div
                            style={{
                              display: "flex",
                              background: "rgba(137, 137, 137, 0.3)",
                              borderRadius: "0 0 15px 0px",
                              padding: "2px 8px",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "50%",
                              minWidth: "100px",
                              color: coloring?.isDarkText ? "#000" : "#FFF",
                            }}
                          >
                            <span style={{ fontSize: "11px" }}>—</span>
                          </div>
                        );
                      }

                      // Format time for display
                      const formatTime = (timestamp) => {
                        const now = Date.now();
                        const diffMs = now - timestamp;
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(
                          diffMs / (1000 * 60 * 60 * 24)
                        );

                        if (diffDays > 0) {
                          return `${diffDays}${translations.timeDay}`;
                        } else if (diffHours > 0) {
                          return `${diffHours}${translations.timeHour}`;
                        } else if (diffMinutes > 0) {
                          return `${diffMinutes}${translations.timeMinute}`;
                        } else {
                          return translations.timeLessThanMinute;
                        }
                      };

                      // Get last 3 distributions, sorted by timestamp (newest first)
                      const recentDistributions = vaultDistributions
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 3);

                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            background: "#76b94d",
                            borderRadius: "0 0 15px 0px",
                            padding: "2px 6px",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "50%",
                            minWidth: "100px",
                            color: "#FFF",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {/* Total earnings - Left side */}
                          <div
                            style={{
                              fontSize: "16px",
                              display: "flex",
                              fontWeight: "600",
                              flexShrink: 0,
                            }}
                          >
                            +{Number(vaultEarnings).toFixed(2)}
                          </div>

                          {/* Recent distributions - Right side */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              fontSize: "7px",
                              opacity: 0.9,
                              gap: "1px",
                              alignItems: "flex-start",
                              flex: 1,
                              marginLeft: "4px",
                            }}
                          >
                            {recentDistributions.map((dist, index) => (
                              <div
                                key={index}
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-start",
                                  width: "100%",
                                  opacity: 0.8 - index * 0.1, // Fade older entries
                                }}
                              >
                                <span>
                                  +{Number(dist.amount).toFixed(2)}{" "}
                                  {formatTime(dist.timestamp)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                width: "90px",
                height: "90px",
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
                  width="90"
                  height="90"
                  style={{
                    objectFit: "cover",
                    borderRadius: "25px",
                    border: `1px solid ${coloring.overlayBackground}`,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                textAlign: "center",
                top: "98px",
                right: "5px",
                display: "flex",
                fontSize: "8px",
                opacity: "0.4",
                color: tertiaryTextColor,
                width: "90px",
                justifyContent: "center",
                alignItems: "center",
                height: "12px",
              }}
            >
              #{interaction?.user?.id || "{id}"}
            </div>

            {/* Marriage Status - moved inside the card */}
            {isMarried && (
              <div
                style={{
                  position: "absolute",
                  left: "25px",
                  top: "221px",
                  minWidth: "146px",
                  width: "auto",
                  maxWidth: "200px",
                  height: "31px",
                  backgroundColor: "#bb3d36",
                  borderRadius: "10px 10px 10px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  zIndex: 1,
                  padding: "0 12px 0 8px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "8px",
                    flexShrink: 0,
                  }}
                >
                  💍
                </div>
                <img
                  src={partnerAvatarUrl}
                  alt={partnerUsername}
                  width={19}
                  height={19}
                  style={{
                    borderRadius: "50%",
                    display: "flex",
                    flexShrink: 0,
                    marginRight: "8px",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    fontSize: "14px",
                    color: textColor,
                    fontFamily: "Inter600",
                    display: "flex",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {marriageCreatedAt
                    ? `${translations.married} (${prettyMilliseconds(
                        Date.now() - new Date(marriageCreatedAt).getTime()
                      )})`
                    : translations.married}
                </div>
              </div>
            )}
          </div>

          {/* Personalization Display - User Profile Info */}
          {(userRealName || userAge || userCountryCode) && (
            <div
              style={{
                position: "absolute",
                textAlign: "center",
                top: "115px",
                right: "5px",
                display: "flex",
                fontSize: "14px",
                fontWeight: "600",
                color: "#ffffff",
                width: "90px",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "21px",
                fontFamily: "Inter600, sans-serif",
                lineHeight: "1.2",
                zIndex: 2,
              }}
            >
              <span className="text-node">
                {formatPersonalizationDisplay()}
              </span>
            </div>
          )}
        </div>

        {/* Level Bars - Positioned on the left side */}
        <div
          style={{
            position: "absolute",
            left: "22px",
            top: "59px",
            width: "36px",
            height: "156px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            zIndex: 1,
          }}
        >
          {/* Hard-limited total height with proportional bar distribution */}
          {(() => {
            const maxLevel = Math.max(chattingLevel, gamingLevel, 1); // Ensure at least 1 to avoid division by zero
            const totalMaxHeight = 158; // Hard limit for combined height of both bars
            const minBarHeight = 55; // Minimum height for each bar

            // Calculate level ratios
            const chattingRatio = chattingLevel / maxLevel;
            const gamingRatio = gamingLevel / maxLevel;

            // Calculate ideal heights based on levels
            const idealChattingHeight =
              minBarHeight +
              (totalMaxHeight - minBarHeight * 2) * chattingRatio;
            const idealGamingHeight =
              minBarHeight + (totalMaxHeight - minBarHeight * 2) * gamingRatio;

            // Ensure minimum heights and cap total
            const totalIdealHeight = idealChattingHeight + idealGamingHeight;

            let chattingHeight, gamingHeight;
            if (totalIdealHeight <= totalMaxHeight) {
              // If total fits within limit, use ideal heights
              chattingHeight = Math.max(minBarHeight, idealChattingHeight);
              gamingHeight = Math.max(minBarHeight, idealGamingHeight);
            } else {
              // If total exceeds limit, scale down proportionally
              const scaleFactor = totalMaxHeight / totalIdealHeight;
              chattingHeight = Math.max(
                minBarHeight,
                idealChattingHeight * scaleFactor
              );
              gamingHeight = Math.max(
                minBarHeight,
                idealGamingHeight * scaleFactor
              );
            }

            return [
              /* Chatting Level - Dynamic height */
              <div
                key="chatting-level"
                style={{
                  width: "36px",
                  height: `${chattingHeight}px`,
                  background: `linear-gradient(to bottom, ${overlayBackground}, rgba(193, 86, 255, 0.5))`,
                  borderRadius: "10px 10px 0 0",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "6px",
                    color: secondaryTextColor,
                    marginTop: "3px",
                    textTransform: "uppercase",
                    fontFamily: "Inter600",
                    marginBottom: "2px",
                    display: "flex",
                  }}
                >
                  {translations.chatting || "ЧАТТИНГ"}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(0, chattingHeight * chatFillRatio)}px`,
                    background: "#bd4eff",
                    position: "absolute",
                    bottom: "0",
                    left: "0",
                    borderRadius: "0 0 0 0",
                    display: "flex",
                  }}
                />
                <div
                  style={{
                    fontSize: "24px",
                    color: textColor,
                    fontFamily: "Inter600",
                    position: "absolute",
                    bottom: "8px",
                    display: "flex",
                    alignItems: "baseline",
                  }}
                >
                  <span>{chattingLevel}</span>
                  <span
                    style={{
                      fontSize: "8px",
                      marginLeft: "1px",
                      top: "-3px",
                    }}
                  >
                    lvl
                  </span>
                </div>
              </div>,

              /* Gaming Level - Dynamic height */
              <div
                key="gaming-level"
                style={{
                  width: "36px",
                  height: `${gamingHeight}px`,
                  background: `linear-gradient(to bottom, ${overlayBackground}, rgba(255, 90, 90, 0.5))`,
                  borderRadius: "0 0 12px 12px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "6px",
                    color: secondaryTextColor,
                    marginTop: "3px",
                    textTransform: "uppercase",
                    fontFamily: "Inter600",
                    marginBottom: "2px",
                    display: "flex",
                  }}
                >
                  {translations.gaming || "ГЕЙМИНГ"}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(0, gamingHeight * gameFillRatio)}px`,
                    background: "#d55656",
                    position: "absolute",
                    bottom: "0",
                    left: "0",
                    borderRadius: "0 0 12px 12px",
                    display: "flex",
                  }}
                />
                <div
                  style={{
                    fontSize: "24px",
                    color: textColor,
                    fontFamily: "Inter600",
                    position: "absolute",
                    bottom: "12px",
                    display: "flex",
                    alignItems: "baseline",
                  }}
                >
                  <span>{gamingLevel}</span>
                  <span
                    style={{ fontSize: "8px", marginLeft: "1px", top: "-3px" }}
                  >
                    lvl
                  </span>
                </div>
              </div>,
            ];
          })()}
        </div>
      </div>

      {isMarried && (
        <div
          style={{
            position: "absolute",
            left: "25px",
            top: "235px",
            minWidth: "160px",
            width: "auto",
            maxWidth: "280px",
            height: "31px",
            backgroundColor: "#bb3d36",
            borderRadius: "0 0 10px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            zIndex: 1,
            padding: "0 12px 0 8px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "8px",
              flexShrink: "0",
            }}
          >
            💍
          </div>
          <img
            src={partnerAvatarUrl}
            alt={partnerUsername}
            width={19}
            height={19}
            style={{
              borderRadius: "50%",
              display: "flex",
              flexShrink: "0",
              marginRight: "8px",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              fontSize: "14px",
              color: textColor,
              fontFamily: "Inter600",
              display: "flex",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: "1",
              minWidth: "0",
            }}
          >
            {marriageCreatedAt
              ? `${translations.married} (${prettyMilliseconds(
                  Date.now() - new Date(marriageCreatedAt).getTime()
                )})`
              : translations.married}
          </div>
        </div>
      )}
    </div>
  );
};

// Update the dimensions calculation - make width dynamic too
Balance.dimensions = {
  width: 400,
  height: function (props) {
    const isMarried = props?.database?.marriageStatus?.status === "MARRIED";
    const hasPersonalization =
      props?.database?.realName || props?.database?.age;
    return isMarried ? 267 : hasPersonalization ? 255 : 235;
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
    en: "Married",
    ru: "В браке",
    uk: "У шлюбі",
  },
  yours: {
    en: "yours",
    ru: "ваши",
    uk: "ваші",
  },
  chatting: {
    en: "CHATTING",
    ru: "ЧАТТИНГ",
    uk: "ЧАТТІНГ",
  },
  gaming: {
    en: "GAMING",
    ru: "ГЕЙМИНГ",
    uk: "ГЕЙМІНГ",
  },
  vault: {
    en: "Vault",
    ru: "Сейф",
    uk: "Сейф",
  },
  timeDay: {
    en: "d",
    ru: "д",
    uk: "д",
  },
  timeHour: {
    en: "h",
    ru: "ч",
    uk: "ч",
  },
  timeMinute: {
    en: "m",
    ru: "м",
    uk: "м",
  },
  timeLessThanMinute: {
    en: "<1m",
    ru: "<1м",
    uk: "<1м",
  },
};

export default Balance;
