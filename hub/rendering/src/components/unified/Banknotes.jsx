import React from 'react';

const Banknotes = ({
  amount,
  style = "banknotes",
  division = 50,
  xspacing = 15,
  className = "",
  styleOverrides = {},
}) => {
  const parsePx = (value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value);
    return undefined;
  };

  const renderBanknotes = (amount, style, division, xspacing) => {
    const totalBanknotes = Math.ceil(amount / division);

    if (totalBanknotes <= 0) {
      return [];
    }

    const banknotes = [];
    const placedItems = [];

    // Получаем точные размеры (дефолт 12x4, как у тебя в конфиге)
    const banknoteWidth = styleOverrides?.banknote?.width ? parseInt(styleOverrides.banknote.width) : 12;
    const banknoteHeight = styleOverrides?.banknote?.height ? parseInt(styleOverrides.banknote.height) : 4;

    const REF_WIDTH = 260; 
    const banknoteWidthPercent = (banknoteWidth / REF_WIDTH) * 100;
    
    const effectiveSpacing = xspacing || 24;
    const itemTotalWidthPx = banknoteWidth + effectiveSpacing;
    
    // Считаем сетку
    let baseCols = Math.floor(REF_WIDTH / itemTotalWidthPx);
    baseCols = Math.max(2, baseCols); 

    const maxLeftPercent = 100 - banknoteWidthPercent;
    const stepXPercent = maxLeftPercent / (baseCols - 1);

    const containerHeight =
      parsePx(styleOverrides?.container?.height) ??
      parsePx(styleOverrides?.container?.maxHeight) ??
      parsePx(styleOverrides?.container?.minHeight);
    const maxVisibleHeight = containerHeight ?? 260; // default matches REF_WIDTH baseline

    // ВАЖНО: Делаем шаг строго равным высоте элемента. 
    // Коэффициент 0.35 создает компактную естественную кладку без излишнего подъема
    const stackOffsetPx = banknoteHeight * 0.50; 

    let itemsLeft = totalBanknotes;
    let rowIndex = 0;
    let zIndexCounter = 1;

    while (itemsLeft > 0) {
      const isOddRow = rowIndex % 2 !== 0;
      const slotsInRow = isOddRow ? baseCols - 1 : baseCols;
      
      const itemsToRender = Math.min(itemsLeft, slotsInRow);
      const emptySlots = slotsInRow - itemsToRender;
      const startingSlotOffset = Math.floor(emptySlots / 2);

      for (let i = 0; i < itemsToRender; i++) {
        const slotIndex = i + startingSlotOffset;
        
        let baseXPercent = slotIndex * stepXPercent;
        
        // Сдвиг в шахматном порядке для нечетных рядов
        if (isOddRow) {
          baseXPercent += (stepXPercent / 2);
        }

        // Adjust Y position for staggered layout - odd rows sit slightly lower
        const yOffset = isOddRow ? stackOffsetPx * -1 : 0;
        const finalYPx = (rowIndex * stackOffsetPx) + yOffset;
        
        // Add small random X offset for natural variation (±2px)
        const randomXOffset = (Math.random() - 0.5) * 5;
        const finalXPercent = Math.max(0, Math.min(baseXPercent + (randomXOffset / REF_WIDTH * 100), maxLeftPercent)); 

        // Skip rendering items that would be fully outside visible height
        if (finalYPx + banknoteHeight < 0 || finalYPx > maxVisibleHeight) {
          continue;
        }

        // Skip rendering items that would truly overlap (both axes); allow vertical stacking rows
        const finalXPx = (finalXPercent / 100) * REF_WIDTH;
        const isOverlapping = placedItems.some(({ x, y }) => {
          const horizontallyOverlaps = Math.abs(x - finalXPx) < banknoteWidth;
          const verticallyOverlaps = Math.abs(y - finalYPx) < banknoteHeight;
          return horizontallyOverlaps && verticallyOverlaps;
        });

        if (isOverlapping) {
          continue;
        }

        const commonStyle = {
          position: "absolute",
          left: `${finalXPercent}%`,
          bottom: `${finalYPx}px`,
          width: `${banknoteWidth}px`,
          height: `${banknoteHeight}px`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: zIndexCounter,
          ...styleOverrides.banknote,
        };

        if (style === "banknotes") {
          banknotes.push(
            <div
              key={`${rowIndex}-${i}`}
              className="banknote"
              style={{
                ...commonStyle,
                background: "#4CAF50",
                opacity: 0.7,
              }}
            >
              <div style={{ width: "3px", height: "100%", background: "#FF9800" }} />
            </div>
          );
        } else if (style === "bars") {
          banknotes.push(
            <div
              key={`${rowIndex}-${i}`}
              className="banknote"
              style={{
                ...commonStyle,
                background: "#DAA520",
                opacity: 0.7,
              }}
            />
          );
        }
        zIndexCounter++;
        placedItems.push({ x: finalXPx, y: finalYPx });
      }
      
      itemsLeft -= itemsToRender;
      rowIndex++;

      if ((rowIndex * stackOffsetPx) - stackOffsetPx > maxVisibleHeight) {
        break;
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
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden", // Чтобы стопки не вываливались за границы
        ...styleOverrides.container,
      }}
    >
      {renderBanknotes(amount, style, division, xspacing)}
    </div>
  );
};

export default Banknotes;