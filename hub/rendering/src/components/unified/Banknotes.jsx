const Banknotes = ({
  amount,
  style = "banknotes",
  division = 50,
  xspacing = 15,
  className = "",
  styleOverrides = {},
}) => {
  const renderBanknotes = (amount, style, division, xspacing) => {
    const totalBanknotes = Math.ceil(amount / division);

    if (totalBanknotes <= 0) {
      return [];
    }

    const banknotes = [];

    // Base banknote dimensions - these will be dynamically adjusted
    let banknoteWidth = styleOverrides?.banknote?.width ? 
      parseInt(styleOverrides.banknote.width) : 15;
    let banknoteHeight = styleOverrides?.banknote?.height ? 
      parseInt(styleOverrides.banknote.height) : 5;
    
    const stackOffset = 4; // Vertical offset between stacked banknotes

    // For Satori rendering, we need to work with percentage-based positioning
    // since we can't get actual container dimensions
    const maxWidth = 100; // Work in percentage terms
    
    // Use xspacing directly - handle special case where xspacing is 0
    const effectiveSpacing = xspacing === 0 ? 0 : (xspacing || 15);
    
    // Convert spacing to percentage based on typical container width (300px)
    const spacingPercent = (effectiveSpacing / 300) * 100;
    
    // Calculate banknote width as percentage
    const banknoteWidthPercent = (banknoteWidth / 300) * 100;
    
    // Calculate how many banknotes can fit per row
    let banknotesPerRow;
    if (effectiveSpacing === 0) {
      // When xspacing is 0, stack banknotes with minimal gap (just banknote width)
      banknotesPerRow = Math.floor(maxWidth / banknoteWidthPercent);
    } else {
      // Normal spacing calculation
      banknotesPerRow = Math.floor(maxWidth / (banknoteWidthPercent + spacingPercent));
    }
    
    // Ensure we have at least 1 banknote per row
    banknotesPerRow = Math.max(1, banknotesPerRow);
    
    // If too many banknotes for reasonable display, scale down
    if (totalBanknotes > banknotesPerRow * 4) { // More than 4 rows worth
      // Scale down banknote size for very dense layouts
      const scaleFactor = Math.max(0.6, 1 - (totalBanknotes / 50));
      banknoteWidth = Math.max(8, banknoteWidth * scaleFactor);
      banknoteHeight = Math.max(3, banknoteHeight * scaleFactor);
      
      // Recalculate with new banknote size
      const newBanknoteWidthPercent = (banknoteWidth / 300) * 100;
      if (effectiveSpacing === 0) {
        banknotesPerRow = Math.max(1, Math.floor(maxWidth / newBanknoteWidthPercent));
      } else {
        banknotesPerRow = Math.max(1, Math.floor(maxWidth / (newBanknoteWidthPercent + spacingPercent)));
      }
    }

    for (let i = 0; i < totalBanknotes; i++) {
      // Calculate row and column for left-to-right, top-to-bottom stacking
      const row = Math.floor(i / banknotesPerRow);
      const col = i % banknotesPerRow;

      // Calculate position using percentage-based positioning
      // Start from 0 (left edge) and use xspacing for horizontal positioning
      let baseXPercent;
      if (effectiveSpacing === 0) {
        // When xspacing is 0, position banknotes directly adjacent to each other
        baseXPercent = col * banknoteWidthPercent;
      } else {
        // Normal spacing between banknotes
        baseXPercent = col * spacingPercent;
      }
      const baseY = row * stackOffset;

      // Add randomness to X coordinate for chaotic stacking effect
      // Use Math.random() with left bias for aggressive left stacking
      const randomValue = Math.random(); // Range: 0 to 1
      const leftBiasedFactor = (randomValue * 0.8) - 0.6; // Range: -0.6 to 0.2 (biased left)
      
      // Calculate random offset as percentage (increased for more aggressive stacking)
      const maxRandomOffset = 5; // Increased random offset for more chaos
      const randomOffsetPercent = leftBiasedFactor * maxRandomOffset;

      // Bounds checking - ensure banknotes don't exceed container width
      const banknoteWidthPercent = (banknoteWidth / 300) * 100;
      const maxXPercent = maxWidth - banknoteWidthPercent;
      
      // Apply randomness and ensure bounds
      const randomizedXPercent = baseXPercent + randomOffsetPercent;
      const finalXPercent = Math.max(0, Math.min(randomizedXPercent, maxXPercent));
      const finalY = baseY;

      // Calculate zIndex for proper stacking order (higher banknotes on top)
      const zIndex = i + 1;

      // Apply styling based on the style parameter
      if (style === "banknotes") {
        banknotes.push(
          <div
            key={i}
            className="banknote"
            style={{
              position: "absolute",
              left: `${finalXPercent}%`,
              bottom: `${finalY}px`,
              width: `${banknoteWidth}px`,
              height: `${banknoteHeight}px`,
              background: "#4CAF50",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: 0.4,
              zIndex: zIndex,
              ...styleOverrides.banknote,
            }}
          >
            <div
              style={{
                width: "3px",
                height: "100%",
                background: "#FF9800",
              }}
            />
          </div>
        );
      } else if (style === "bars") {
        banknotes.push(
          <div
            key={i}
            className="banknote"
            style={{
              position: "absolute",
              left: `${finalXPercent}%`,
              bottom: `${finalY}px`,
              width: `${banknoteWidth}px`,
              height: `${banknoteHeight}px`,
              background: "#DAA520",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: 0.4,
              zIndex: zIndex,
              ...styleOverrides.banknote,
            }}
          />
        );
      }
    }

    return banknotes;
  };

  return (
    <div
      className={`banknotes-container ${className}`}
      style={{
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        left: 0,
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...styleOverrides.container,
      }}
    >
      {renderBanknotes(amount, style, division, xspacing)}
    </div>
  );
};

export default Banknotes;
