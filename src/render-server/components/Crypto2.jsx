// src/render-server/components/Crypto2.jsx

// Helper function to format numbers, add later if needed
// const formatNumber = (num) => { ... };

// Helper to format Price
const formatPrice = (priceStr, decimals = 2) => {
  if (!priceStr) return "-";
  const num = parseFloat(priceStr);
  return isNaN(num)
    ? "-"
    : num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
};

// Helper to format Quantity (show more decimals)
const formatQuantity = (qtyStr) => {
  if (!qtyStr) return "-";
  const num = parseFloat(qtyStr);
  return isNaN(num)
    ? "-"
    : num.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 8,
      }); // Adjust as needed
};

const Crypto2 = (props) => {
  // Destructure props passed from generateImage
  let {
    interaction,
    i18n = {}, // Now contains resolved translations like { balanceLabel: 'Balance', ... }
    balance,
    openPositions = [
      {
        id: "cm9u2c4mc0005969yolxoumdt",
        symbol: "APTUSDT",
        direction: "SHORT",
        entryPrice: 5.2761,
        quantity: 0.94766968,
        leverage: 1,
        pnlPercent: -1.41,
        stakeValue: 5,
      },
    ], // Now contains { ..., stakeValue: '100.00' }
    viewType,
    selectedPosition,
    chartData,
    chartImageURI,
    currentInterval = "15", // Default to 15m if not provided
    marketMovers = {
      gainers: [
        { symbol: "SOLUSDT", change: 5.8 },
        { symbol: "BNBUSDT", change: 4.2 },
        { symbol: "ETHUSDT", change: 3.1 },
      ],
      losers: [
        { symbol: "DOGEUSDT", change: -7.6 },
        { symbol: "XRPUSDT", change: -4.5 },
        { symbol: "ADAUSDT", change: -3.2 },
      ],
    }, // Market movers data
    // Add other props as needed
  } = props;

  const user = interaction.user; // Convenience: user.id, user.avatarURL

  // --- Main Menu View ---
  const MainMenu = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#1a1a1a",
        color: "white",
        padding: "30px",
        fontFamily: "Inter600, sans-serif",
        fontSize: "24px",
      }}
    >
      {/* Top Section: Avatar and Balance */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <img
          src={user.avatarURL}
          alt="User Avatar"
          style={{ width: "80px", height: "80px", borderRadius: "25%" }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: "20px",
            padding: "15px 25px",
            backgroundColor: "#2c2c2c",
            borderRadius: "20px",
          }}
        >
          <span style={{ fontWeight: "600", display: "flex", display: "flex" }}>
            {i18n.balanceLabel}: {parseFloat(balance || 0).toFixed(1)} 💵
          </span>
        </div>
      </div>

      {/* Bottom Section: Open Orders and Market Movers */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          flexGrow: 1,
        }}
      >
        {/* Open Orders */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            backgroundColor: "#252525",
            borderRadius: "25px",
            padding: "25px 35px",
            width: "65%", // Adjust width to make room for market movers
          }}
        >
          <h2
            style={{
              marginTop: "0",
              display: "flex",
              marginBottom: "25px",
              fontWeight: "bold",
              fontSize: "32px",
              paddingBottom: "15px",
            }}
          >
            {i18n.openOrdersLabel}
          </h2>

          {/* Header Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#aaa",
              fontSize: "18px",
              marginBottom: "15px",
              padding: "0 5px", // Align with items below
            }}
          >
            <span>{i18n.coinLabel}</span>
            <span>{i18n.stakeLabel}</span>
          </div>

          {/* Positions List */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            {openPositions && openPositions.length > 0 ? (
              openPositions.map((pos, index) => {
                const isLong = pos.direction === "LONG";
                const pnl = parseFloat(pos.pnlPercent || 0);
                const pnlColor = pnl >= 0 ? "#33cc33" : "#ff4d4d"; // Green for profit, red for loss
                // Use the pre-calculated stakeValue passed in props
                // const stakeValue = parseFloat(pos.stakeValue || 0);

                return (
                  <div
                    key={pos.id || index} // Use position ID if available
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "15px 20px",
                      backgroundColor: isLong
                        ? "rgba(51, 204, 51, 0.1)"
                        : "rgba(255, 77, 77, 0.1)", // Lighter background
                      borderRadius: "15px",
                      border: `4px solid ${
                        isLong
                          ? "rgba(51, 204, 51, 0.3)"
                          : "rgba(255, 77, 77, 0.3)"
                      }`,
                    }}
                  >
                    {/* Coin Info */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          display: "flex",
                          marginRight: "15px",
                          fontWeight: "bold",
                          color: "#ccc",
                        }}
                      >
                        {index + 1}.
                      </span>
                      <span
                        style={{
                          display: "flex",
                          fontWeight: "bold",
                          fontSize: "28px",
                        }}
                      >
                        {pos.symbol}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          marginLeft: "10px",
                          fontSize: "28px",
                        }}
                      >
                        {isLong ? "↑" : "↓"}
                      </span>
                    </div>

                    {/* Stake & PnL Info */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end", // Align items at the bottom
                        textAlign: "right",
                      }}
                    >
                      {/* Leverage */}
                      <div
                        style={{
                          display: "flex",
                          backgroundColor: pnl >= 0 ? "#e67e22" : "#e74c3c", // Orange/Red leverage box
                          color: "white",
                          padding: "3px 8px",
                          borderRadius: "8px",
                          fontSize: "16px",
                          fontWeight: "bold",
                          marginRight: "15px",
                          bottom: "10px",
                        }}
                      >
                        {pos.leverage}X
                      </div>
                      {/* Entry Price & Stake */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          marginRight: "20px",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            fontSize: "28px",
                            fontWeight: "bold",
                          }}
                        >
                          {formatPrice(pos.entryPrice)}
                        </span>
                        <span
                          style={{
                            fontSize: "16px",
                            color: "#bbb",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {formatPrice(pos.stakeValue)} 💵
                        </span>
                      </div>

                      {/* PnL Percentage */}
                      <span
                        style={{
                          color: pnlColor,
                          fontSize: "24px",
                          fontWeight: "bold",
                          display: "flex",
                          bottom: "10px",
                        }}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(1)}%
                      </span>
                      {/* More options dots (placeholder) */}
                      {/* <span style={{ marginLeft: "10px", cursor: "pointer" }}> ⋮ </span> */}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  textAlign: "center",
                  color: "#888",
                  marginTop: "30px",
                  fontSize: "22px",
                }}
              >
                {i18n.noOpenPositions}
              </div>
            )}
          </div>
        </div>

        {/* Market Movers Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#252525",
            borderRadius: "25px",
            padding: "25px",
            width: "30%", // Set width for this section
          }}
        >
          <h2
            style={{
              display: "flex",
              marginTop: "0",
              marginBottom: "-15px",
              fontWeight: "bold",
              fontSize: "28px",
              paddingBottom: "10px",
            }}
          >
            {i18n.marketMoversLabel || "Market Movers"}
          </h2>

          {/* Top Gainers Section */}
          <div
            style={{
              marginBottom: "-15px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#33cc33", // Green for gainers
                marginBottom: "15px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {i18n.topGainersLabel || "Top Gainers"} 📈
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {(marketMovers?.gainers || []).map((coin, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(51, 204, 51, 0.1)",
                    borderRadius: "10px",
                    padding: "12px 15px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        display: "flex",
                        fontWeight: "bold",
                        fontSize: "20px",
                      }}
                    >
                      {coin.symbol}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        fontSize: "14px",
                        color: "#aaa",
                        marginTop: "4px",
                      }}
                    >
                      Vol: {formatPrice(coin.volume || 0, 0)}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "#33cc33",
                      fontWeight: "bold",
                      fontSize: "20px",
                      display: "flex",
                    }}
                  >
                    +{(coin.change || 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                color: "#ff4d4d", // Red for losers
                marginBottom: "15px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {i18n.topLosersLabel || "Top Losers"} 📉
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {(marketMovers?.losers || []).map((coin, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(255, 77, 77, 0.1)",
                    borderRadius: "10px",
                    padding: "12px 15px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        display: "flex",
                        fontWeight: "bold",
                        fontSize: "20px",
                      }}
                    >
                      {coin.symbol}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        fontSize: "14px",
                        color: "#aaa",
                        marginTop: "4px",
                      }}
                    >
                      Vol: {formatPrice(coin.volume || 0, 0)}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "#ff4d4d",
                      fontWeight: "bold",
                      fontSize: "20px",
                      display: "flex",
                    }}
                  >
                    {(coin.change || 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // --- Chart View ---
  const ChartView = () => {
    if (!selectedPosition) {
      return (
        <div
          style={{
            display: "flex",
            padding: "20px",
            color: "red",
            display: "flex",
          }}
        >
          Error: Position data missing.
        </div>
      ); // Handle error case
    }

    // Debug log for currentInterval
    console.log(
      `[Crypto2.jsx] Rendering chart with interval: "${currentInterval}"`
    );

    const {
      symbol,
      direction,
      entryPrice,
      quantity,
      leverage,
      takeProfitPrice,
      stopLossPrice,
      currentPrice,
      pnlPercent,
      pnlAmount,
    } = selectedPosition;

    const isLong = direction === "LONG";
    const pnlNum = parseFloat(pnlPercent || 0);
    const pnlAmountNum = parseFloat(pnlAmount || 0);
    const pnlColor = pnlNum >= 0 ? "#33cc33" : "#ff4d4d";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#0d1117", // Darker background for chart view
          color: "white",
          fontFamily: "Inter600, sans-serif",
        }}
      >
        {/* Header: Symbol & Timeframes */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 20px", // Reduced padding
          }}
        >
          <h2
            style={{
              display: "flex",
              margin: 0,
              fontSize: "28px", // Reduced font size
              fontWeight: "bold",
            }}
          >
            {symbol} {i18n?.chartTitleSuffix || "Chart"}
          </h2>
          {/* Placeholder for timeframe selector */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              color: "#8b949e",
              fontSize: "14px", // Reduced font size
            }}
          ></div>
        </div>

        {/* Main Content: Chart & Position Details - Now stacked vertically */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
          {/* Chart Area - Now at the top */}
          <div
            style={{
              flexGrow: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "5px", // Reduced padding
              backgroundColor: "#161b22", // Match chart bg
              borderBottom: "1px solid #30363d",
            }}
          >
            {chartImageURI ? (
              <img
                src={chartImageURI}
                alt={`${symbol} Chart`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  color: "#8b949e",
                  textAlign: "center",
                  display: "flex",
                }}
              >
                Chart Loading...
              </div>
            )}
          </div>

          {/* Position Details Area - Now at the bottom with compact layout */}
          <div
            style={{
              width: "100%",
              padding: "10px", // Reduced padding
              display: "flex",
              flexDirection: "row", // Use row to distribute details horizontally
              flexWrap: "wrap", // Allow wrapping on smaller screens
              gap: "10px", // Reduced gap
              backgroundColor: "#0d1117",
            }}
          >
            {/* Left column */}
            <div
              style={{
                flex: "1",
                minWidth: "300px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px 0", // Reduced margin
                  fontSize: "18px", // Reduced font size
                  fontWeight: "bold",
                  borderBottom: "1px solid #30363d",
                  paddingBottom: "8px", // Reduced padding
                }}
              >
                {i18n?.detailsLabel || "Position Details"}
              </h3>

              {/* Leverage & Direction */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isLong
                    ? "rgba(14, 203, 129, 0.15)"
                    : "rgba(246, 70, 93, 0.15)",
                  padding: "6px 10px", // Reduced padding
                  borderRadius: "8px",
                  marginBottom: "10px", // Reduced margin
                }}
              >
                <span
                  style={{
                    fontSize: "16px", // Reduced font size
                    fontWeight: "bold",
                    color: isLong ? "#0ecb81" : "#f6465d",
                  }}
                >
                  {isLong ? "LONG" : "SHORT"}
                </span>
                <span
                  style={{
                    fontSize: "14px", // Reduced font size
                    background: "#474d57",
                    padding: "2px 5px", // Reduced padding
                    borderRadius: "5px",
                  }}
                >
                  {leverage}X {i18n?.leverageLabel || "Leverage"}
                </span>
              </div>

              {/* PnL */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "10px", // Reduced margin
                }}
              >
                <span style={{ color: "#8b949e", fontSize: "14px" }}>
                  {" "}
                  {/* Reduced font size */}
                  {i18n?.pnlLabel || "PnL"}
                </span>
                <div
                  style={{
                    textAlign: "right",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <span
                    style={{
                      color: pnlColor,
                      fontSize: "18px", // Reduced font size
                      fontWeight: "bold",
                    }}
                  >
                    {pnlAmountNum.toFixed(2)} 💲
                  </span>
                  <span
                    style={{
                      color: pnlColor,
                      fontSize: "14px", // Reduced font size
                      marginLeft: "5px",
                    }}
                  >
                    ({pnlNum >= 0 ? "+" : ""}
                    {pnlNum.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div
              style={{
                flex: "1",
                minWidth: "300px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Entry & Current Price */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px", // Reduced margin
                }}
              >
                <span style={{ color: "#8b949e", fontSize: "14px" }}>
                  {" "}
                  {/* Reduced font size */}
                  {i18n?.entryPriceLabel || "Entry"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "500" }}>
                  {" "}
                  {/* Reduced font size */}
                  {formatPrice(entryPrice, 4)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px", // Reduced margin
                }}
              >
                <span style={{ color: "#8b949e", fontSize: "14px" }}>
                  {" "}
                  {/* Reduced font size */}
                  {i18n?.currentPriceLabel || "Current"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "500" }}>
                  {" "}
                  {/* Reduced font size */}
                  {formatPrice(currentPrice, 4)}
                </span>
              </div>

              {/* Quantity */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px", // Reduced margin
                }}
              >
                <span style={{ color: "#8b949e", fontSize: "14px" }}>
                  {" "}
                  {/* Reduced font size */}
                  {i18n?.quantityLabel || "Quantity"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "500" }}>
                  {" "}
                  {/* Reduced font size */}
                  {formatQuantity(quantity)} {symbol.replace("USDT", "")}
                </span>
              </div>

              {/* TP / SL */}
              <div
                style={{
                  borderTop: "1px solid #30363d",
                  paddingTop: "8px", // Reduced padding
                  marginTop: "5px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px", // Reduced margin
                  }}
                >
                  <span style={{ color: "#8b949e", fontSize: "14px" }}>
                    {" "}
                    {/* Reduced font size */}
                    {i18n?.takeProfitLabel || "Take Profit"}
                  </span>
                  <span
                    style={{
                      fontSize: "14px", // Reduced font size
                      fontWeight: "500",
                      color: takeProfitPrice ? "#c9d1d9" : "#8b949e",
                    }}
                  >
                    {takeProfitPrice
                      ? formatPrice(takeProfitPrice, 4)
                      : i18n?.notSetLabel || "Not Set"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "#8b949e", fontSize: "14px" }}>
                    {" "}
                    {/* Reduced font size */}
                    {i18n?.stopLossLabel || "Stop Loss"}
                  </span>
                  <span
                    style={{
                      fontSize: "14px", // Reduced font size
                      fontWeight: "500",
                      color: stopLossPrice ? "#c9d1d9" : "#8b949e",
                    }}
                  >
                    {stopLossPrice
                      ? formatPrice(stopLossPrice, 4)
                      : i18n?.notSetLabel || "Not Set"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Render based on viewType ---
  switch (viewType) {
    case "chart_view":
      return <ChartView />;
    case "coin_preview":
      return <CoinPreview {...props} />;
    case "main_menu":
    default:
      return <MainMenu />;
  }
};

// --- Coin Preview View ---
const CoinPreview = (props) => {
  const {
    symbol,
    currentPrice,
    price24hChange,
    volume24h,
    chartImageURI,
    currentInterval,
    balance,
    i18n = {},
  } = props;

  if (!symbol) {
    return (
      <div
        style={{
          padding: "20px",
          color: "red",
        }}
      >
        Error: Symbol data missing.
      </div>
    );
  }

  // Chart layout is similar to the position chart view, but with different data display
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117", // Darker background for chart view
        color: "white",
        fontFamily: "Inter600, sans-serif",
      }}
    >
      {/* Header: Symbol & Timeframes */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px", // Reduced padding
        }}
      >
        <h2
          style={{
            display: "flex",
            margin: 0,
            fontSize: "28px", // Reduced font size
            fontWeight: "bold",
          }}
        >
          {symbol} {i18n?.chartTitleSuffix || "Chart"}
        </h2>

        {/* User Balance */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 12px", // Reduced padding
            backgroundColor: "#1e2329",
            borderRadius: "10px",
          }}
        >
          <span style={{ fontWeight: "600", fontSize: "14px" }}>
            {" "}
            {/* Reduced font size */}
            {i18n.balanceLabel}: {parseFloat(balance || 0).toFixed(2)} 💵
          </span>
        </div>
      </div>

      {/* Main Content: Chart & Price Details */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        {/* Chart Area */}
        <div
          style={{
            flexGrow: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "5px", // Reduced padding
            backgroundColor: "#161b22", // Match chart bg
            borderBottom: "1px solid #30363d",
          }}
        >
          {chartImageURI ? (
            <img
              src={chartImageURI}
              alt={`${symbol} Chart`}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                color: "#8b949e",
                textAlign: "center",
                display: "flex",
              }}
            >
              Chart Loading...
            </div>
          )}
        </div>

        {/* Price Details Area */}
        <div
          style={{
            padding: "10px", // Reduced padding
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "10px", // Reduced gap
            backgroundColor: "#0d1117",
          }}
        >
          {/* Price Information */}
          <div
            style={{
              flex: "1",
              minWidth: "300px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#161b22",
              padding: "15px", // Reduced padding
              borderRadius: "10px",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0", // Reduced margin
                fontSize: "18px", // Reduced font size
                fontWeight: "bold",
                borderBottom: "1px solid #30363d",
                paddingBottom: "8px", // Reduced padding
              }}
            >
              {symbol.replace("USDT", "")}{" "}
              {i18n?.priceInfoLabel || "Price Information"}
            </h3>

            {/* Current Price */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px", // Reduced margin
              }}
            >
              <span style={{ color: "#8b949e", fontSize: "14px" }}>
                {" "}
                {/* Reduced font size */}
                {i18n?.currentPriceLabel || "Current Price"}
              </span>
              <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                {" "}
                {/* Reduced font size */}
                {formatPrice(currentPrice, 4)} USDT
              </span>
            </div>

            {/* 24h Change */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px", // Reduced margin
              }}
            >
              <span style={{ color: "#8b949e", fontSize: "14px" }}>
                {" "}
                {/* Reduced font size */}
                {i18n?.price24hChangeLabel || "24h Change"}
              </span>
              <span
                style={{
                  fontSize: "16px", // Reduced font size
                  fontWeight: "bold",
                  color:
                    parseFloat(price24hChange) >= 0 ? "#0ecb81" : "#f6465d",
                }}
              >
                {parseFloat(price24hChange) >= 0 ? "+" : ""}
                {price24hChange}%
              </span>
            </div>

            {/* 24h Volume */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#8b949e", fontSize: "14px" }}>
                {" "}
                {/* Reduced font size */}
                {i18n?.volumeLabel || "24h Volume"}
              </span>
              <span style={{ fontSize: "14px" }}>
                {" "}
                {/* Reduced font size */}
                {formatQuantity(volume24h)} USDT
              </span>
            </div>
          </div>

          {/* Call to Action Card */}
          <div
            style={{
              flex: "1",
              minWidth: "300px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#161b22",
              padding: "15px", // Reduced padding
              borderRadius: "10px",
              justifyContent: "center", // Center content vertically
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0", // Reduced margin
                fontSize: "18px", // Reduced font size
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {i18n?.readyToTradeLabel || "Ready to trade?"}
            </h3>

            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                gap: "12px", // Reduced gap
                margin: "8px 0", // Reduced margin
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  backgroundColor: "rgba(14, 203, 129, 0.15)",
                  padding: "12px", // Reduced padding
                  borderRadius: "10px",
                  flex: 1,
                }}
              >
                <span
                  style={{
                    color: "#0ecb81",
                    fontWeight: "bold",
                    fontSize: "20px", // Reduced font size
                    marginBottom: "4px", // Reduced margin
                  }}
                >
                  LONG
                </span>
                <span style={{ color: "#8b949e", fontSize: "12px" }}>
                  {" "}
                  {/* Reduced font size */}
                  {i18n?.longExplanation || "Buy if you expect price to rise"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  backgroundColor: "rgba(246, 70, 93, 0.15)",
                  padding: "12px", // Reduced padding
                  borderRadius: "10px",
                  flex: 1,
                }}
              >
                <span
                  style={{
                    color: "#f6465d",
                    fontWeight: "bold",
                    fontSize: "20px", // Reduced font size
                    marginBottom: "4px", // Reduced margin
                  }}
                >
                  SHORT
                </span>
                <span style={{ color: "#8b949e", fontSize: "12px" }}>
                  {" "}
                  {/* Reduced font size */}
                  {i18n?.shortExplanation || "Sell if you expect price to fall"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Crypto2.dimensions = {
  width: 1024,
  height: 900,
};

export default Crypto2;
