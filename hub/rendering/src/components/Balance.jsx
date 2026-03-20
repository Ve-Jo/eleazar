import prettyMilliseconds from "pretty-ms";
import Decimal from "decimal.js";
import { getCountryFlag, countryFlags } from "../utils/countryFlagsRender.ts";
import Banknotes from "./unified/Banknotes.jsx";
import InfoRectangle from "./unified/InfoRectangle.jsx";

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
  const userGender = database?.gender;
  const userLocale = database?.locale || "en"; // Default to English if no locale

  // Function to derive country from locale
  const getCountryFromLocale = (locale) => {
    const localeToCountryMap = {
      "en": "US", // English -> United States
      "ru": "RU", // Russian -> Russia  
      "uk": "UA", // Ukrainian -> Ukraine
    };
    return localeToCountryMap[locale] || "US"; // Default to US if locale not found
  };

  const userCountryCode = getCountryFromLocale(userLocale);

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
  const voiceLevelData = database?.levelProgress?.voice;
  const gameLevelData = database?.levelProgress?.game;

  // --- Level Data ---
  const chattingLevel = chatLevelData?.level || 1;
  const voiceLevel = voiceLevelData?.level || 1;
  const gamingLevel = gameLevelData?.level || 1;
  const cachesCount = database?.caches?.count || 2;

  // Extract XP data for fill calculations
  const chatFillRatio = chatLevelData
    ? Math.min(chatLevelData.currentXP / chatLevelData.requiredXP, 1)
    : 0;
  const voiceFillRatio = voiceLevelData
    ? Math.min(voiceLevelData.currentXP / voiceLevelData.requiredXP, 1)
    : 0;
  const gameFillRatio = gameLevelData
    ? Math.min(gameLevelData.currentXP / gameLevelData.requiredXP, 1)
    : 0;

  const renderLevelRectangle = ({
    icon,
    title,
    level,
    fill,
    accent,
    currentXP,
    requiredXP,
    isMini,
    rank,
    showMiniTitle = true,
    borderRadius,
  }) => (
    <InfoRectangle
      icon={icon}
      iconSize={isMini ? "16px" : "24px"}
      iconMarginRight={isMini ? "8px" : "12px"}
      background={overlayBackground}
      borderRadius={borderRadius}
      title={
        isMini
          ? null
          : (
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {title}
              {rank ? (
                <span style={{ fontSize: "10px", opacity: 0.8, fontWeight: 700, color: tertiaryTextColor }}>
                  #{rank}
                </span>
              ) : null}
            </span>
          )
      }
      titleStyle={{
        fontSize: "12px",
        color: secondaryTextColor,
        opacity: 0.85,
        letterSpacing: "0.3px",
      }}
      value={
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "6px",
            color: textColor,
          }}
        >
          {isMini && showMiniTitle && (
            <span style={{ fontSize: "10px", color: secondaryTextColor, opacity: 0.85, marginRight: "4px", fontWeight: 600 }}>
              {title}
            </span>
          )}
          <span style={{ fontSize: isMini ? "14px" : "22px", fontWeight: 800 }}>{level}</span>
          <span style={{ fontSize: isMini ? "8px" : "10px", opacity: 0.8 }}>lvl</span>
          {rank ? (
            <span style={{ fontSize: isMini ? "10px" : "10px", opacity: 0.85, fontWeight: 700, color: tertiaryTextColor }}>
              #{rank}
            </span>
          ) : null}
          {currentXP !== undefined && requiredXP !== undefined && !isMini ? (
            <span
              style={{
                fontSize: "10px",
                opacity: 0.75,
                fontWeight: 600,
              }}
            >
              {`${Math.floor(currentXP)} / ${Math.max(1, Math.floor(requiredXP))} XP`}
            </span>
          ) : null}
        </div>
      }
      padding={isMini ? "6px 8px" : "10px 12px"}
      minWidth={isMini ? "0px" : "0px"}
      maxWidth={isMini ? "auto" : "350px"}
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: isMini ? "32px" : "74px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${Math.max(0, Math.min(1, fill)) * 100}%`,
          background: `${accent}55`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </InfoRectangle>
  );

  const translations = Object.entries(Balance.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale()] || translations.en,
    }),
    {}
  );

  const hints = database?.hints || {};
  const crimeRemainingMs = Math.max(0, Number(hints.crimeRemainingMs || 0));
  const crimeCooldownMs = Math.max(1, Number(hints.crimeCooldownMs || 1));
  const crimeOnCooldown = crimeRemainingMs > 0;
  const crimeCooldownProgress = Math.min(1, Math.max(0, (crimeCooldownMs - crimeRemainingMs) / crimeCooldownMs));
  const casesCooldowns = hints.casesCooldowns || {};
  const dailyCaseRemainingMs = Math.max(0, Number(casesCooldowns.dailyRemainingMs || 0));
  const weeklyCaseRemainingMs = Math.max(0, Number(casesCooldowns.weeklyRemainingMs || 0));
  const dailyCaseCooldownMs = Math.max(1, Number(casesCooldowns.dailyCooldownMs || 24 * 60 * 60 * 1000));
  const weeklyCaseCooldownMs = Math.max(1, Number(casesCooldowns.weeklyCooldownMs || 7 * 24 * 60 * 60 * 1000));
  const dailyCaseProgress = Math.min(1, Math.max(0, (dailyCaseCooldownMs - dailyCaseRemainingMs) / dailyCaseCooldownMs));
  const weeklyCaseProgress = Math.min(1, Math.max(0, (weeklyCaseCooldownMs - weeklyCaseRemainingMs) / weeklyCaseCooldownMs));
  const closestCaseRemainingMsRaw =
    casesCooldowns.closestRemainingMs === null || casesCooldowns.closestRemainingMs === undefined
      ? hints.dailyRemainingMs
      : casesCooldowns.closestRemainingMs;
  const closestCaseRemainingMs =
    closestCaseRemainingMsRaw === null ? 0 : Math.max(0, Number(closestCaseRemainingMsRaw || 0));
  const caseAvailableCount =
    typeof hints.dailyAvailable === "number" ? hints.dailyAvailable : (hints.dailyAvailable ? 1 : 0);
  const casesOnCooldown = caseAvailableCount <= 0 && closestCaseRemainingMs > 0;
  const showHints =
    hints.dailyAvailable ||
    casesOnCooldown ||
    hints.upgradesAffordable ||
    hints.workAvailable ||
    typeof hints.crimeAvailable === "boolean" ||
    crimeOnCooldown;
  const dailyCooldownText =
    hints.dailyAvailable || hints.dailyRemainingMs === null
      ? null
      : prettyMilliseconds(Math.max(0, Number(hints.dailyRemainingMs) || 0), { compact: true });
  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring;
  const baseHintStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 8px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    width: "auto",
    minHeight: "28px",
    boxSizing: "border-box",
  };
  const grayEmojiHintStyle = {
    ...baseHintStyle,
    justifyContent: "center",
    width: "32px",
    minWidth: "32px",
    padding: "0px",
    height: "30px",
    minHeight: "30px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.06)",
    color: tertiaryTextColor,
    lineHeight: "1",
  };
  const dailyIsActive =
    caseAvailableCount > 0 || casesOnCooldown;
  const upgradesAreActive =
    typeof hints.upgradesAffordable === "number"
      ? hints.upgradesAffordable > 0
      : Boolean(hints.upgradesAffordable);
  const workIsActive = Number(hints.workEarnings?.totalCap || 0) > 0;
  const hintChips = [
    (
      <div
        key="daily"
        style={
          dailyIsActive
            ? {
                ...baseHintStyle,
                background: `linear-gradient(to right,
                  rgba(94, 171, 255, 0.42) 0%,
                  rgba(94, 171, 255, 0.42) ${Math.min(100, dailyCaseProgress * 100)}%,
                  rgba(94, 171, 255, 0) ${Math.min(100, dailyCaseProgress * 100)}%,
                  rgba(94, 171, 255, 0) 100%),
                  linear-gradient(to right,
                  rgba(184, 121, 255, 0.38) 0%,
                  rgba(184, 121, 255, 0.38) ${Math.min(100, weeklyCaseProgress * 100)}%,
                  rgba(184, 121, 255, 0) ${Math.min(100, weeklyCaseProgress * 100)}%,
                  rgba(184, 121, 255, 0) 100%),
                  rgba(255,255,255,0.06)`,
                color: casesOnCooldown ? tertiaryTextColor : textColor,
              }
            : grayEmojiHintStyle
        }
        title={
          casesOnCooldown
            ? `${translations.hintDailyCooldownShort}: ${prettyMilliseconds(closestCaseRemainingMs, { compact: true })}`
            : (hints.dailyAvailable ? translations.hintDailyReadyShort : translations.hintDailyCooldownShort)
        }
      >
        <span aria-hidden="true">📦</span>
        {dailyIsActive ? (
          <>
            <span style={{ fontWeight: 700 }}>
              {casesOnCooldown
                ? prettyMilliseconds(closestCaseRemainingMs, { compact: true })
                : caseAvailableCount}
            </span>
            {!casesOnCooldown ? (
              <span style={{ fontSize: "9px" }}>{translations.hintDailyLabel}</span>
            ) : null}
          </>
        ) : null}
      </div>
    ),
    (
      <div
        key="upgrade"
        style={
          upgradesAreActive
            ? {
                ...baseHintStyle,
                background: "rgba(255,255,255,0.06)",
                color: textColor,
              }
            : grayEmojiHintStyle
        }
        title={hints.upgradesAffordable ? translations.hintUpgradeReadyShort : translations.hintUpgradeLockedShort}
      >
        <span aria-hidden="true">🛠️</span>
        {upgradesAreActive ? (
          <>
            <span style={{ fontWeight: 700 }}>{typeof hints.upgradesAffordable === "number" ? hints.upgradesAffordable : (hints.upgradesAffordable ? 1 : 0)}</span>
            <span style={{ fontSize: "9px" }}>{translations.hintUpgradeLabel}</span>
          </>
        ) : null}
      </div>
    ),
    (
      <div
        key="work"
        style={
          workIsActive
            ? {
                ...baseHintStyle,
                background: `linear-gradient(to right,
                  ${(hints.workEarnings.progress || 0) >= 1 ? "#ff4444" : (hints.workEarnings.progress || 0) >= 0.7 ? "#ffaa00" : "#44ff44"} 0%,
                  ${(hints.workEarnings.progress || 0) >= 1 ? "#ff4444" : (hints.workEarnings.progress || 0) >= 0.7 ? "#ffaa00" : "#44ff44"} ${Math.min(100, (hints.workEarnings.progress || 0) * 100)}%,
                  rgba(255,255,255,0.06) ${Math.min(100, (hints.workEarnings.progress || 0) * 100)}%,
                  rgba(255,255,255,0.06) 100%)`,
                color: textColor,
              }
            : grayEmojiHintStyle
        }
        title={hints.workEarnings ? `${((hints.workEarnings.progress || 0) * 100).toFixed(2)}% of daily limit` : translations.hintWorkReadyShort}
      >
        <span aria-hidden="true">🎮</span>
        {workIsActive ? (
          <>
            <span style={{ fontWeight: 700 }}>
              {`${((hints.workEarnings.progress || 0) * 100).toFixed(2)}%`}
            </span>
            <span style={{ fontSize: "9px" }}>{translations.hintWorkLabel}</span>
          </>
        ) : null}
      </div>
    ),
    (
      <div
        key="crime"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 8px",
          borderRadius: "10px",
          background: crimeOnCooldown
            ? `linear-gradient(to right,
                rgba(160,160,160,0.65) 0%,
                rgba(160,160,160,0.65) ${Math.min(100, crimeCooldownProgress * 100)}%,
                rgba(255,255,255,0.06) ${Math.min(100, crimeCooldownProgress * 100)}%,
                rgba(255,255,255,0.06) 100%)`
            : "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: hints.crimeAvailable ? textColor : tertiaryTextColor,
          width: "auto",
        }}
        title={crimeOnCooldown ? translations.hintCrimeCooldownShort : translations.hintCrimeReadyShort}
      >
        <span aria-hidden="true">🦹</span>
        <span style={{ fontWeight: 700 }}>
          {crimeOnCooldown
            ? prettyMilliseconds(crimeRemainingMs, { compact: true })
            : (typeof hints.crimeAvailable === "number" ? hints.crimeAvailable : (hints.crimeAvailable ? 1 : 0))}
        </span>
        {!crimeOnCooldown ? (
          <span style={{ fontSize: "9px" }}>{translations.hintCrimeLabel}</span>
        ) : null}
      </div>
    ),
  ];

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
          width: "500px", // Slightly wider to fit content comfortably
          height: "300px", // Increased to fit hints block comfortably
          borderRadius: database?.bannerUrl ? "0px" : "20px",
          padding: "20px",
          color: textColor,
          fontFamily: "Inter",
          fontWeight: 500,
          fontWeight: 600,
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
            height: "100%", // Добавь это, чтобы нижняя часть могла "оттолкнуться"
            display: "flex",
            flexDirection: "column",
          }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              marginLeft: "0px",
            }}
          >
            <h2
              style={{
                margin: "0",
                fontSize: "24px",
                display: "flex",
                marginLeft: "0px",
                marginBottom: "12px",
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

            {/* Banknotes are now inside the bank rectangle */}

            {/* Main Content Area replacing Columns with Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0px", width: "100%", height: "100%" }}>

              {/* Row 1: Wallet + Chat/Gaming */}
              <div style={{ display: "flex", flexDirection: "row", gap: "5px", width: "auto", alignItems: "flex-start", marginBottom: "5px" }}>
                <div style={{ display: "flex" }}>
                  <InfoRectangle
                    icon="💵"
                    background={overlayBackground}
                    title={translations.wallet.toUpperCase()}
                    titleStyle={{
                      fontSize: "14px",
                      color: secondaryTextColor,
                      opacity: 0.8,
                    }}
                    value={
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
                    }
                    style={{ marginBottom: 0, minHeight: "70px", minWidth: "100px", position: "relative" }}
                  >
                    <Banknotes
                      amount={walletBalance}
                      style="banknotes"
                      division={50}
                      xspacing={24}
                      styleOverrides={{
                        container: {
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          overflow: "hidden",
                          zIndex: 0,
                        },
                        banknote: {
                          width: "12px",
                          height: "4px",
                        },
                      }}
                    />
                  </InfoRectangle>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", height: "auto", gap: "37px" }}>
                    <div style={{ display: "flex", width: "25%" }}>
                      {renderLevelRectangle({
                        icon: "💬",
                        title: translations.chatting || "CHATTING",
                        level: chattingLevel,
                        fill: chatFillRatio,
                        accent: "#2196F3",
                        currentXP: chatLevelData?.currentXP,
                        requiredXP: chatLevelData?.requiredXP,
                        isMini: true,
                        rank: chatLevelData?.rank,
                        showMiniTitle: false,
                        borderRadius: "12px 0 0 12px",
                      })}
                    </div>
                    <div style={{ display: "flex", width: "75%" }}>
                      {renderLevelRectangle({
                        icon: "🎤",
                        title: translations.voice || "VOICE",
                        level: voiceLevel,
                        fill: voiceFillRatio,
                        accent: "#00BCD4",
                        currentXP: voiceLevelData?.currentXP,
                        requiredXP: voiceLevelData?.requiredXP,
                        isMini: true,
                        rank: voiceLevelData?.rank,
                        showMiniTitle: false,
                        borderRadius: "0 12px 12px 0",
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", height: "auto", }}>
                    {renderLevelRectangle({
                      icon: "🎮",
                      title: translations.gaming || "GAMING",
                      level: gamingLevel,
                      fill: gameFillRatio,
                      accent: "#1DB935",
                      currentXP: gameLevelData?.currentXP,
                      requiredXP: gameLevelData?.requiredXP,
                      isMini: true,
                      rank: gameLevelData?.rank,
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Bank + Hints */}
              <div style={{ display: "flex", flexDirection: "row", gap: "5px", width: "auto", alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                  <InfoRectangle
                    icon="💳"
                    background={overlayBackground}
                    borderRadius="12px 12px 0 0"
                    title={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "14px",
                          opacity: 0.8,
                          color: secondaryTextColor,
                        }}
                      >
                        {translations.bank.toUpperCase()}
                        {isMarried && (
                          <span
                            style={{
                              opacity: 0.7,
                              fontSize: "8px",
                              marginTop: "18px",
                              top: "5px",
                              left: "-45px",
                            }}
                          >
                            ({translations.yours}: {individualBankBalance.toFixed(2)})
                          </span>
                        )}
                      </div>
                    }
                    value={
                      <div
                        style={{
                          display: "flex",
                          fontSize: "28px",
                          fontWeight: "bold",
                          alignItems: "baseline",
                        }}
                      >
                        {bankStartTime > 0 || isMarried ? (
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
                            {bankBalanceForDisplay.toFixed(2) || "{bank}"}
                          </div>
                        )}
                      </div>
                    }
                    // Keep bank height visually aligned with wallet block
                    style={{ minHeight: "70px", minWidth: "200px", position: "relative" }}
                  >
                    <Banknotes
                      amount={visualBankBalanceAmount}
                      style="bars"
                      division={100}
                      xspacing={24}
                      styleOverrides={{
                        container: {
                          position: "absolute",
                          inset: 0,
                          overflow: "hidden",
                          pointerEvents: "none",
                          zIndex: 0,
                        },
                        banknote: {
                          width: "12px",
                          height: "4px",
                        },
                      }}
                    />
                    {bankStartTime > 0 && bankRate > 0 ? (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 10,
                          fontSize: "12px",
                          opacity: 0.65,
                          color: textColor,
                          display: "flex",
                          gap: "2px",
                          alignItems: "center",
                        }}
                      >
                        <span>≈</span>
                        <span>
                          {(() => {
                            const MS_PER_HOUR = 60 * 60 * 1000;
                            const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

                            const effectiveAnnualRate = bankRate / 100;
                            const hourlyRate = effectiveAnnualRate * (MS_PER_HOUR / MS_PER_YEAR);
                            return bankBalanceForDisplay.mul(hourlyRate).toFixed(3);
                          })()}
                        </span>
                        <span>/h</span>
                      </div>
                    ) : null}
                  </InfoRectangle>

                  <div
                    style={{
                      display: "flex",
                      gap: "0px",
                      alignItems: "stretch",
                      alignSelf: "flex-start",
                      flexShrink: 0,
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        background:
                          bankStartTime == 0
                            ? "rgba(137, 137, 137, 0.5)"
                            : "rgba(210, 210, 210, 0.5)",
                        color: coloring?.isDarkText ? "#000" : "#FFF",
                        borderRadius: "0 0 0 12px",
                        padding: "8px 8px",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: 1,
                        position: "relative",
                        overflow: "hidden",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
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
                            opacity: 0.8,
                            alignSelf: "flex-start",
                            marginTop: "-2px",
                          }}
                        >
                          {translations.annual}
                        </span>
                      </div>
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
                            let startTimeMs;
                            if (bankStartTime > 1000000000000) {
                              startTimeMs = bankStartTime;
                            } else if (bankStartTime > 1000000000) {
                              startTimeMs = bankStartTime * 1000;
                            } else {
                              startTimeMs = now;
                            }

                            const diffMs = now - startTimeMs;
                            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                            if (diffDays > 0) {
                              return `${diffDays}${translations.timeDay} ${diffHours % 24}${translations.timeHour}`;
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

                    {(() => {
                      const vaultEarnings = database?.vaultEarnings || 0;
                      const vaultDistributions = database?.vaultDistributions || [];
                      const hasEarnings = Number(vaultEarnings) > 0;

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
                              flex: 1,
                              color: coloring?.isDarkText ? "#000" : "#FFF",
                            }}
                          >
                            <span style={{ fontSize: "11px" }}>—</span>
                          </div>
                        );
                      }

                      const formatTime = (timestamp) => {
                        const now = Date.now();
                        const diffMs = now - timestamp;
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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

                      const recentDistributions = vaultDistributions
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 3);

                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            background: "#76b94d",
                            borderRadius: "0 0 12px 0",
                            padding: "2px 6px",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flex: 1,
                            color: "#FFF",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              display: "flex",
                              fontWeight: "600",
                              flexShrink: 0,
                            }}
                          >
                            +{Number(vaultEarnings).toFixed(2)}
                          </div>

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
                                  opacity: 0.8 - index * 0.1,
                                }}
                              >
                                <span>
                                  +{Number(dist.amount).toFixed(2)} {formatTime(dist.timestamp)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", justifyContent: "flex-start" }}>
                  {showHints && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        marginTop: "0",
                        minHeight: "26px",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        alignSelf: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: "6px",
                          maxWidth: "60%",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                        }}
                      >
                        {hintChips}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Marriage (Anchored at bottom) */}
              <div style={{ display: "flex", flexDirection: "row", marginTop: "5px", justifyContent: "flex-start", alignItems: "flex-end", width: "100%" }}>
                <InfoRectangle
                  icon="💍"
                  iconSize="16px"
                  iconMarginRight="8px"
                  background={isMarried ? "#bb3d36" : "rgba(137, 137, 137, 0.5)"}
                  borderRadius="10px"
                  padding="6px 12px"
                  minWidth="auto"
                  maxWidth="100%"
                  style={{ minHeight: "26px"}}
                  value={
                    isMarried ? (
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <img
                          src={partnerAvatarUrl}
                          alt={partnerUsername}
                          width={18}
                          height={18}
                          style={{
                            borderRadius: "50%",
                            marginRight: "6px",
                            objectFit: "cover",
                          }}
                        />
                        <div
                          style={{
                            fontSize: "14px",
                            color: textColor,
                            fontFamily: "Inter", fontWeight: 500,
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          {translations.married}
                          {marriageCreatedAt && (
                            <span
                              style={{
                                fontSize: "12px",
                                opacity: 0.5,
                                marginLeft: "6px",
                                color: tertiaryTextColor,
                              }}
                            >
                              ({prettyMilliseconds(
                                Date.now() - new Date(marriageCreatedAt).getTime()
                              )})
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "14px",
                          color: textColor,
                          fontFamily: "Inter", fontWeight: 500,
                          opacity: 0.7,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {translations.single || "Single"}
                      </div>
                    )
                  }
                />
              </div>


            </div> {/* Close parent column container replacing grid */}
          </div> {/* Close the flex: 1 content wrapper */}

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
                }}
              />
            </div>
          </div>

          {/* Guild Icon - Bottom Right */}
          <div
            style={{
              position: "absolute",
              bottom: "5px",
              right: "5px",
              zIndex: 2,
              borderRadius: "5px",
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
                fontWeight: "500",
                color: "#ffffff",
                width: "90px",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "21px",
                fontFamily: "Inter", fontWeight: 500,
                lineHeight: "1.2",
                zIndex: 2,
              }}
            >
              <span className="text-node">
                {formatPersonalizationDisplay()}
              </span>
            </div>
          )}


        </div> {/* Close the relative content wrapper */}
      </div>
    </div>
  );
};

// Update the dimensions calculation - make width dynamic too
Balance.dimensions = {
  width: 500,
  height: 300, // Increased to fit hints block comfortably
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
  single: {
    en: "Single",
    ru: "Свободен",
    uk: "Вільний",
  },
  hintsTitle: {
    en: "Try these next",
    ru: "Попробуйте дальше",
    uk: "Спробуйте далі",
  },
  hintDailyReady: {
    en: "Daily crate is ready in /cases",
    ru: "Ежедневный кейс доступен в /cases",
    uk: "Щоденний кейс доступний у /cases",
  },
  hintDailyLabel: {
    en: "/cases",
    ru: "/cases",
    uk: "/cases",
  },
  hintDailyReadyShort: {
    en: "Daily ready",
    ru: "Daily готов",
    uk: "Daily готовий",
  },
  hintDailyCooldownShort: {
    en: "Daily on cooldown",
    ru: "Daily на кулдауне",
    uk: "Daily на кулдауне",
  },
  hintDailyCooldown: {
    en: "Daily crate ready in {{ time }}",
    ru: "Ежедневный кейс будет через {{ time }}",
    uk: "Щоденний кейс буде через {{ time }}",
  },
  hintUpgradeReady: {
    en: "You can afford upgrades in /shop",
    ru: "У вас хватает на улучшения в /shop",
    uk: "У вас вистачає на поліпшення в /shop",
  },
  hintUpgradeLabel: {
    en: "/shop",
    ru: "/shop",
    uk: "/shop",
  },
  hintWorkLabel: {
    en: "/work",
    ru: "/work",
    uk: "/work",
  },
  hintUpgradeReadyShort: {
    en: "Upgrades ready",
    ru: "Апгрейды доступны",
    uk: "Апгрейди доступні",
  },
  hintUpgradeLockedShort: {
    en: "Upgrades locked",
    ru: "Апгрейды недоступны",
    uk: "Апгрейди недоступні",
  },
  hintWorkReadyShort: {
    en: "Games available in /work",
    ru: "Игры доступны в /work",
    uk: "Ігри доступні в /work",
  },
  hintCrimeLabel: {
    en: "/crime",
    ru: "/crime",
    uk: "/crime",
  },
  hintCrimeReadyShort: {
    en: "Crime ready",
    ru: "Crime готов",
    uk: "Crime готовий",
  },
  hintCrimeCooldownShort: {
    en: "Crime on cooldown",
    ru: "Crime на кулдауне",
    uk: "Crime на кулдауні",
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
  voice: {
    en: "VOICE",
    ru: "ГОЛОС",
    uk: "ГОЛОС",
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
