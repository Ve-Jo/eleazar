import { createCanvas } from "@napi-rs/canvas";

// Configure the canvas size and type
const width = 750; // Chart width
const defaultHeight = 450; // Default chart height

/**
 * Generates a candlestick chart image as a data URL
 * @param {Array} klineData - Array of candlestick data [timestamp, open, high, low, close]
 * @param {string} symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param {Object} options - Additional options
 * @param {number} options.takeProfitPrice - Take profit price level to show on chart
 * @param {number} options.stopLossPrice - Stop loss price level to show on chart
 * @param {number} options.entryPrice - Entry price level to show on chart
 * @param {string} options.direction - Position direction (LONG or SHORT)
 * @returns {Promise<string|null>} - Data URL of the chart image or null if generation fails
 */
export async function generateCandlestickChart(
  klineData,
  symbol = "Price",
  options = {}
) {
  console.log(
    `[chartGenerator] Attempting to generate chart for ${symbol}. Incoming kline data length: ${klineData?.length}`
  );

  if (!klineData || klineData.length === 0) {
    console.warn(
      `[chartGenerator] No kline data provided or data is empty for ${symbol}. Returning null.`
    );
    return null;
  }

  try {
    // Determine the appropriate chart height
    // Use taller chart for position charts (with entry/TP/SL lines)
    const isPositionChart = options.entryPrice !== undefined;
    const chartHeight = isPositionChart ? 500 : defaultHeight;

    // Create canvas
    const canvas = createCanvas(width, chartHeight);
    const ctx = canvas.getContext("2d");

    // Fill background
    ctx.fillStyle = "#161b22";
    ctx.fillRect(0, 0, width, chartHeight);

    // Find price range
    const allPrices = klineData.flatMap((k) => [k[1], k[2], k[3], k[4]]); // All prices (open, high, low, close)

    // Add TP/SL prices to the range calculation if they exist
    if (options.takeProfitPrice)
      allPrices.push(parseFloat(options.takeProfitPrice));
    if (options.stopLossPrice)
      allPrices.push(parseFloat(options.stopLossPrice));
    if (options.entryPrice) allPrices.push(parseFloat(options.entryPrice));

    const maxPrice = Math.max(...allPrices);
    const minPrice = Math.min(...allPrices);
    let priceRange = maxPrice - minPrice;

    // Add some padding to price range
    const pricePadding = priceRange * 0.1;
    const effectiveMaxPrice = maxPrice + pricePadding;
    const effectiveMinPrice = Math.max(0, minPrice - pricePadding);
    priceRange = effectiveMaxPrice - effectiveMinPrice;

    // Calculate dimensions
    const chartPaddingTop = 50;
    const chartPaddingBottom = 30;
    const chartPaddingLeft = 70;
    const chartPaddingRight = 70;
    const chartWidth = width - chartPaddingLeft - chartPaddingRight;
    const chartAreaHeight = chartHeight - chartPaddingTop - chartPaddingBottom;

    // Add grid lines
    ctx.strokeStyle = "rgba(48, 54, 61, 0.5)";
    ctx.lineWidth = 1;

    // Horizontal grid lines (price levels)
    const numPriceLines = 5;
    for (let i = 0; i <= numPriceLines; i++) {
      const y = chartPaddingTop + (chartAreaHeight * i) / numPriceLines;
      ctx.beginPath();
      ctx.moveTo(chartPaddingLeft, y);
      ctx.lineTo(width - chartPaddingRight, y);
      ctx.stroke();

      // Add price labels
      const price = effectiveMaxPrice - (i / numPriceLines) * priceRange;
      ctx.fillStyle = "#8b949e";
      ctx.font = "12px Arial";
      ctx.textAlign = "right";
      ctx.fillText(price.toFixed(2), chartPaddingLeft - 10, y + 4);
    }

    // Vertical grid lines (time)
    const numTimeLines = Math.min(klineData.length, 8);
    for (let i = 0; i <= numTimeLines; i++) {
      const x = chartPaddingLeft + (chartWidth * i) / numTimeLines;
      ctx.beginPath();
      ctx.moveTo(x, chartPaddingTop);
      ctx.lineTo(x, chartHeight - chartPaddingBottom);
      ctx.stroke();

      // Add time labels if we have data
      if (klineData.length > 0 && i < numTimeLines) {
        const dataIndex = Math.floor(
          (i / numTimeLines) * (klineData.length - 1)
        );
        const timestamp = klineData[dataIndex][0];
        const date = new Date(timestamp);
        ctx.fillStyle = "#8b949e";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";

        // Format time
        let timeStr;
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          // MM/DD format for older dates
          timeStr = `${date.getMonth() + 1}/${date.getDate()}`;
        } else {
          // HH:MM format for recent dates
          timeStr = `${date.getHours().toString().padStart(2, "0")}:${date
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;
        }

        ctx.fillText(timeStr, x, chartHeight - chartPaddingBottom + 15);
      }
    }

    // Helper function to calculate Y position for a price
    const getY = (price) => {
      return (
        chartPaddingTop +
        chartAreaHeight -
        ((price - effectiveMinPrice) / priceRange) * chartAreaHeight
      );
    };

    // Draw Entry Price line if provided
    if (options.entryPrice) {
      const entryPrice = parseFloat(options.entryPrice);
      const entryY = getY(entryPrice);

      // Draw Entry line
      ctx.strokeStyle = "#ffffff"; // White for entry line
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]); // Different dash pattern

      ctx.beginPath();
      ctx.moveTo(chartPaddingLeft, entryY);
      ctx.lineTo(width - chartPaddingRight, entryY);
      ctx.stroke();

      // Draw Entry label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "right";
      ctx.setLineDash([]); // Reset line style
      ctx.fillText(
        "Entry: " + entryPrice.toFixed(2),
        width - chartPaddingRight - 5,
        entryY - 5
      );
    }

    // Draw Take Profit and Stop Loss lines if provided
    if (options.takeProfitPrice) {
      const tpPrice = parseFloat(options.takeProfitPrice);
      const tpY = getY(tpPrice);

      // Draw TP line
      ctx.strokeStyle = "#33cc33"; // Green for TP
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]); // Dashed line

      ctx.beginPath();
      ctx.moveTo(chartPaddingLeft, tpY);
      ctx.lineTo(width - chartPaddingRight, tpY);
      ctx.stroke();

      // Draw TP label
      ctx.fillStyle = "#33cc33";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.setLineDash([]); // Reset line style
      ctx.fillText("TP: " + tpPrice.toFixed(2), chartPaddingLeft + 5, tpY - 5);
    }

    if (options.stopLossPrice) {
      const slPrice = parseFloat(options.stopLossPrice);
      const slY = getY(slPrice);

      // Draw SL line
      ctx.strokeStyle = "#ff4d4d"; // Red for SL
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]); // Dashed line

      ctx.beginPath();
      ctx.moveTo(chartPaddingLeft, slY);
      ctx.lineTo(width - chartPaddingRight, slY);
      ctx.stroke();

      // Draw SL label
      ctx.fillStyle = "#ff4d4d";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.setLineDash([]); // Reset line style
      ctx.fillText("SL: " + slPrice.toFixed(2), chartPaddingLeft + 5, slY - 5);
    }

    // Reset line style
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // Draw candlesticks
    const candleWidth = Math.min((chartWidth / klineData.length) * 0.8, 15);

    klineData.forEach((k, i) => {
      const [timestamp, open, high, low, close] = k;

      // Calculate x position (center of candle)
      const x = chartPaddingLeft + (i + 0.5) * (chartWidth / klineData.length);

      const openY = getY(open);
      const highY = getY(high);
      const lowY = getY(low);
      const closeY = getY(close);

      // Determine if candle is bullish (green) or bearish (red)
      const isBullish = close >= open;
      ctx.fillStyle = isBullish
        ? "rgba(14, 203, 129, 0.9)"
        : "rgba(246, 70, 93, 0.9)"; // Green for bullish, red for bearish
      ctx.strokeStyle = isBullish
        ? "rgba(14, 203, 129, 1)"
        : "rgba(246, 70, 93, 1)";

      // Draw the candle wick (high to low)
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw the candle body (open to close)
      const bodyTop = isBullish ? closeY : openY;
      const bodyBottom = isBullish ? openY : closeY;
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1); // Ensure height is at least 1px

      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Add title and price info
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${symbol} Price Chart`, 20, 30);

    const lastPrice = klineData[klineData.length - 1][4].toFixed(2);
    ctx.fillStyle = "#0ecb81";
    ctx.textAlign = "right";
    ctx.fillText(`Last: ${lastPrice}`, width - 20, 30);

    // Show position direction
    /*if (options.direction) {
      ctx.fillStyle = options.direction === "LONG" ? "#33cc33" : "#ff4d4d";
      ctx.textAlign = "left";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`${options.direction}`, 145, 30);
    }*/

    // Convert to data URL
    const dataUrl = canvas.toDataURL();
    console.log(`[chartGenerator] Generated candlestick chart for ${symbol}.`);
    return dataUrl;
  } catch (error) {
    console.error(
      `[chartGenerator] Error rendering chart for ${symbol}:`,
      error.message
    );
    console.error("[chartGenerator] Error stack:", error.stack);
    return null;
  }
}
