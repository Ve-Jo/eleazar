import InfoRectangle from "./InfoRectangle.jsx";

const DEFAULT_COLORING = {
  textColor: "#f8fbff",
  secondaryTextColor: "rgba(248,251,255,0.78)",
  tertiaryTextColor: "rgba(248,251,255,0.58)",
  overlayBackground: "rgba(255,255,255,0.08)",
  accentColor: "#ffb648",
  dominantColor: "#42c1ff",
};

function getDecimalSeparatorIndex(rawValue) {
  const text = String(rawValue || "");
  const dotIndex = text.lastIndexOf(".");
  const commaIndex = text.lastIndexOf(",");
  return Math.max(dotIndex, commaIndex);
}

function renderFeaturedValue(rawValue, colors, compact, tone) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return rawValue;
  }

  const text = String(rawValue);
  const separatorIndex = getDecimalSeparatorIndex(text);

  if (separatorIndex <= 0 || separatorIndex === text.length - 1) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "2px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: compact ? "29px" : "40px",
            fontWeight: 800,
            lineHeight: 0.94,
            color: tone,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {text}
        </span>
      </div>
    );
  }

  const mainValue = text.slice(0, separatorIndex);
  const separator = text.charAt(separatorIndex);
  const fraction = text.slice(separatorIndex + 1);
  const fractionLead = fraction.slice(0, 2);
  const fractionTail = fraction.slice(2);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          fontSize: compact ? "29px" : "40px",
          fontWeight: 800,
          lineHeight: 0.94,
          color: tone,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {mainValue}
      </span>
      <span
        style={{
          display: "flex",
          fontSize: compact ? "22px" : "28px",
          fontWeight: 800,
          lineHeight: 1,
          color: tone,
          paddingBottom: compact ? "2px" : "4px",
        }}
      >
        {separator}
      </span>
      <span
        style={{
          display: "flex",
          fontSize: compact ? "18px" : "22px",
          fontWeight: 700,
          lineHeight: 1,
          color: tone,
          opacity: 0.92,
          paddingBottom: compact ? "4px" : "7px",
        }}
      >
        {fractionLead || fraction}
      </span>
      {fractionTail ? (
        <span
          style={{
            display: "flex",
            fontSize: compact ? "12px" : "15px",
            fontWeight: 700,
            lineHeight: 1,
            color: tone,
            opacity: 0.74,
            paddingBottom: compact ? "4px" : "8px",
            marginLeft: "1px",
          }}
        >
          {fractionTail}
        </span>
      ) : null}
    </div>
  );
}

function renderValueNode(item, colors, valueSize, options = {}) {
  if (!item) {
    return null;
  }

  const tone = item.valueTone || colors.textColor;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          minWidth: 0,
        }}
      >
        {options.featured
          ? renderFeaturedValue(item.value, colors, options.compact, tone)
          : (
            <div
              style={{
                display: "flex",
                fontSize: valueSize,
                fontWeight: 800,
                color: tone,
                lineHeight: 1.02,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.value}
            </div>
          )}
      </div>
      {item.caption ? (
        <div
          style={{
            display: "flex",
            fontSize: options.captionSize || "11px",
            color: colors.tertiaryTextColor,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.caption}
        </div>
      ) : null}
    </div>
  );
}

function renderInfoCard(item, colors, options = {}) {
  if (!item) {
    return null;
  }

  const isLarge = Boolean(options.isLarge || item.isLarge);
  const minHeight = options.minHeight || (isLarge ? "88px" : "72px");
  const valueSize = options.valueSize || (isLarge ? "20px" : "16px");

  return (
    <InfoRectangle
      key={item.key || item.label || String(item.value)}
      icon={item.icon || null}
      background={item.background || colors.overlayBackground}
      borderRadius={options.borderRadius || "18px"}
      padding={options.padding || (isLarge ? "12px 14px" : "10px 12px")}
      minWidth="0px"
      maxWidth="100%"
      iconSize={options.iconSize || (isLarge ? "16px" : "14px")}
      iconMarginRight={options.iconMarginRight || "8px"}
      title={item.label}
      titleStyle={{
        fontSize: options.titleSize || (isLarge ? "10px" : "11px"),
        color: colors.tertiaryTextColor,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
      value={renderValueNode(item, colors, valueSize, {
        featured: Boolean(options.featuredValue),
        compact: Boolean(options.compact),
        captionSize: options.captionSize,
      })}
      style={{
        flex: options.flex || "1 1 0",
        alignSelf: "stretch",
        minHeight,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 16px 30px rgba(0, 0, 0, 0.12)",
        ...(options.style || {}),
      }}
    />
  );
}

function renderSupportingPill(item, colors, compact, index) {
  if (!item) {
    return null;
  }

  return (
    <div
      key={item.key || `${item.label}-${item.value || index}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: compact ? "6px 8px" : "7px 10px",
        borderRadius: "999px",
        backgroundColor: item.background || "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: item.tone || colors.secondaryTextColor,
        minHeight: compact ? "28px" : "32px",
        boxSizing: "border-box",
      }}
    >
      {item.icon ? (
        <div style={{ display: "flex", fontSize: compact ? "12px" : "13px" }}>{item.icon}</div>
      ) : null}
      <div style={{ display: "flex", fontSize: compact ? "10px" : "11px", color: colors.tertiaryTextColor }}>
        {item.label}
      </div>
      {item.value ? (
        <div
          style={{
            display: "flex",
            fontSize: compact ? "11px" : "12px",
            fontWeight: 700,
            color: item.valueTone || colors.textColor,
          }}
        >
          {item.value}
        </div>
      ) : null}
    </div>
  );
}

function renderSummaryCard(item, colors, compact) {
  return renderInfoCard(item, colors, {
    isLarge: true,
    compact,
    featuredValue: true,
    minHeight: compact ? "74px" : "92px",
    valueSize: compact ? "18px" : "22px",
    padding: compact ? "10px 12px" : "12px 14px",
    style: {
      width: "100%",
      flex: "0 0 auto",
      background:
        item.background ||
        "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
    },
  });
}

function renderMetricCard(item, colors, compact) {
  return renderInfoCard(item, colors, {
    compact,
    minHeight: compact ? "62px" : "74px",
    valueSize: compact ? "14px" : "16px",
    padding: compact ? "10px 11px" : "11px 13px",
    iconSize: compact ? "12px" : "14px",
    titleSize: compact ? "9px" : "10px",
    style: {
      background:
        item.background ||
        "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
    },
  });
}

function renderFooterChip(item, colors, compact) {
  if (!item) {
    return null;
  }

  return (
    <div
      key={item.key || item.label || String(item.value)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? "7px" : "9px",
        padding: compact ? "7px 10px" : "8px 12px",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          item.background ||
          "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
        minHeight: compact ? "32px" : "36px",
        boxSizing: "border-box",
      }}
    >
      {item.icon ? (
        <div style={{ display: "flex", fontSize: compact ? "12px" : "14px" }}>{item.icon}</div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <div
          style={{
            display: "flex",
            fontSize: compact ? "9px" : "10px",
            color: colors.tertiaryTextColor,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: compact ? "12px" : "13px",
            fontWeight: 700,
            color: item.valueTone || colors.textColor,
            lineHeight: 1,
          }}
        >
          {item.value}
        </div>
      </div>
    </div>
  );
}

function renderDecorativeBars(variant, colors, compact) {
  const widths = variant === "bank"
    ? [44, 32, 26, 18]
    : [24, 28, 18];

  return (
    <div
      style={{
        position: "absolute",
        right: compact ? "12px" : "16px",
        bottom: compact ? "12px" : "16px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        alignItems: "flex-end",
        opacity: variant === "bank" ? 0.22 : 0.16,
        pointerEvents: "none",
      }}
    >
      {widths.map((width, index) => (
        <div
          key={`${variant}-bar-${index}`}
          style={{
            width: `${compact ? Math.max(10, width - 4) : width}px`,
            height: compact ? "4px" : "5px",
            borderRadius: "999px",
            backgroundColor:
              variant === "bank"
                ? colors.accentColor
                : colors.dominantColor,
          }}
        />
      ))}
    </div>
  );
}

function renderPrimaryCard(card, colors, compact, variant, options = {}) {
  if (!card) {
    return null;
  }

  const action = card.action || null;
  const isBank = variant === "bank";
  const badgeValue = card.badgeValue || null;
  const dense = Boolean(options.dense);
  const footerSegments = Array.isArray(card.footerSegments)
    ? card.footerSegments.filter(Boolean)
    : [];

  return (
    <div
      key={card.key || card.label || String(card.value)}
      style={{
        position: "relative",
        flex: isBank ? "1.25 1 0" : "0.82 1 0",
        minWidth: "0px",
        borderRadius: compact ? (dense ? "20px" : "24px") : "30px",
        padding: compact ? (dense ? "12px" : "16px") : "22px",
        background:
          card.background ||
          (isBank
            ? "linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.05))"
            : "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.045))"),
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 40px rgba(0, 0, 0, 0.14)",
        display: "flex",
        flexDirection: "column",
        gap: compact ? (dense ? "8px" : "10px") : "12px",
        overflow: "hidden",
        minHeight: compact
          ? (dense ? (isBank ? "96px" : "76px") : (isBank ? "136px" : "124px"))
          : (isBank ? "188px" : "170px"),
        boxSizing: "border-box",
        ...(dense && footerSegments.length > 0
          ? {
              paddingBottom: "30px",
            }
          : {}),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            isBank
              ? "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 55%)"
              : "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 52%)",
          pointerEvents: "none",
        }}
      />

      {renderDecorativeBars(variant, colors, compact)}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: compact ? (dense ? "6px" : "8px") : "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: compact ? (dense ? "4px" : "5px") : "7px",
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: 0,
            }}
          >
            {card.icon ? (
              <div
                style={{
                  width: compact ? "32px" : "38px",
                  height: compact ? "32px" : "38px",
                  borderRadius: compact ? (dense ? "10px" : "12px") : "14px",
                  backgroundColor: "rgba(255,255,255,0.09)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: compact ? (dense ? "14px" : "15px") : "18px",
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: compact ? (dense ? "9px" : "10px") : "11px",
                  color: colors.tertiaryTextColor,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {card.label}
              </div>
              {card.kicker ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: compact ? (dense ? "10px" : "11px") : "12px",
                    color: colors.secondaryTextColor,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {card.kicker}
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", minWidth: 0 }}>
              {renderFeaturedValue(
                card.value,
                colors,
                compact,
                card.valueTone || colors.textColor
              )}
            </div>
            {card.subvalue ? (
              <div
                style={{
                  display: "flex",
                  fontSize: compact ? "11px" : "12px",
                  color: colors.secondaryTextColor,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {card.subvalue}
              </div>
            ) : null}
          </div>
        </div>

        {badgeValue || action ? (
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            {badgeValue ? (
              <div
                style={{
                  display: "flex",
                  fontSize: compact ? "10px" : "11px",
                  fontWeight: 700,
                  color: colors.secondaryTextColor,
                  whiteSpace: "nowrap",
                }}
              >
                {badgeValue}
              </div>
            ) : null}
            {action ? (
              <button
                onClick={typeof action.onClick === "function" ? action.onClick : undefined}
                disabled={Boolean(action.disabled)}
                style={{
                  width: compact ? (dense ? "30px" : "34px") : "40px",
                  height: compact ? (dense ? "30px" : "34px") : "40px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: action.disabled
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.10)",
                  color: action.disabled ? colors.secondaryTextColor : colors.textColor,
                  fontSize: compact ? (dense ? "16px" : "18px") : "21px",
                  fontWeight: 800,
                  cursor: action.disabled ? "default" : "pointer",
                  flexShrink: 0,
                  boxShadow: action.disabled
                    ? "none"
                    : "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {card.description ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            fontSize: compact ? (dense ? "10px" : "11px") : "13px",
            lineHeight: 1.45,
            color: colors.secondaryTextColor,
            minHeight: compact ? (dense ? "0px" : "30px") : "38px",
            maxWidth: isBank ? "92%" : "88%",
          }}
        >
          {card.description}
        </div>
      ) : null}

      {Array.isArray(card.supportingItems) && card.supportingItems.length > 0 ? (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "auto",
          }}
        >
          {card.supportingItems.map((item, index) =>
            renderSupportingPill(item, colors, compact, index)
          )}
        </div>
      ) : null}

      {dense && footerSegments.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            minHeight: "26px",
            display: "flex",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.18)",
          }}
        >
          {footerSegments.map((segment, index) => (
            <div
              key={segment.key || `${segment.label}-${index}`}
              style={{
                flex: "1 1 0",
                minWidth: "0px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                padding: "4px 6px",
                boxSizing: "border-box",
                borderLeft:
                  index > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                background:
                  segment.background ||
                  (index === 0
                    ? "rgba(255,255,255,0.05)"
                    : "transparent"),
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: segment.valueSize || "10px",
                  fontWeight: 800,
                  lineHeight: 1,
                  color: segment.valueTone || colors.textColor,
                  whiteSpace: "nowrap",
                }}
              >
                {segment.value}
              </div>
              {segment.label ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: "8px",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: colors.secondaryTextColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {segment.label}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function renderProgressStrip(progress, colors, compact, hasSibling, options = {}) {
  if (!progress) {
    return null;
  }

  const progressValue = Math.max(0, Math.min(1, Number(progress.progress || 0)));
  const dense = Boolean(options.dense);

  return (
    <div
      style={{
        position: "relative",
        flex: hasSibling ? "1.2 1 0" : "1 1 0",
        minWidth: "0px",
        minHeight: compact ? (dense ? "34px" : "54px") : "66px",
        overflow: "hidden",
        borderRadius: hasSibling
          ? (compact ? (dense ? "0 0 0 14px" : "0 0 0 18px") : "0 0 0 20px")
          : (compact ? (dense ? "0 0 14px 14px" : "0 0 18px 18px") : "0 0 20px 20px"),
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.07)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${progressValue * 100}%`,
          background: `linear-gradient(90deg, ${colors.accentColor}55 0%, ${colors.accentColor}22 100%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: dense ? "2px" : "4px",
          height: "100%",
          padding: compact ? (dense ? "5px 8px" : "8px 10px") : "10px 12px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: compact ? (dense ? "8px" : "9px") : "10px",
              color: colors.tertiaryTextColor,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {progress.label}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: compact ? (dense ? "10px" : "11px") : "12px",
              fontWeight: 700,
              color: colors.textColor,
              whiteSpace: "nowrap",
            }}
          >
            {progress.value}
          </div>
        </div>
        {progress.subtitle && !dense ? (
          <div
            style={{
              display: "flex",
              fontSize: compact ? "10px" : "11px",
              color: colors.secondaryTextColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {progress.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderStripCard(item, colors, compact, hasSibling) {
  if (!item) {
    return null;
  }

  return (
    <div
      style={{
        flex: hasSibling ? "0.78 1 0" : "1 1 0",
        minWidth: "0px",
        minHeight: compact ? "54px" : "66px",
        borderRadius: hasSibling
          ? (compact ? "0 0 18px 0" : "0 0 20px 0")
          : (compact ? "0 0 18px 18px" : "0 0 20px 20px"),
        background:
          item.background ||
          "linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.05))",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: compact ? "8px 10px" : "10px 12px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: compact ? "7px" : "10px",
      }}
    >
      {item.icon ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: compact ? "22px" : "26px",
            height: compact ? "22px" : "26px",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,0.08)",
            fontSize: compact ? "11px" : "13px",
            flexShrink: 0,
          }}
        >
          {item.icon}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: compact ? "9px" : "10px",
            color: colors.tertiaryTextColor,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: compact ? "12px" : "13px",
            fontWeight: 700,
            color: item.valueTone || colors.textColor,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.value}
        </div>
        {item.caption ? (
          <div
            style={{
              display: "flex",
              fontSize: compact ? "10px" : "11px",
              color: colors.secondaryTextColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderProfilePanel(profilePanel, colors, compact) {
  if (!profilePanel) {
    return null;
  }

  const avatarUrl =
    profilePanel.avatarUrl ||
    "https://cdn.discordapp.com/embed/avatars/0.png";

  return (
    <div
      style={{
        width: compact ? "92px" : "108px",
        minWidth: compact ? "92px" : "108px",
        borderRadius: compact ? "22px" : "26px",
        padding: compact ? "8px" : "10px",
        boxSizing: "border-box",
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 28px rgba(0, 0, 0, 0.12)",
        display: "flex",
        flexDirection: "column",
        gap: compact ? "7px" : "9px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: compact ? "74px" : "88px",
          borderRadius: compact ? "18px" : "20px",
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      >
        <img
          src={avatarUrl}
          alt={profilePanel.displayName || "User"}
          width={compact ? 74 : 88}
          height={compact ? 74 : 88}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {profilePanel.guildIconUrl ? (
          <img
            src={profilePanel.guildIconUrl}
            alt={profilePanel.guildName || "Guild"}
            width={compact ? 18 : 20}
            height={compact ? 18 : 20}
            style={{
              position: "absolute",
              right: compact ? "6px" : "7px",
              bottom: compact ? "6px" : "7px",
              borderRadius: compact ? "6px" : "7px",
              border: "1px solid rgba(255,255,255,0.24)",
            }}
          />
        ) : null}
      </div>

      {profilePanel.userId ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontSize: compact ? "8px" : "9px",
            color: colors.tertiaryTextColor,
          }}
        >
          #{profilePanel.userId}
        </div>
      ) : null}

      {(profilePanel.displayName || profilePanel.meta) ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            minWidth: 0,
          }}
        >
          {profilePanel.displayName ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                fontSize: compact ? "11px" : "12px",
                fontWeight: 700,
                color: colors.textColor,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {profilePanel.displayName}
            </div>
          ) : null}
          {profilePanel.meta ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                fontSize: compact ? "10px" : "11px",
                lineHeight: 1.25,
                color: colors.secondaryTextColor,
              }}
            >
              {profilePanel.meta}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function renderCompactStatCard(item, colors, compact = true) {
  if (!item) {
    return null;
  }

  const accentWidth = compact ? "40px" : "52px";
  const iconSize = compact ? "14px" : "17px";
  const cardMinHeight = compact ? "44px" : "68px";
  const cardRadius = compact ? "16px" : "22px";
  const cardPadding = compact ? "6px 9px" : "10px 14px";
  const labelSize = compact ? "8px" : "9px";
  const valueSize = compact ? "16px" : "20px";
  const suffixSize = compact ? "10px" : "11px";

  return (
    <div
      key={item.key || item.label || String(item.value)}
      style={{
        flex: "1 1 0",
        minWidth: "0px",
        minHeight: cardMinHeight,
        borderRadius: cardRadius,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          item.background ||
          "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
        overflow: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: accentWidth,
          backgroundColor: item.accentColor || colors.dominantColor,
          opacity: 0.75,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: compact ? "8px" : "10px",
          height: "100%",
          padding: cardPadding,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: compact ? "24px" : "28px",
            height: compact ? "24px" : "28px",
            fontSize: iconSize,
            flexShrink: 0,
          }}
        >
          {item.icon}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: compact ? "2px" : "4px",
            minWidth: 0,
            flex: 1,
          }}
        >
          {item.label ? (
            <div
              style={{
                display: "flex",
                fontSize: labelSize,
                fontWeight: 700,
                color: colors.tertiaryTextColor,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.label}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: compact ? "6px" : "8px",
              minWidth: 0,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: valueSize,
                whiteSpace: "nowrap",
                fontWeight: 800,
                lineHeight: 1,
                color: item.valueTone || colors.textColor,
              }}
            >
              {item.value}
            </div>
            {item.suffix ? (
              <div
                style={{
                  display: "flex",
                  fontSize: suffixSize,
                  fontWeight: 700,
                  color: colors.secondaryTextColor,
                  textTransform: "uppercase",
                }}
              >
                {item.suffix}
              </div>
            ) : null}
            {item.rank ? (
              <div
                style={{
                  display: "flex",
                  fontSize: suffixSize,
                  fontWeight: 700,
                  color: colors.tertiaryTextColor,
                }}
              >
                {item.rank}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCompactQuickChip(item, colors, compact = true) {
  if (!item) {
    return null;
  }

  return (
    <div
      key={item.key || item.label || String(item.value)}
      style={{
        flex: item.size === "full" ? "1 1 100%" : "1 1 0",
        minWidth: item.size === "full" ? "100%" : "0px",
        minHeight: compact ? "30px" : "38px",
        borderRadius: compact ? "16px" : "19px",
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          item.background ||
          "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
        display: "flex",
        alignItems: "center",
        gap: compact ? "6px" : "8px",
        padding: compact ? "4px 8px" : "7px 12px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: compact ? "20px" : "24px",
          height: compact ? "20px" : "24px",
          fontSize: compact ? "13px" : "15px",
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "6px",
          minWidth: 0,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: compact
              ? (item.size === "full" ? "13px" : "12px")
              : (item.size === "full" ? "15px" : "14px"),
            fontWeight: 800,
            lineHeight: 1,
            color: item.valueTone || colors.textColor,
          }}
        >
          {item.value}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: compact ? "8px" : "9px",
            fontWeight: 700,
            color: colors.secondaryTextColor,
            textTransform: "uppercase",
          }}
        >
          {item.label}
        </div>
      </div>
    </div>
  );
}

function renderCompactBanner(item, colors, compact = true) {
  if (!item) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? "10px" : "12px",
        minHeight: compact ? "32px" : "46px",
        padding: compact ? "5px 9px" : "10px 14px",
        borderRadius: compact ? "16px" : "20px",
        background:
          item.background ||
          "linear-gradient(90deg, rgba(216, 65, 55, 0.94), rgba(181, 42, 37, 0.82))",
        color: item.valueTone || colors.textColor,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {item.icon ? (
        <div
          style={{
            display: "flex",
            fontSize: compact ? "17px" : "20px",
            flexShrink: 0,
          }}
        >
          {item.icon}
        </div>
      ) : null}
      {item.dotColor ? (
        <div
          style={{
            width: compact ? "18px" : "22px",
            height: compact ? "18px" : "22px",
            borderRadius: "999px",
            backgroundColor: item.dotColor,
            flexShrink: 0,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          minWidth: 0,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: compact ? "14px" : "18px",
            fontWeight: 800,
            lineHeight: 1,
            color: item.valueTone || colors.textColor,
          }}
        >
          {item.label}
        </div>
        {item.value ? (
          <div
            style={{
              display: "flex",
              fontSize: compact ? "11px" : "13px",
              fontWeight: 700,
              lineHeight: 1,
              color: item.captionTone || "rgba(255,255,255,0.62)",
            }}
          >
            {item.value}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const BalanceSectionView = (props) => {
  const {
    eyebrow,
    title,
    subtitle,
    coloring,
    progress,
    footerContent,
    profilePanel,
  } = props;

  const compact = Boolean(props.compact);
  const layout = props.layout === "classic" ? "classic" : "default";
  const summaryCards = Array.isArray(props.summaryCards) ? props.summaryCards : [];
  const primaryCards = Array.isArray(props.primaryCards) ? props.primaryCards : [];
  const metricCards = Array.isArray(props.metricCards) ? props.metricCards : [];
  const footerCards = Array.isArray(props.footerCards) ? props.footerCards : [];
  const titleMeta = typeof props.titleMeta === "string" ? props.titleMeta : null;
  const compactTopCards = Array.isArray(props.compactTopCards)
    ? props.compactTopCards
    : [];
  const compactQuickChips = Array.isArray(props.compactQuickChips)
    ? props.compactQuickChips
    : [];
  const compactBanner = props.compactBanner || null;
  const classicTopCardsInput = Array.isArray(props.classicTopCards)
    ? props.classicTopCards
    : [];
  const classicQuickChipsInput = Array.isArray(props.classicQuickChips)
    ? props.classicQuickChips
    : [];
  const classicBannerInput = props.classicBanner || null;

  const colors = {
    ...DEFAULT_COLORING,
    ...(coloring || {}),
  };

  const walletCard = primaryCards[0] || null;
  const bankCard = primaryCards[1] || null;
  const extraPrimaryCards = primaryCards.slice(2);
  const attachedStripCard = footerCards[0] || null;
  const footerChips = footerCards.slice(attachedStripCard ? 1 : 0);
  const useFloatingProfilePanel =
    compact && Boolean(profilePanel) && summaryCards.length === 0;
  const useClassicLayout =
    layout === "classic" ||
    (compact &&
      (Boolean(titleMeta) ||
        compactTopCards.length > 0 ||
        compactQuickChips.length > 0 ||
        Boolean(compactBanner)));

  if (useClassicLayout) {
    const classicFeatureCards = (
      classicTopCardsInput.length > 0
        ? classicTopCardsInput
        : compactTopCards.length > 0
        ? compactTopCards
        : metricCards.length > 0
        ? metricCards.map((item, index) => ({
            ...item,
            accentColor:
              item.accentColor ||
              (index === 0
                ? colors.dominantColor
                : index === 1
                ? colors.accentColor
                : "#67a967"),
          }))
        : summaryCards.map((item, index) => ({
            ...item,
            accentColor:
              item.accentColor ||
              (index % 2 === 0 ? colors.dominantColor : colors.accentColor),
          }))
    ).filter(Boolean);
    const classicQuickChips = (
      classicQuickChipsInput.length > 0
        ? classicQuickChipsInput
        : compactQuickChips.length > 0
        ? compactQuickChips
        : footerCards.map((item, index) => ({
            ...item,
            size: index < 2 ? "half" : "full",
          }))
    ).filter(Boolean);
    const classicBanner =
      classicBannerInput ||
      compactBanner ||
      (progress
        ? {
            icon: progress.progress >= 1 ? "✅" : "🏦",
            label: progress.subtitle || progress.label,
            value: progress.value,
            background:
              progress.progress >= 1
                ? "linear-gradient(90deg, rgba(104, 130, 115, 0.94), rgba(74, 98, 84, 0.82))"
                : "linear-gradient(90deg, rgba(216, 65, 55, 0.94), rgba(181, 42, 37, 0.82))",
            captionTone: "rgba(255,255,255,0.54)",
            dotColor: "rgba(24, 22, 20, 0.82)",
          }
        : null);
    const topClassicCards = classicFeatureCards.slice(0, 2);
    const lowerClassicCards = classicFeatureCards.slice(2);
    const halfQuickChips = classicQuickChips.filter(
      (item) => item?.size !== "full"
    );
    const fullQuickChips = classicQuickChips.filter(
      (item) => item?.size === "full"
    );
    const profileRailWidth = compact ? "122px" : "154px";
    const rightRailFlex = compact ? "0.92 1 0" : "0.98 1 0";
    const leftRailFlex = compact ? "1.16 1 0" : "1.08 1 0";
    const layoutGap = compact ? "8px" : "14px";
    const railGap = compact ? "6px" : "10px";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? "10px" : "16px",
          minHeight: 0,
          height: "100%",
          position: "relative",
        }}
      >
        {profilePanel ? (
          <div
            style={{
              position: "absolute",
              top: "0px",
              right: "0px",
              zIndex: 2,
            }}
          >
            {renderProfilePanel(profilePanel, colors, compact)}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: compact ? "8px" : "14px",
            minHeight: 0,
            height: "100%",
            paddingRight: profilePanel ? profileRailWidth : "0px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: compact ? "4px" : "6px",
            }}
          >
            {eyebrow && !titleMeta ? (
              <div
                style={{
                  display: "flex",
                  fontSize: compact ? "10px" : "12px",
                  letterSpacing: "0.16em",
                  color: colors.tertiaryTextColor,
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "10px",
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: compact ? "26px" : "42px",
                  fontWeight: 800,
                  lineHeight: 1,
                  color: colors.textColor,
                }}
              >
                {title}
              </div>
              {titleMeta ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: compact ? "14px" : "20px",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: colors.secondaryTextColor,
                  }}
                >
                  {titleMeta}
                </div>
              ) : null}
            </div>
            {subtitle && !titleMeta ? (
              <div
                style={{
                  display: "flex",
                  fontSize: compact ? "12px" : "14px",
                  color: colors.secondaryTextColor,
                  lineHeight: 1.35,
                  maxWidth: compact ? "280px" : "520px",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              gap: layoutGap,
              alignItems: "stretch",
              minHeight: 0,
              flex: "1 1 0",
              flexWrap: compact ? "nowrap" : "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: compact ? "8px" : "12px",
                flex: leftRailFlex,
                minWidth: "0px",
              }}
            >
              {walletCard
                ? renderPrimaryCard(walletCard, colors, compact, "wallet", {
                    dense: compact,
                  })
                : null}
              {bankCard ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0px",
                    minWidth: "0px",
                  }}
                >
                  {renderPrimaryCard(bankCard, colors, compact, "bank", {
                    dense: compact,
                  })}
                  {progress ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "0px",
                        marginTop: compact ? "-2px" : "-3px",
                      }}
                    >
                      {renderProgressStrip(progress, colors, compact, false, {
                        dense: compact,
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {topClassicCards.length > 0 ||
            lowerClassicCards.length > 0 ||
            classicQuickChips.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: railGap,
                  flex: rightRailFlex,
                  minWidth: "0px",
                  paddingTop: compact ? "4px" : "8px",
                }}
              >
                {topClassicCards.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: railGap,
                    }}
                  >
                    {topClassicCards.map((item) =>
                      renderCompactStatCard(item, colors, compact)
                    )}
                  </div>
                ) : null}

                {lowerClassicCards.map((item) =>
                  renderCompactStatCard(item, colors, compact)
                )}

                {halfQuickChips.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: railGap,
                    }}
                  >
                    {halfQuickChips.slice(0, 2).map((item) =>
                      renderCompactQuickChip(item, colors, compact)
                    )}
                  </div>
                ) : null}

                {fullQuickChips.map((item) =>
                  renderCompactQuickChip(item, colors, compact)
                )}
              </div>
            ) : null}
          </div>

          {classicBanner ? (
            <div
              style={{
                display: "flex",
                width: "100%",
                maxWidth: compact ? "68%" : "72%",
              }}
            >
              {renderCompactBanner(classicBanner, colors, compact)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "10px" : "16px",
        minHeight: 0,
        height: "100%",
        position: "relative",
      }}
    >
      {useFloatingProfilePanel ? (
        <div
          style={{
            position: "absolute",
            top: "0px",
            right: "0px",
            zIndex: 2,
          }}
        >
          {renderProfilePanel(profilePanel, colors, compact)}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: compact ? "10px" : "16px",
          flexWrap: "nowrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: "0px",
            flex: "1 1 0",
            paddingTop: compact ? "2px" : "4px",
            paddingRight: useFloatingProfilePanel ? "112px" : "0px",
          }}
        >
          {eyebrow ? (
            <div
              style={{
                fontSize: compact ? "10px" : "12px",
                letterSpacing: "0.16em",
                color: colors.tertiaryTextColor,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {eyebrow}
            </div>
          ) : null}

          <div
            style={{
              fontSize: compact ? "26px" : "40px",
              fontWeight: 800,
              lineHeight: 1.02,
              color: colors.textColor,
              display: "flex",
              marginTop: eyebrow ? "6px" : "0px",
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              style={{
                fontSize: compact ? "12px" : "14px",
                color: colors.secondaryTextColor,
                lineHeight: 1.45,
                marginTop: compact ? "5px" : "8px",
                display: "flex",
                maxWidth: compact ? "280px" : "640px",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {(summaryCards.length > 0 || profilePanel) ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: compact ? "10px" : "12px",
              flexShrink: 0,
            }}
          >
            {summaryCards.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: compact ? "10px" : "12px",
                  width: compact ? "124px" : "156px",
                }}
              >
                {summaryCards.map((item) => renderSummaryCard(item, colors, compact))}
              </div>
            ) : null}
            {profilePanel && !useFloatingProfilePanel
              ? renderProfilePanel(profilePanel, colors, compact)
              : null}
          </div>
        ) : null}
      </div>

      {(walletCard || bankCard) ? (
        <div
          style={{
            display: "flex",
            gap: compact ? "10px" : "14px",
            alignItems: "stretch",
            minHeight: 0,
          }}
        >
          {walletCard ? renderPrimaryCard(walletCard, colors, compact, "wallet") : null}

          {bankCard ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0px",
                flex: "1.28 1 0",
                minWidth: "0px",
              }}
            >
              {renderPrimaryCard(bankCard, colors, compact, "bank")}
              {(progress || attachedStripCard) ? (
                <div
                  style={{
                    display: "flex",
                    gap: "0px",
                    marginTop: compact ? "-2px" : "-3px",
                  }}
                >
                  {progress
                    ? renderProgressStrip(
                      progress,
                      colors,
                      compact,
                      Boolean(attachedStripCard)
                    )
                    : null}
                  {attachedStripCard
                    ? renderStripCard(
                      attachedStripCard,
                      colors,
                      compact,
                      Boolean(progress)
                    )
                    : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {extraPrimaryCards.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: compact ? "10px" : "14px",
            flexWrap: "wrap",
          }}
        >
          {extraPrimaryCards.map((card) =>
            renderPrimaryCard(card, colors, compact, "wallet")
          )}
        </div>
      ) : null}

      {metricCards.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: compact ? "10px" : "12px",
            flexWrap: "wrap",
          }}
        >
          {metricCards.map((item) => renderMetricCard(item, colors, compact))}
        </div>
      ) : null}

      {footerChips.length > 0 || footerContent ? (
        <div
          style={{
            display: "flex",
            gap: compact ? "8px" : "10px",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: compact ? "0px" : "2px",
          }}
        >
          {footerChips.map((item) => renderFooterChip(item, colors, compact))}
          {footerContent}
        </div>
      ) : null}
    </div>
  );
};

export default BalanceSectionView;
