import InfoRectangle from "./InfoRectangle.jsx";

const DEFAULT_COLORING = {
  textColor: "#f8fbff",
  secondaryTextColor: "rgba(248,251,255,0.78)",
  tertiaryTextColor: "rgba(248,251,255,0.58)",
  overlayBackground: "rgba(255,255,255,0.08)",
  accentColor: "#ffb648",
  dominantColor: "#42c1ff",
};

function renderInfoCard(item, colors, compact = false) {
  if (!item) {
    return null;
  }

  const isLarge = Boolean(item.isLarge);

  return (
    <InfoRectangle
      key={`${item.label}-${item.value}`}
      icon={item.icon || null}
      background={item.background || colors.overlayBackground}
      borderRadius={compact ? "14px" : "16px"}
      padding={compact ? "8px 10px" : "10px 12px"}
      minWidth="0px"
      maxWidth="100%"
      iconSize={compact ? "13px" : "15px"}
      iconMarginRight={compact ? "7px" : "8px"}
      title={item.label}
      titleStyle={{
        fontSize: compact ? "9px" : "10px",
        color: colors.tertiaryTextColor,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
      value={
        <div
          style={{
            display: "flex",
            fontSize: isLarge
              ? (compact ? "17px" : "20px")
              : (compact ? "14px" : "16px"),
            fontWeight: 800,
            color: colors.textColor,
            lineHeight: 1,
          }}
        >
          {item.value}
        </div>
      }
      style={{
        flex: "1 1 0",
        alignSelf: "stretch",
        minHeight: isLarge
          ? (compact ? "72px" : "88px")
          : (compact ? "58px" : "72px"),
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 30px rgba(0, 0, 0, 0.12)",
        backdropFilter: "blur(12px)",
      }}
    />
  );
}

function renderUpgradeRow(item, colors, compact = false) {
  if (!item) {
    return null;
  }

  const interactive = typeof item.onSelect === "function" && !item.disabled;

  return (
    <div
      key={item.id || item.title}
      onClick={interactive ? item.onSelect : undefined}
      style={{
        borderRadius: "18px",
        padding: compact ? "10px" : "14px",
        backgroundColor: item.isActive ? colors.accentColor : "rgba(255,255,255,0.14)",
        border: item.isActive
          ? "1px solid rgba(255,255,255,0.2)"
          : "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: compact ? "10px" : "12px",
        cursor: interactive ? "pointer" : "default",
        opacity: item.disabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <div
          style={{
            width: compact ? "36px" : "42px",
            height: compact ? "36px" : "42px",
            borderRadius: compact ? "12px" : "14px",
            background: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
            fontSize: compact ? "18px" : "22px",
            display: "flex",
            flexShrink: 0,
          }}
        >
          {item.emoji || "⬆️"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span
            style={{
                fontSize: compact ? "14px" : "16px",
              color: item.isActive ? "#ffffff" : colors.textColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              fontWeight: item.isActive ? 800 : 600,
            }}
          >
            {item.title}
          </span>
          {item.levelLabel ? (
            <span
              style={{
                fontSize: compact ? "11px" : "13px",
                color: item.isActive ? "rgba(255,255,255,0.8)" : colors.tertiaryTextColor,
                display: "flex",
              }}
            >
              {item.levelLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
        {item.priceLabel ? (
          <span
            style={{
              fontSize: compact ? "13px" : "15px",
              color: item.isActive ? "#ffffff" : colors.secondaryTextColor,
              fontWeight: 700,
              display: "flex",
            }}
          >
            {item.priceLabel}
          </span>
        ) : null}
        {item.statusLabel ? (
          <span
            style={{
              fontSize: compact ? "10px" : "12px",
              color: item.statusTone || (item.isActive ? "rgba(255,255,255,0.8)" : colors.tertiaryTextColor),
              display: "flex",
            }}
          >
            {item.statusLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const UpgradesSectionView = (props) => {
  const {
    eyebrow,
    title,
    subtitle,
    featuredUpgrade,
    categoriesTitle,
    categoriesHint,
    coloring,
  } = props;
  const compact = Boolean(props.compact);
  const summaryCards = Array.isArray(props.summaryCards) ? props.summaryCards : [];
  const categories = Array.isArray(props.categories) ? props.categories : [];
  const upgrades = Array.isArray(props.upgrades) ? props.upgrades : [];

  const colors = {
    ...DEFAULT_COLORING,
    ...(coloring || {}),
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "12px" : "16px",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: compact ? "0px" : "280px",
            flex: "1 1 360px",
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
              fontSize: compact ? "28px" : "36px",
              fontWeight: 800,
              lineHeight: 1.03,
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
                marginTop: "8px",
                display: "flex",
                maxWidth: "720px",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {summaryCards.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: compact ? "10px" : "12px",
              width: compact ? "100%" : "360px",
              maxWidth: "100%",
              flex: "1 1 320px",
            }}
          >
            {summaryCards.map((item) =>
              renderInfoCard({ ...item, isLarge: true }, colors, compact)
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: compact ? "14px" : "20px", flex: 1, flexWrap: "wrap" }}>
        {featuredUpgrade ? (
          <div
            style={{
              flex: "1 1 62%",
              borderRadius: compact ? "22px" : "28px",
              padding: compact ? "16px" : "24px",
              backgroundColor: "rgba(0, 0, 0, 0.18)",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: compact ? "0px" : "360px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: compact ? "12px" : "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: compact ? "12px" : "16px", minWidth: 0 }}>
                <div
                  style={{
                    width: compact ? "62px" : "84px",
                    height: compact ? "62px" : "84px",
                    borderRadius: compact ? "18px" : "24px",
                    backgroundColor: colors.accentColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: compact ? "32px" : "44px",
                    flexShrink: 0,
                  }}
                >
                  {featuredUpgrade.emoji || "⬆️"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  {featuredUpgrade.kicker ? (
                    <div
                      style={{
                        fontSize: compact ? "11px" : "14px",
                        color: colors.tertiaryTextColor,
                        letterSpacing: "0.12em",
                        marginBottom: "6px",
                        textTransform: "uppercase",
                        display: "flex",
                      }}
                    >
                      {featuredUpgrade.kicker}
                    </div>
                  ) : null}
                  <div
                    style={{
                      fontSize: compact ? "22px" : "28px",
                      fontWeight: 800,
                      display: "flex",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "600px",
                      color: colors.textColor,
                    }}
                  >
                    {featuredUpgrade.title}
                  </div>
                  {featuredUpgrade.subtitle ? (
                    <div style={{ fontSize: compact ? "14px" : "18px", color: colors.secondaryTextColor, display: "flex", marginTop: "4px" }}>
                      {featuredUpgrade.subtitle}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {featuredUpgrade.description ? (
              <div
                style={{
                  backgroundColor: colors.overlayBackground,
                  borderRadius: compact ? "18px" : "22px",
                  padding: compact ? "10px 12px" : "14px 16px",
                  marginBottom: compact ? "10px" : "12px",
                  fontSize: compact ? "13px" : "16px",
                  lineHeight: "1.35",
                  color: colors.secondaryTextColor,
                  minHeight: compact ? "96px" : "165px",
                  display: "flex",
                  flex: "0 0 auto",
                }}
              >
                {featuredUpgrade.description}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: compact ? "10px" : "12px", marginBottom: compact ? "10px" : "12px", flexWrap: "wrap" }}>
              <div
                style={{
                  backgroundColor: colors.overlayBackground,
                  flex: 1,
                  borderRadius: compact ? "16px" : "20px",
                  padding: compact ? "10px 12px" : "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: compact ? "12px" : "16px",
                  minWidth: 0,
                  flexWrap: compact ? "wrap" : "nowrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div style={{ color: colors.tertiaryTextColor, fontSize: compact ? "10px" : "12px", letterSpacing: "0.08em", marginBottom: "6px", textTransform: "uppercase", display: "flex" }}>
                    {featuredUpgrade.effectLabel}
                  </div>
                  <div style={{ fontSize: compact ? "18px" : "26px", fontWeight: 800, display: "flex", alignItems: "center", gap: compact ? "7px" : "10px", minWidth: 0, color: colors.textColor, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", whiteSpace: "nowrap" }}>{featuredUpgrade.currentValue}</span>
                    <span style={{ color: colors.tertiaryTextColor, display: "flex" }}>→</span>
                    <span style={{ display: "flex", whiteSpace: "nowrap" }}>{featuredUpgrade.nextValue}</span>
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: compact ? "14px" : "16px",
                    padding: compact ? "8px 10px" : "10px 12px",
                    backgroundColor: featuredUpgrade.gainTone === "positive"
                      ? "rgba(36, 214, 123, 0.16)"
                      : "rgba(255, 182, 72, 0.16)",
                    borderWidth: "3px",
                    borderStyle: "solid",
                    borderColor: featuredUpgrade.gainTone === "positive"
                      ? "rgba(36, 214, 123, 0.28)"
                      : "rgba(255, 182, 72, 0.28)",
                    display: "flex",
                    alignItems: "center",
                    gap: compact ? "6px" : "8px",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ color: colors.tertiaryTextColor, fontSize: compact ? "10px" : "12px", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex" }}>
                    {featuredUpgrade.gainLabel}
                  </div>
                  <div style={{ fontSize: compact ? "18px" : "22px", fontWeight: 800, color: featuredUpgrade.gainTone === "positive" ? "#8ff0b7" : "#ffd36d", display: "flex" }}>
                    {featuredUpgrade.gainValue}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: compact ? "10px" : "12px", flexWrap: "wrap" }}>
              <div
                style={{
                  backgroundColor: colors.overlayBackground,
                  width: compact ? "100%" : "240px",
                  borderRadius: compact ? "16px" : "20px",
                  padding: compact ? "10px 12px" : "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: colors.tertiaryTextColor, fontSize: compact ? "11px" : "13px", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex" }}>{featuredUpgrade.levelLabel}</span>
                  <span style={{ fontWeight: 800, fontSize: compact ? "22px" : "28px", display: "flex", color: colors.textColor }}>
                    {featuredUpgrade.levelValue}
                  </span>
                </div>
                {featuredUpgrade.levelHint ? (
                  <div
                    style={{
                      padding: compact ? "7px 9px" : "8px 10px",
                      borderRadius: compact ? "12px" : "14px",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: compact ? "11px" : "13px",
                      color: colors.secondaryTextColor,
                      display: "flex",
                    }}
                  >
                    {featuredUpgrade.levelHint}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  backgroundColor: colors.overlayBackground,
                  flex: 1,
                  minWidth: compact ? "0px" : "240px",
                  borderRadius: compact ? "16px" : "20px",
                  padding: compact ? "10px 12px" : "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ color: colors.textColor, fontSize: compact ? "20px" : "24px", fontWeight: 800, display: "flex", whiteSpace: "nowrap" }}>
                    {featuredUpgrade.priceValue}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
                    <div style={{ color: colors.secondaryTextColor, fontSize: compact ? "13px" : "15px", display: "flex" }}>
                      {featuredUpgrade.progressPercent}%
                    </div>
                    <div style={{ color: featuredUpgrade.progressTone === "positive" ? "#8ff0b7" : colors.tertiaryTextColor, fontSize: compact ? "13px" : "15px", display: "flex", whiteSpace: "nowrap" }}>
                      {featuredUpgrade.progressText}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", width: "100%", height: compact ? "12px" : "16px", borderRadius: "999px", backgroundColor: colors.overlayBackground, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "flex",
                      width: `${featuredUpgrade.progressPercent}%`,
                      height: "100%",
                      backgroundColor: featuredUpgrade.progressTone === "positive" ? "#6df7a7" : colors.accentColor,
                    }}
                  />
                </div>

                {featuredUpgrade.action ? (
                  <button
                    type="button"
                    disabled={Boolean(featuredUpgrade.action.disabled)}
                    onClick={featuredUpgrade.action.onClick}
                    style={{
                      marginTop: compact ? "10px" : "14px",
                      minHeight: compact ? "40px" : "44px",
                      padding: compact ? "0 14px" : "0 16px",
                      borderRadius: compact ? "14px" : "16px",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: featuredUpgrade.action.disabled
                        ? "rgba(255,255,255,0.05)"
                        : `linear-gradient(135deg, ${colors.accentColor}, color-mix(in srgb, ${colors.accentColor} 76%, white))`,
                      color: featuredUpgrade.action.disabled ? colors.secondaryTextColor : "#09101a",
                      fontWeight: 800,
                      cursor: featuredUpgrade.action.disabled ? "default" : "pointer",
                    }}
                  >
                    {featuredUpgrade.action.label}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            flex: "1 1 34%",
            borderRadius: compact ? "22px" : "28px",
            padding: compact ? "12px" : "16px",
            backgroundColor: "rgba(0, 0, 0, 0.18)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: compact ? "0px" : "320px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", marginBottom: compact ? "10px" : "14px" }}>
            <div style={{ fontSize: compact ? "13px" : "16px", color: colors.tertiaryTextColor, letterSpacing: "0.12em", marginBottom: compact ? "8px" : "10px", textTransform: "uppercase", display: "flex" }}>
              {categoriesTitle}
            </div>
            <div style={{ display: "flex", gap: compact ? "8px" : "10px", flexWrap: "wrap" }}>
              {categories.map((category) => (
                <div
                  key={`cat-${category.id}`}
                  onClick={typeof category.onSelect === "function" ? category.onSelect : undefined}
                  style={{
                    fontSize: compact ? "13px" : "16px",
                    borderRadius: "999px",
                    padding: compact ? "7px 11px" : "9px 14px",
                    backgroundColor: category.isActive ? colors.accentColor : colors.overlayBackground,
                    color: category.isActive ? "white" : colors.textColor,
                    fontWeight: category.isActive ? 800 : 500,
                    display: "flex",
                    border: category.isActive ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                    cursor: typeof category.onSelect === "function" ? "pointer" : "default",
                  }}
                >
                  {category.label}
                </div>
              ))}
            </div>
            {categoriesHint ? (
              <div style={{ fontSize: compact ? "11px" : "12px", color: colors.secondaryTextColor, display: "flex", marginTop: compact ? "8px" : "10px" }}>
                {categoriesHint}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: compact ? "10px" : "12px", overflow: "hidden" }}>
            {upgrades.map((upgrade) => renderUpgradeRow(upgrade, colors, compact))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradesSectionView;
