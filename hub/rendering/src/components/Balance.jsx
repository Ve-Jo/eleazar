import prettyMilliseconds from "pretty-ms";
import Decimal from "decimal.js";

const Balance = (props) => {
  const isMarried = props?.database?.marriageStatus?.status === "MARRIED";

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
      right: 400, // Increased width when married
      bottom: isMarried ? 260 : 235, // Component height
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

  const combinedBankBalanceProp = database?.combinedBankBalance;
  // --- End Marriage Check ---

  // --- XP Data for Level Bars ---
  // Use the pre-calculated level data from hubClient.calculateLevel (passed via levelProgress)
  const chatLevelData = database?.levelProgress?.chat;
  const gameLevelData = database?.levelProgress?.game;

  // --- Level Data ---
  const chattingLevel = chatLevelData?.level || 1;
  const gamingLevel = gameLevelData?.level || 1;
  const cachesCount = database?.caches?.count || 2;

  console.log(chattingLevel, gamingLevel);

  // Extract XP data for fill calculations (similar to Level2 component)
  const chatFillRatio = chatLevelData
    ? Math.min(chatLevelData.currentXP / chatLevelData.requiredXP, 1)
    : 0;
  const gameFillRatio = gameLevelData
    ? Math.min(gameLevelData.currentXP / gameLevelData.requiredXP, 1)
    : 0;
  // --- End XP Data ---

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

  // Calculate optimal container width based on both bank and annual rate content
  const calculateOptimalWidth = () => {
    // Universal width calculation with reduced scaling for last 3 digits
    // Now properly handles combined bank balance when married

    const baseWidth = 47; // Base width for minimum viable content
    const maxWidth = 350;

    // Calculate bank content width needs
    // Use combined balance when married, individual balance when single
    const displayDecimalPlaces = bankStartTime > 0 || isMarried ? 5 : 2;
    const balanceToCalculate = isMarried
      ? combinedBankBalanceProp
      : bankBalanceForDisplay;
    const bankBalanceLength =
      balanceToCalculate.toFixed(displayDecimalPlaces).length;
    const bankLabelLength = translations.bank.length;

    // Universal formula: full scaling for most digits, reduced scaling for last 3
    // When showing 5 decimals, the last 3 digits (the small decimals) get reduced scaling

    let balanceWidth;
    if (displayDecimalPlaces === 5 && bankBalanceLength > 3) {
      // For 5 decimal places: full scaling for all digits except last 3
      const mainDigits = bankBalanceLength - 3;
      const smallDecimals = 3;
      balanceWidth = mainDigits * 14 + smallDecimals * 8; // 16px for main, 8px for small decimals
    } else {
      // For 2 decimal places or very small numbers: full scaling for all digits
      balanceWidth = bankBalanceLength * 16;
    }

    const bankContentWidth =
      baseWidth +
      balanceWidth + // Character width calculation with reduced scaling for last 3
      Math.max(0, bankLabelLength - 4) * 6 + // Label width
      (isMarried ? 15 : 0) + // Married indicator (already accounted for in your original code)
      40; // Emoji and margins buffer

    // Calculate annual rate content width needs
    let annualContentWidth = baseWidth;
    if (bankStartTime > 0 && bankRate > 0) {
      const timeText = prettyMilliseconds(Date.now() - Number(bankStartTime), {
        colonNotation: true,
        secondsDecimalDigits: 0,
      });
      const annualText = `${bankRate}% ${translations.annual} (${timeText})`;
      const annualTextLength = annualText.length;

      // Universal formula for annual rate with increased multiplier
      annualContentWidth = baseWidth + annualTextLength * 4.5 + 25; // Increased to 4.5px and 25px padding
    }

    // Return the maximum width needed, capped at maxWidth
    return Math.min(
      Math.max(bankContentWidth, annualContentWidth, baseWidth),
      maxWidth
    );
  };

  const optimalWidth = calculateOptimalWidth();
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
      }}
    >
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
        {/* Define wallet container bounds - adjusted for increased width when married */}
        {renderBanknotes(walletBalance, 145, 115, "banknotes", 50, 18, {
          left: 60,
          top: 45,
          right: 220 + (visualwallet - 3) * 20,
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
              {/* Define bank container bounds - use the amount used for visuals - adjusted for increased width */}
              {renderBanknotes(
                visualBankBalanceAmount,
                145,
                161,
                "bars",
                100,
                18,
                {
                  left: 40,
                  top: 90,
                  right: 255 + (visualbank - 3) * 5,
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
                  marginLeft: "42px",
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
                    borderRadius: "0 10px 0px 0",
                    padding: "5px 15px",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    minWidth: "150px",
                    maxWidth: "300px",
                    position: "relative", // Added for proper positioning context
                    overflow: "hidden", // Added to clip overflowing banknotes
                    boxSizing: "border-box", // Ensure padding is included in width calculation
                    width: `${optimalWidth}px`, // Dynamic width based on content
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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
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
                            const hourlyRate =
                              (bankRate / 100) * (MS_PER_HOUR / MS_PER_YEAR);
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
                        width: "100%",
                      }}
                    >
                      {/* Display logic using bankBalanceForDisplay */}
                      {bankStartTime > 0 || isMarried ? ( // Show detailed format if interest running OR married
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
                {/* Bank Annual Rate Display */}

                <div
                  style={{
                    display: "flex",
                    backgroundColor:
                      bankStartTime == 0
                        ? "rgba(137, 137, 137, 0.5)"
                        : coloring?.isDarkText
                        ? "rgba(255, 166, 0, 0.3)"
                        : "rgba(255, 166, 0, 1)",
                    color: coloring?.isDarkText ? "#000" : "#FFF",
                    borderRadius: "0 0px 10px 10px",
                    padding: "5px 15px",
                    marginTop: "-5px",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    width: `${optimalWidth}px`, // Dynamic width to match bank container
                    position: "relative", // Match bank container
                    overflow: "hidden", // Match bank container
                    boxSizing: "border-box", // Ensure padding is included in width calculation
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "100%", // Take full width of container
                      fontSize: (() => {
                        // Calculate dynamic font size based on text length for Satori
                        const timeText = prettyMilliseconds(
                          Date.now() - Number(bankStartTime),
                          {
                            colonNotation: true,
                            secondsDecimalDigits: 0,
                          }
                        );
                        const annualText = `${bankRate}% ${translations.annual} (${timeText})`;
                        const textLength = annualText.length;

                        // Scale font size based on text length (shorter text = larger font)
                        // These thresholds work well for the 150px min width
                        if (textLength <= 22) return "14px";
                        if (textLength <= 26) return "13px";
                        if (textLength <= 30) return "12px";
                        if (textLength <= 34) return "11px";
                        return "10px"; // Minimum font size for very long text
                      })(),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      justifyContent: "center", // Center the text
                      alignItems: "center", // Ensure vertical centering consistency
                      boxSizing: "border-box", // Include padding in width calculation
                    }}
                  >
                    {bankRate}
                    {"% "}
                    {translations.annual}{" "}
                    {bankStartTime > 0
                      ? prettyMilliseconds(Date.now() - Number(bankStartTime), {
                          colonNotation: true,
                          secondsDecimalDigits: 0,
                        })
                      : ""}
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
            const totalMaxHeight = 147; // Hard limit for combined height of both bars
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

            if (totalIdealHeight <= totalMaxHeight) {
              // If total fits within limit, use ideal heights
              var chattingHeight = Math.max(minBarHeight, idealChattingHeight);
              var gamingHeight = Math.max(minBarHeight, idealGamingHeight);
            } else {
              // If total exceeds limit, scale down proportionally
              const scaleFactor = totalMaxHeight / totalIdealHeight;
              var chattingHeight = Math.max(
                minBarHeight,
                idealChattingHeight * scaleFactor
              );
              var gamingHeight = Math.max(
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
                    height: `${Math.max(0, chattingHeight * chatFillRatio)}px`, // XP-based fill height
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
                    height: `${Math.max(0, gamingHeight * gameFillRatio)}px`, // XP-based fill height
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

        {/*
      <div
        style={{
          position: "absolute",
          right: "20px",
          top: "187px",
          width: "63px",
          height: "31px",
          background: coloring.overlayBackground,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "6.5px",
            top: "5.5px",
            width: "19px",
            height: "19px",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          📦
        </div>
        <div
          style={{
            fontSize: "20px",
            color: textColor,
            fontFamily: "Inter600",
            marginLeft: "20px",
            display: "flex",
          }}
        >
          {cachesCount}
        </div>
      </div> WIP*/}

        {/* Marriage Status - Bottom banner - only show when married - original positioning */}

        {/* Render banknotes above the Balance rectangle */}
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
    return isMarried ? 267 : 235;
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
};

export default Balance;
