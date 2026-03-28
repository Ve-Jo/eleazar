import InfoRectangle from "./InfoRectangle.jsx";

const DEFAULT_COLORING = {
  textColor: "#f8fbff",
  secondaryTextColor: "rgba(248,251,255,0.78)",
  tertiaryTextColor: "rgba(248,251,255,0.58)",
  overlayBackground: "rgba(255,255,255,0.08)",
  accentColor: "#8f7efc",
  dominantColor: "#5bc3ff",
};

function renderProfilePanel(profilePanel, colors, compact) {
  if (!profilePanel) {
    return null;
  }

  const avatarUrl = profilePanel.avatarUrl || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: compact ? "6px" : "8px",
        width: compact ? "106px" : "124px",
        padding: compact ? "8px" : "10px",
        borderRadius: compact ? "18px" : "20px",
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.04))",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: compact ? "62px" : "70px",
          height: compact ? "62px" : "70px",
          borderRadius: compact ? "20px" : "22px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.tertiaryTextColor,
          fontSize: compact ? "20px" : "24px",
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="profile"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          "👤"
        )}
      </div>

      {profilePanel.userId ? (
        <div
          style={{
            fontSize: compact ? "9px" : "10px",
            color: colors.tertiaryTextColor,
            width: "100%",
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          #{profilePanel.userId}
        </div>
      ) : null}

      {profilePanel.displayName ? (
        <div
          style={{
            fontSize: compact ? "13px" : "14px",
            fontWeight: 700,
            color: colors.textColor,
            width: "100%",
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {profilePanel.displayName}
        </div>
      ) : null}

      {profilePanel.meta ? (
        <div
          style={{
            fontSize: compact ? "10px" : "11px",
            color: colors.secondaryTextColor,
            textAlign: "center",
            width: "100%",
          }}
        >
          {profilePanel.meta}
        </div>
      ) : null}
    </div>
  );
}

function renderLevelCard(item, colors, compact) {
  if (!item) {
    return null;
  }
  const progressValue = Math.max(0, Math.min(1, Number(item.progress || 0)));
  const accentColor = item.accentColor || colors.dominantColor;

  return (
    <InfoRectangle
      key={item.key || item.label}
      icon={item.icon}
      background={item.background || colors.overlayBackground}
      borderRadius={compact ? "18px" : "22px"}
      padding={compact ? "10px 12px" : "12px 14px"}
      minWidth="0px"
      maxWidth="100%"
      iconSize={compact ? "18px" : "20px"}
      iconMarginRight={compact ? "8px" : "10px"}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{item.label}</span>
          {item.rank ? (
            <span
              style={{
                fontSize: compact ? "10px" : "11px",
                color: colors.tertiaryTextColor,
                fontWeight: 700,
              }}
            >
              {item.rank}
            </span>
          ) : null}
        </span>
      }
      titleStyle={{
        fontSize: compact ? "10px" : "11px",
        color: colors.secondaryTextColor,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
      value={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: compact ? "5px" : "6px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: compact ? "24px" : "28px", fontWeight: 800, color: colors.textColor }}>
              {item.value}
            </span>
            <span
              style={{
                fontSize: compact ? "10px" : "11px",
                fontWeight: 700,
                color: colors.secondaryTextColor,
                textTransform: "uppercase",
              }}
            >
              {item.suffix || "lvl"}
            </span>
          </div>
          <span
            style={{
              fontSize: compact ? "10px" : "11px",
              color: colors.tertiaryTextColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.xpLabel}
          </span>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: compact ? "5px" : "6px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.14)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${progressValue * 100}%`,
                background: accentColor,
                opacity: 0.88,
                transition: "width 240ms ease",
              }}
            />
          </div>
        </div>
      }
      style={{
        width: "100%",
        minHeight: compact ? "88px" : "100px",
        border: "1px solid rgba(255,255,255,0.10)",
        boxSizing: "border-box",
        alignSelf: "stretch",
      }}
    />
  );
}

function renderRoleRow(item, colors, compact) {
  if (!item) {
    return null;
  }

  return (
    <div
      key={item.key || item.roleId}
      style={{
        position: "relative",
        width: "100%",
        borderRadius: compact ? "12px" : "13px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        minHeight: compact ? "40px" : "44px",
        padding: compact ? "8px 10px" : "9px 12px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: compact ? "7px" : "8px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${Math.max(0, Math.min(1, Number(item.progress || 0))) * 100}%`,
          background: `${item.color || colors.accentColor}44`,
          transition: "width 240ms ease",
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: compact ? "8px" : "9px",
          height: compact ? "8px" : "9px",
          borderRadius: "999px",
          backgroundColor: item.color || colors.accentColor,
          border: "1px solid rgba(255,255,255,0.35)",
          flexShrink: 0,
          position: "relative",
          zIndex: 1,
        }}
      />

      <span
        style={{
          fontSize: compact ? "11px" : "12px",
          fontWeight: 700,
          color: colors.textColor,
          minWidth: 0,
          flex: "1 1 auto",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          position: "relative",
          zIndex: 1,
        }}
      >
        {item.roleName || item.roleId}
      </span>

      <span
        style={{
          fontSize: compact ? "10px" : "11px",
          color: colors.secondaryTextColor,
          whiteSpace: "nowrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        {item.modeLabel} · {item.requiredLabel}
      </span>
    </div>
  );
}

const LevelSectionView = (props) => {
  const compact = Boolean(props.compact);
  const colors = {
    ...DEFAULT_COLORING,
    ...(props.coloring || {}),
  };
  const levelCards = Array.isArray(props.levelCards) ? props.levelCards : [];
  const upcomingRoles = Array.isArray(props.upcomingRoles) ? props.upcomingRoles : [];
  const seasonCard = props.seasonCard || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "10px" : "14px",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 auto" }}>
          {props.eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: compact ? "10px" : "12px",
                letterSpacing: "0.16em",
                color: colors.tertiaryTextColor,
                textTransform: "uppercase",
              }}
            >
              {props.eyebrow}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ fontSize: compact ? "30px" : "40px", fontWeight: 800, color: colors.textColor }}>
              {props.title}
            </div>
            {props.titleMeta ? (
              <div style={{ fontSize: compact ? "17px" : "20px", fontWeight: 700, color: colors.secondaryTextColor }}>
                {props.titleMeta}
              </div>
            ) : null}
          </div>
          {props.subtitle ? (
            <div
              style={{
                fontSize: compact ? "11px" : "12px",
                color: colors.secondaryTextColor,
                marginTop: compact ? "2px" : "4px",
              }}
            >
              {props.subtitle}
            </div>
          ) : null}
        </div>

        {seasonCard ? (
          <InfoRectangle
            icon="🏆"
            background={colors.overlayBackground}
            borderRadius={compact ? "18px" : "20px"}
            padding={compact ? "8px 10px" : "10px 12px"}
            minWidth={compact ? "186px" : "208px"}
            maxWidth={compact ? "186px" : "208px"}
            iconSize={compact ? "16px" : "18px"}
            iconMarginRight={compact ? "8px" : "9px"}
            title={seasonCard.title}
            titleStyle={{
              fontSize: compact ? "10px" : "11px",
              color: colors.secondaryTextColor,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
            }}
            value={
              <div style={{ display: "flex", flexDirection: "column", gap: compact ? "3px" : "4px" }}>
                <span style={{ fontSize: compact ? "18px" : "21px", fontWeight: 800, color: colors.textColor }}>
                  {seasonCard.xpValue}
                </span>
                <span style={{ fontSize: compact ? "10px" : "11px", color: colors.tertiaryTextColor }}>
                  {seasonCard.countdownLabel}
                </span>
              </div>
            }
            style={{ border: "1px solid rgba(255,255,255,0.11)", alignSelf: "stretch" }}
          />
        ) : null}

        {renderProfilePanel(props.profilePanel, colors, compact)}
      </div>

      <div style={{ display: "flex", gap: compact ? "10px" : "12px", minHeight: 0, flex: "1 1 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? "8px" : "10px", flex: "0.95 1 0", minWidth: 0 }}>
          {levelCards.map((item) => renderLevelCard(item, colors, compact))}
        </div>

        <InfoRectangle
          icon="🎖️"
          background={colors.overlayBackground}
          borderRadius={compact ? "18px" : "20px"}
          padding={compact ? "10px 11px" : "12px 14px"}
          minWidth="0px"
          maxWidth="100%"
          iconSize={compact ? "16px" : "18px"}
          iconMarginRight={compact ? "8px" : "9px"}
          title={props.rolesTitle}
          titleStyle={{
            fontSize: compact ? "10px" : "11px",
            color: colors.secondaryTextColor,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 700,
          }}
          value={
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: compact ? "6px" : "7px",
                width: "100%",
                maxHeight: compact ? "170px" : "218px",
                overflowY: "auto",
                paddingRight: "2px",
                boxSizing: "border-box",
              }}
            >
              {upcomingRoles.length > 0 ? (
                upcomingRoles.map((item) => renderRoleRow(item, colors, compact))
              ) : (
                <div
                  style={{
                    fontSize: compact ? "11px" : "12px",
                    color: colors.tertiaryTextColor,
                    padding: compact ? "6px 0" : "8px 0",
                  }}
                >
                  {props.rolesEmptyText || "No upcoming role"}
                </div>
              )}
            </div>
          }
          style={{
            flex: "1 1 0",
            minHeight: compact ? "318px" : "352px",
            border: "1px solid rgba(255,255,255,0.11)",
            alignSelf: "stretch",
          }}
        />
      </div>
    </div>
  );
};

export default LevelSectionView;
