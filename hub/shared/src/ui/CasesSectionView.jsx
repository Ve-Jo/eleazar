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

function renderCaseCard(item, colors, compact = false) {
  if (!item) {
    return null;
  }

  const interactive = typeof item.onSelect === "function" && !item.disabled;

  return (
    <div
      key={item.id || item.title}
      onClick={interactive ? item.onSelect : undefined}
      style={{
        minWidth: compact ? "124px" : "148px",
        width: compact ? "124px" : "148px",
        height: compact ? "88px" : "98px",
        borderRadius: compact ? "16px" : "18px",
        padding: compact ? "8px" : "10px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: item.isActive
          ? "rgba(255,255,255,0.16)"
          : "rgba(255,255,255,0.07)",
        border: item.isActive
          ? `1px solid ${colors.accentColor || "#ffb648"}88`
          : "1px solid rgba(255,255,255,0.08)",
        boxSizing: "border-box",
        overflow: "hidden",
        flexShrink: 0,
        opacity: item.disabled ? 0.6 : 1,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div
          style={{
            width: "42px",
            height: compact ? "32px" : "36px",
            borderRadius: compact ? "10px" : "12px",
            backgroundColor: "rgba(255,255,255,0.12)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: compact ? "18px" : "20px",
          }}
        >
          {item.emoji || "🎁"}
        </div>

        {item.countLabel ? (
          <div
            style={{
              minWidth: compact ? "24px" : "28px",
              height: compact ? "22px" : "24px",
              padding: compact ? "0 7px" : "0 8px",
              borderRadius: "999px",
              backgroundColor: "rgba(255,255,255,0.14)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: compact ? "10px" : "11px",
              fontWeight: 700,
              color: colors.textColor,
            }}
          >
            {item.countLabel}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: compact ? "12px" : "13px",
            lineHeight: 1.1,
            fontWeight: 700,
            color: colors.textColor,
            display: "flex",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </div>
        {item.subtitle ? (
          <div style={{ fontSize: compact ? "9px" : "10px", color: colors.secondaryTextColor, display: "flex" }}>
            {item.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CasesSectionView = (props) => {
  const {
    eyebrow,
    title,
    subtitle,
    featuredCase,
    calendar,
    collectionTitle,
    collectionCountText,
    detailPanel,
    coloring,
  } = props;
  const compact = Boolean(props.compact);
  const summaryCards = Array.isArray(props.summaryCards) ? props.summaryCards : [];
  const cases = Array.isArray(props.cases) ? props.cases : [];

  const colors = {
    ...DEFAULT_COLORING,
    ...(coloring || {}),
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "10px" : "14px",
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

      {calendar ? (
        <div
          style={{
            borderRadius: "24px",
            padding: compact ? "10px 12px" : "12px 14px",
            backgroundColor: colors.overlayBackground,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: "6px",
            boxSizing: "border-box",
            minHeight: compact ? "164px" : "188px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                fontSize: compact ? "11px" : "12px",
                color: colors.tertiaryTextColor,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {calendar.label}
            </div>
            {calendar.value ? (
              <div style={{ fontSize: compact ? "10px" : "11px", color: colors.secondaryTextColor, display: "flex" }}>
                {calendar.value}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: compact ? "17px" : "20px", fontWeight: 700, color: colors.textColor, display: "flex" }}>
                {calendar.headline}
              </div>
              {calendar.subline ? (
                <div style={{ fontSize: compact ? "11px" : "12px", color: colors.secondaryTextColor, display: "flex" }}>
                  {calendar.subline}
                </div>
              ) : null}
            </div>

            {calendar.badgeText ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: compact ? "6px 8px" : "7px 9px",
                  borderRadius: "999px",
                  backgroundColor:
                    calendar.badgeTone === "ready"
                      ? "rgba(109,247,167,0.18)"
                      : "rgba(255,255,255,0.10)",
                  color:
                    calendar.badgeTone === "ready" ? "#6df7a7" : colors.textColor,
                  fontSize: compact ? "10px" : "11px",
                  fontWeight: 700,
                }}
              >
                {calendar.badgeIcon ? <span>{calendar.badgeIcon}</span> : null}
                <span>{calendar.badgeText}</span>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "3px" }}>
            {(calendar.weekdays || []).map((label) => (
              <div
                key={`weekday-${label}`}
                style={{
                  width: "13.5%",
                  fontSize: compact ? "7px" : "8px",
                  color: colors.tertiaryTextColor,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {(calendar.weeks || []).map((week, weekIndex) => (
                <div
                  key={`week-${weekIndex}`}
                  style={{ display: "flex", justifyContent: "space-between", gap: "3px" }}
                >
                  {week.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "13.5%",
                        height: compact ? "18px" : "20px",
                        borderRadius: "7px",
                        backgroundColor: entry.opened
                          ? entry.isCurrent
                            ? "rgba(109,247,167,0.34)"
                            : "rgba(109,247,167,0.22)"
                          : entry.isCurrent
                          ? "rgba(255,255,255,0.16)"
                          : "rgba(255,255,255,0.08)",
                        border: entry.opened
                          ? "1px solid rgba(109,247,167,0.82)"
                          : "1px solid rgba(255,255,255,0.08)",
                        color: entry.opened
                          ? "#6df7a7"
                          : entry.isMuted
                          ? "rgba(248,251,255,0.38)"
                          : entry.isFuture
                          ? colors.tertiaryTextColor
                          : colors.textColor,
                      }}
                    >
                      <div style={{ fontSize: compact ? "8px" : "9px", fontWeight: 700, display: "flex" }}>
                        {entry.display}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {calendar.showTopFade ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "12px",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)",
                  pointerEvents: "none",
                }}
              />
            ) : null}

            {calendar.showBottomFade ? (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "12px",
                  background:
                    "linear-gradient(0deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)",
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {featuredCase ? (
        <div
          style={{
            borderRadius: "24px",
            padding: compact ? "12px" : "14px",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            gap: compact ? "12px" : "14px",
            boxSizing: "border-box",
            minHeight: compact ? "132px" : "156px",
            overflow: "hidden",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: compact ? "74px" : "92px",
              minWidth: compact ? "74px" : "92px",
              minHeight: compact ? "94px" : "120px",
              borderRadius: compact ? "18px" : "22px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: compact ? "34px" : "42px",
            }}
          >
            {featuredCase.emoji || "🎁"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: compact ? "0px" : "240px" }}>
            {featuredCase.kicker ? (
              <div
                style={{
                  fontSize: compact ? "10px" : "12px",
                  color: colors.tertiaryTextColor,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                {featuredCase.kicker}
              </div>
            ) : null}

            <div
              style={{
                fontSize: compact ? "18px" : "20px",
                fontWeight: 800,
                lineHeight: 1.08,
                width: "100%",
                marginTop: "2px",
                color: colors.textColor,
                display: "flex",
              }}
            >
              {featuredCase.title}
            </div>

            {featuredCase.description ? (
              <div
                style={{
                  fontSize: compact ? "10px" : "11px",
                  lineHeight: compact ? 1.22 : 1.25,
                  color: colors.secondaryTextColor,
                  marginTop: "4px",
                  display: "flex",
                }}
              >
                {featuredCase.description}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: compact ? "8px" : "10px",
                marginTop: compact ? "8px" : "10px",
              }}
            >
              {(featuredCase.infoCards || []).map((item) =>
                renderInfoCard(item, colors, compact)
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginTop: compact ? "10px" : "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {featuredCase.countValue ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: compact ? "7px 9px" : "8px 10px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(255,255,255,0.08)",
                      fontSize: compact ? "11px" : "12px",
                      color: colors.textColor,
                    }}
                  >
                    <span style={{ color: colors.tertiaryTextColor }}>{featuredCase.countLabel}</span>
                    <strong style={{ fontWeight: 800 }}>{featuredCase.countValue}</strong>
                  </div>
                ) : null}

                {featuredCase.statusValue ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: compact ? "7px 9px" : "8px 10px",
                      borderRadius: "999px",
                      backgroundColor:
                        featuredCase.statusTone === "ready"
                          ? "rgba(109,247,167,0.18)"
                          : "rgba(255,255,255,0.08)",
                      fontSize: compact ? "11px" : "12px",
                      color:
                        featuredCase.statusTone === "ready"
                          ? "#6df7a7"
                          : colors.textColor,
                    }}
                  >
                    <span style={{ color: colors.tertiaryTextColor }}>{featuredCase.statusLabel}</span>
                    <strong style={{ fontWeight: 800 }}>{featuredCase.statusValue}</strong>
                  </div>
                ) : null}
              </div>

              {featuredCase.action ? (
                <button
                  type="button"
                  disabled={Boolean(featuredCase.action.disabled)}
                  onClick={featuredCase.action.onClick}
                  style={{
                    minHeight: compact ? "40px" : "44px",
                    padding: compact ? "0 14px" : "0 16px",
                    borderRadius: compact ? "14px" : "16px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: featuredCase.action.disabled
                      ? "rgba(255,255,255,0.05)"
                      : `linear-gradient(135deg, ${colors.accentColor}, color-mix(in srgb, ${colors.accentColor} 76%, white))`,
                    color: featuredCase.action.disabled ? colors.secondaryTextColor : "#09101a",
                    fontWeight: 800,
                    cursor: featuredCase.action.disabled ? "default" : "pointer",
                  }}
                >
                  {featuredCase.action.label}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? "7px" : "8px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: compact ? "16px" : "18px", fontWeight: 700, color: colors.textColor, display: "flex" }}>
            {collectionTitle}
          </div>
          {collectionCountText ? (
            <div style={{ fontSize: compact ? "11px" : "12px", color: colors.secondaryTextColor, display: "flex" }}>
              {collectionCountText}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: compact ? "8px" : "10px",
            overflowX: "hidden",
            overflowY: "hidden",
            padding: compact ? "8px" : "10px",
            borderRadius: compact ? "16px" : "18px",
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {cases.map((item) => renderCaseCard(item, colors, compact))}
        </div>

        {detailPanel ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: compact ? "7px" : "8px",
              padding: compact ? "8px" : "10px",
              borderRadius: compact ? "16px" : "18px",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <div style={{ fontSize: compact ? "10px" : "11px", color: colors.tertiaryTextColor, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex" }}>
                {detailPanel.title}
              </div>
              {detailPanel.subtitle ? (
                <div style={{ fontSize: compact ? "10px" : "11px", color: colors.secondaryTextColor, display: "flex" }}>
                  {detailPanel.subtitle}
                </div>
              ) : null}
            </div>

            {Array.isArray(detailPanel.items) && detailPanel.items.length > 0 ? (
              <div style={{ display: "flex", gap: compact ? "7px" : "8px", flexWrap: "wrap", overflow: "hidden" }}>
                {detailPanel.items.map((item, index) => (
                  <div
                    key={`detail-${index}`}
                    style={{
                      flex: "1 1 48%",
                      minWidth: compact ? "132px" : "160px",
                      minHeight: compact ? "44px" : "50px",
                      borderRadius: compact ? "12px" : "14px",
                      padding: compact ? "7px 8px" : "8px 10px",
                      backgroundColor: "rgba(255,255,255,0.10)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontSize: compact ? "18px" : "22px", display: "flex" }}>{item.icon || "✨"}</div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <div style={{ fontSize: compact ? "10px" : "11px", color: colors.tertiaryTextColor, display: "flex" }}>{item.label}</div>
                      <div style={{ fontSize: compact ? "13px" : "14px", fontWeight: 700, color: colors.textColor, display: "flex" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  minHeight: compact ? "56px" : "64px",
                  borderRadius: compact ? "12px" : "14px",
                  padding: compact ? "10px" : "12px",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: colors.secondaryTextColor,
                  fontSize: compact ? "13px" : "14px",
                }}
              >
                {detailPanel.emptyText}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CasesSectionView;
