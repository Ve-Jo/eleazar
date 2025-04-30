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
        pnlAmount: -0.07, // Added pnlAmount property
      },
    ], // Now contains { ..., stakeValue: '100.00' }
    viewType,
    selectedPositionId, // Add this prop to know which position is selected
    chartData,
    chartImageURI,
    currentInterval = "15", // Default to 15m if not provided
    // Remove marketMovers prop
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
                const pnlAmount = parseFloat(pos.pnlAmount || 0);
                const pnlColor = pnl >= 0 ? "#33cc33" : "#ff4d4d"; // Green for profit, red for loss
                const isSelected = pos.id === selectedPositionId;

                // Define styles based on selection state
                const positionCardStyle = {
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: isLong
                    ? "rgba(51, 204, 51, 0.1)"
                    : "rgba(255, 77, 77, 0.1)", // Lighter background
                  borderRadius: "15px",
                  border: `${isSelected ? 6 : 4}px solid ${
                    isLong
                      ? isSelected
                        ? "rgba(51, 204, 51, 0.9)"
                        : "rgba(51, 204, 51, 0.3)"
                      : isSelected
                      ? "rgba(255, 77, 77, 0.9)"
                      : "rgba(255, 77, 77, 0.3)"
                  }`,
                  opacity: selectedPositionId && !isSelected ? 0.65 : 1,
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                  boxShadow: isSelected
                    ? `0 0 20px 5px ${
                        isLong
                          ? "rgba(51, 204, 51, 0.3)"
                          : "rgba(255, 77, 77, 0.3)"
                      }`
                    : "none",
                  transition: "all 0.2s ease",
                };

                return (
                  <div
                    key={pos.id || index} // Use position ID if available
                    style={positionCardStyle}
                  >
                    {/* Position Info (first row) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center", // Align items vertically in the row
                        justifyContent: "space-between",
                        padding: "15px 20px",
                      }}
                    >
                      {/* Left Side: Coin Info + Stake/Qty */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {/* Top Row: Coin Symbol and Direction */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "5px",
                          }}
                        >
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
                        {/* Bottom Row: Stake and Quantity */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            paddingLeft: "35px" /* Indent slightly */,
                          }}
                        >
                          {/* Stake Value */}
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
                          {/* Quantity */}
                          <span
                            style={{
                              fontSize: "14px", // Slightly smaller font for quantity
                              color: "#999",
                              display: "flex",
                              alignItems: "center",
                              marginTop: "2px", // Small gap
                            }}
                          >
                            {formatQuantity(pos.quantity)}{" "}
                            {pos.symbol.replace("USDT", "")}
                          </span>
                        </div>
                      </div>

                      {/* Right Side: Leverage, Entry/Current, PnL */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end", // Align items at the bottom of the right side
                          textAlign: "right",
                        }}
                      >
                        {/* Leverage */}
                        <div
                          style={{
                            display: "flex",
                            backgroundColor: "#e74c3c",
                            color: "white",
                            padding: "3px 8px",
                            borderRadius: "8px",
                            fontSize: "16px",
                            fontWeight: "bold",
                            marginRight: "15px",
                            marginBottom: "10px",
                            // Align self lower if needed: alignSelf: 'center' or adjust margins
                          }}
                        >
                          {pos.leverage}X
                        </div>

                        {/* Entry Price & Current Price */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            marginRight: "20px",
                          }}
                        >
                          {/* Entry Price */}
                          <span
                            style={{
                              display: "flex",
                              fontSize: "28px",
                              fontWeight: "bold",
                            }}
                          >
                            {formatPrice(pos.entryPrice)}
                          </span>
                          {/* Current Price (Placeholder) */}
                          <span
                            style={{
                              fontSize: "14px", // Match quantity font size
                              color: "#aaa",
                              display: "flex",
                              alignItems: "center",
                              marginTop: "2px", // Small gap
                            }}
                          >
                            {/* TODO: Pass currentPrice in props */}
                            {formatPrice(pos.currentPrice || "N/A")}
                          </span>
                        </div>

                        {/* PnL Amount and Percentage */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                          }}
                        >
                          {/* PnL Amount */}
                          <span
                            style={{
                              color: pnlColor,
                              fontSize: "20px",
                              fontWeight: "bold",
                              display: "flex",
                            }}
                          >
                            {pnlAmount >= 0 ? "+" : ""}
                            {formatPrice(pnlAmount)} 💵
                          </span>

                          {/* PnL Percentage */}
                          <span
                            style={{
                              color: pnlColor,
                              fontSize: "24px",
                              fontWeight: "bold",
                              display: "flex",
                            }}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {pnl.toFixed(1)}%
                          </span>
                        </div>
                      </div>
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
      </div>
    </div>
  );

  // --- Render based on viewType ---
  switch (viewType) {
    case "main_menu":
    default:
      return <MainMenu />;
  }
};

Crypto2.dimensions = {
  width: 1024,
  height: 900,
};

export default Crypto2;
