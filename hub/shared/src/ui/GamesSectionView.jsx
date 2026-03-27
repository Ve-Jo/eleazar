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

function renderGameCard(game, colors, compact = false) {
  if (!game) {
    return null;
  }

  const interactive = typeof game.onSelect === "function" && !game.disabled;

  return (
    <div
      key={game.id || game.title}
      onClick={interactive ? game.onSelect : undefined}
      style={{
        minWidth: compact ? "116px" : "132px",
        width: compact ? "116px" : "132px",
        height: compact ? "108px" : "126px",
        borderRadius: compact ? "16px" : "20px",
        padding: compact ? "9px" : "12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: game.isActive
          ? "rgba(255,255,255,0.16)"
          : "rgba(255,255,255,0.055)",
        border: game.isActive
          ? `1px solid ${colors.accentColor || "#ffb648"}88`
          : "1px solid rgba(255,255,255,0.08)",
        boxSizing: "border-box",
        overflow: "hidden",
        flexShrink: 0,
        opacity: game.isMuted ? 0.6 : 1,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: compact ? "38px" : "44px",
            height: compact ? "34px" : "40px",
            borderRadius: compact ? "12px" : "14px",
            backgroundColor: "rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: compact ? "18px" : "20px",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {game.thumbnail ? (
            <img
              src={game.thumbnail}
              alt={game.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "flex",
              }}
            />
          ) : (
            game.emoji || "🎮"
          )}
        </div>

        {game.statusLabel ? (
          <div
            style={{
              maxWidth: compact ? "52px" : "58px",
              padding: compact ? "3px 6px" : "4px 7px",
              borderRadius: "999px",
              backgroundColor: "rgba(255,255,255,0.09)",
              fontSize: compact ? "8px" : "9px",
              fontWeight: 700,
              color: colors.secondaryTextColor,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {game.statusLabel}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: compact ? "12px" : "13px",
            fontWeight: 700,
            color: colors.textColor,
            lineHeight: 1.15,
            display: "flex",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {game.title}
        </div>

        {game.meta ? (
          <div
            style={{
              fontSize: compact ? "10px" : "11px",
              color: colors.secondaryTextColor,
              lineHeight: 1.2,
              display: "flex",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {game.meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const GamesSectionView = (props) => {
  const {
    eyebrow,
    title,
    subtitle,
    featuredGame,
    collectionTitle,
    collectionCountText,
    collectionHintText,
    coloring,
  } = props;
  const compact = Boolean(props.compact);
  const summaryCards = Array.isArray(props.summaryCards) ? props.summaryCards : [];
  const collectionLeading = props.collectionLeading || null;
  const collectionTrailing = props.collectionTrailing || null;
  const games = Array.isArray(props.games) ? props.games : [];

  const colors = {
    ...DEFAULT_COLORING,
    ...(coloring || {}),
  };

  const featuredStatCards = Array.isArray(featuredGame?.statCards)
    ? featuredGame.statCards
    : [];
  const featuredFooterCards = Array.isArray(featuredGame?.footerCards)
    ? featuredGame.footerCards
    : [];

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
              renderInfoCard(
                {
                  ...item,
                  isLarge: true,
                  background:
                    item.background ||
                    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                },
                colors,
                compact
              )
            )}
          </div>
        ) : null}
      </div>

      {featuredGame ? (
        <div
          style={{
            borderRadius: "24px",
            padding: compact ? "14px" : "18px",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            gap: compact ? "12px" : "16px",
            boxSizing: "border-box",
            minHeight: compact ? "172px" : "220px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: compact ? "112px" : "152px",
              minWidth: compact ? "112px" : "152px",
              minHeight: compact ? "136px" : "176px",
              borderRadius: compact ? "18px" : "22px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: compact ? "48px" : "68px",
              overflow: "hidden",
            }}
          >
            {featuredGame.thumbnail ? (
              <img
                src={featuredGame.thumbnail}
                alt={featuredGame.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "flex",
                }}
              />
            ) : (
              <div style={{ display: "flex" }}>{featuredGame.emoji || "🎮"}</div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "1 1 320px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                {featuredGame.kicker ? (
                  <div
                    style={{
                      fontSize: compact ? "10px" : "12px",
                      color: colors.tertiaryTextColor,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      display: "flex",
                    }}
                  >
                    {featuredGame.kicker}
                  </div>
                ) : null}

                <div
                  style={{
                    fontSize: compact ? "22px" : "28px",
                    fontWeight: 800,
                    lineHeight: 1.02,
                    color: colors.textColor,
                    display: "flex",
                    marginTop: featuredGame.kicker ? "4px" : "0px",
                  }}
                >
                  {featuredGame.title}
                </div>

                {featuredGame.subtitle ? (
                  <div
                    style={{
                      fontSize: compact ? "12px" : "13px",
                      color: colors.secondaryTextColor,
                      display: "flex",
                      marginTop: "6px",
                    }}
                  >
                    {featuredGame.subtitle}
                  </div>
                ) : null}
              </div>

              {(featuredGame.statusLabel || featuredGame.statusValue) ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "4px",
                  }}
                >
                  {featuredGame.statusLabel ? (
                    <div
                      style={{
                        fontSize: compact ? "10px" : "11px",
                        color: colors.tertiaryTextColor,
                        display: "flex",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {featuredGame.statusLabel}
                    </div>
                  ) : null}
                  {featuredGame.statusValue ? (
                    <div
                      style={{
                        fontSize: compact ? "18px" : "22px",
                        fontWeight: 700,
                        color: colors.textColor,
                        display: "flex",
                      }}
                    >
                      {featuredGame.statusValue}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {featuredStatCards.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: compact ? "8px" : "10px",
                  marginTop: compact ? "10px" : "12px",
                }}
              >
                {featuredStatCards.map((item) => renderInfoCard(item, colors, compact))}
              </div>
            ) : null}

            {featuredGame.progress ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: compact ? "6px" : "7px",
                  marginTop: compact ? "10px" : "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: compact ? "10px" : "11px",
                      color: colors.secondaryTextColor,
                      display: "flex",
                    }}
                  >
                    {featuredGame.progress.label}
                  </div>
                  <div
                    style={{
                      fontSize: compact ? "10px" : "11px",
                      color: colors.tertiaryTextColor,
                      display: "flex",
                    }}
                  >
                    {featuredGame.progress.value}
                  </div>
                </div>

                <div
                  style={{
                    height: compact ? "10px" : "12px",
                    width: "100%",
                    borderRadius: "999px",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, Number(featuredGame.progress.percent || 0))
                      )}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${colors.accentColor} 0%, ${colors.dominantColor} 100%)`,
                      borderRadius: "999px",
                      display: "flex",
                    }}
                  />
                </div>
              </div>
            ) : null}

            {featuredGame.note ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  marginTop: compact ? "8px" : "10px",
                  padding: compact ? "7px 8px" : "8px 10px",
                  borderRadius: compact ? "10px" : "12px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxSizing: "border-box",
                }}
              >
                {featuredGame.note.label ? (
                  <div
                    style={{
                      fontSize: compact ? "9px" : "10px",
                      color: colors.tertiaryTextColor,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      display: "flex",
                    }}
                  >
                    {featuredGame.note.label}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: compact ? "11px" : "12px",
                    color: featuredGame.note.color || colors.secondaryTextColor,
                    display: "flex",
                    lineHeight: 1.3,
                  }}
                >
                  {featuredGame.note.text}
                </div>
              </div>
            ) : null}

            {featuredFooterCards.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: compact ? "8px" : "10px",
                  marginTop: compact ? "10px" : "12px",
                }}
              >
                {featuredFooterCards.map((item) => renderInfoCard(item, colors, compact))}
              </div>
            ) : null}

            {featuredGame.action ? (
              <button
                type="button"
                disabled={Boolean(featuredGame.action.disabled)}
                onClick={featuredGame.action.onClick}
                style={{
                  marginTop: compact ? "10px" : "14px",
                  minHeight: compact ? "40px" : "46px",
                  padding: compact ? "0 14px" : "0 16px",
                  borderRadius: compact ? "14px" : "16px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: featuredGame.action.disabled
                    ? "rgba(255,255,255,0.05)"
                    : `linear-gradient(135deg, ${colors.accentColor}, color-mix(in srgb, ${colors.accentColor} 76%, white))`,
                  color: featuredGame.action.disabled ? colors.secondaryTextColor : "#09101a",
                  fontWeight: 800,
                  cursor: featuredGame.action.disabled ? "default" : "pointer",
                }}
              >
                {featuredGame.action.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        style={{
          borderRadius: "24px",
          padding: compact ? "10px" : "14px",
          backgroundColor: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          flexDirection: "column",
          gap: compact ? "8px" : "10px",
          overflow: "hidden",
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: compact ? "14px" : "16px",
              fontWeight: 700,
              color: colors.textColor,
              display: "flex",
            }}
          >
            {collectionTitle}
          </div>

          {collectionCountText ? (
            <div
              style={{
                fontSize: compact ? "11px" : "12px",
                color: colors.secondaryTextColor,
                display: "flex",
              }}
            >
              {collectionCountText}
            </div>
          ) : null}
        </div>

        {collectionHintText ? (
          <div
            style={{
              fontSize: compact ? "11px" : "12px",
              color: colors.tertiaryTextColor,
              display: "flex",
            }}
          >
            {collectionHintText}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: compact ? "8px" : "10px",
            alignItems: "stretch",
            minHeight: compact ? "108px" : "126px",
            overflow: "hidden",
          }}
        >
          {collectionLeading}

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              gap: compact ? "7px" : "8px",
              overflowX: "hidden",
              overflowY: "hidden",
              alignItems: "stretch",
            }}
          >
            {games.map((game) => renderGameCard(game, colors, compact))}
          </div>

          {collectionTrailing}
        </div>
      </div>
    </div>
  );
};

export default GamesSectionView;
