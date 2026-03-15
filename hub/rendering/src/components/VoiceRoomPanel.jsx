const VoiceRoomPanel = (props) => {
  const { room, labels, coloring, width = 720, height = 360 } = props;

  const {
    textColor = "#ffffff",
    secondaryTextColor = "rgba(255,255,255,0.8)",
    tertiaryTextColor = "rgba(255,255,255,0.6)",
    overlayBackground = "rgba(0,0,0,0.35)",
    backgroundGradient = "linear-gradient(135deg, #152233, #0b1320)",
  } = coloring || {};

  const limitValue = room?.userLimit ? room.userLimit : 0;
  const members = Array.isArray(room?.members) ? room.members : [];
  const displayedMembers = members.slice(0, 4);
  const extraMembers = Math.max(0, members.length - displayedMembers.length);
  const bitrateText = room?.bitrate ? `${Math.round(room.bitrate / 1000)} kbps` : "—";
  const regionText = room?.region || labels?.regionAuto || "Auto";
  const memberCountText = limitValue > 0 ? `${members.length}/${limitValue}` : String(members.length);

  const statusBadges = [
    {
      label: room?.hidden ? labels?.hidden : labels?.visible,
      tone: room?.hidden ? "rgba(255, 200, 90, 0.85)" : "rgba(90, 170, 255, 0.85)",
    },
  ];

  return (
    <div
      style={{
        width,
        height,
        borderRadius: "22px",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "Inter600, sans-serif",
        background: backgroundGradient,
        color: textColor,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "38px", fontWeight: 700 }}>{labels?.title || "Voice Room"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {statusBadges.map((badge, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: badge.tone,
                borderRadius: "12px",
                padding: "6px 14px",
                fontSize: "18px",
                fontWeight: 700,
                color: "#0b0f16",
                textAlign: "center",
              }}
            >
              {badge.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "18px" }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "18px",
              alignItems: "center",
              backgroundColor: overlayBackground,
              borderRadius: "18px",
              padding: "14px 18px",
            }}
          >
            <img
              src={room?.ownerAvatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
              alt="owner"
              style={{ width: "64px", height: "64px", borderRadius: "20px" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", fontSize: "18px", color: tertiaryTextColor }}>
                {labels?.owner}
              </div>
              <div style={{ display: "flex", fontSize: "18px", color: tertiaryTextColor }}>
                {room?.name || "Voice Room"}
              </div>
              <div style={{ display: "flex", fontSize: "26px", fontWeight: 700 }}>
                {room?.ownerName || "Unknown"}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            backgroundColor: overlayBackground,
            borderRadius: "16px",
            padding: "16px",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", fontSize: "16px", color: tertiaryTextColor }}>
            {labels?.memberList || labels?.members}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", fontSize: "28px", fontWeight: 700 }}>
              {memberCountText}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {displayedMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    backgroundColor: "rgba(0,0,0,0.35)",
                    border: "2px solid rgba(255,255,255,0.35)",
                  }}
                >
                  <img
                    src={member.avatarUrl}
                    alt={member.name || "member"}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              ))}
              {extraMembers > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    padding: "0 8px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: textColor,
                    fontSize: "15px",
                    fontWeight: 700,
                  }}
                >
                  +{extraMembers}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ fontSize: "14px", color: tertiaryTextColor }}>{labels?.bitrate}</div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>{bitrateText}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ fontSize: "14px", color: tertiaryTextColor }}>{labels?.region}</div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>{regionText}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

VoiceRoomPanel.dimensions = {
  width: 720,
  height: 360,
};

export default VoiceRoomPanel;
