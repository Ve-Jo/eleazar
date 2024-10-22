const UpgradesDisplay = ({
  interaction,
  upgrades,
  currentUpgrade,
  balance,
  width = 600,
  height = 350,
}) => {
  const upgradeWidth = 400;
  const upgradeHeight = 255;
  const padding = 20;
  const smallUpgradeWidth = 50;

  if (!upgrades)
    upgrades = [
      {
        emoji: "💰",
        title: "Ежедневный бонус",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 1,
      },
      {
        emoji: "💵",
        title: "Daily Bonus long long long long",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 2,
      },
      {
        emoji: "💰",
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 3,
      },
      {
        emoji: "💰",
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 4,
      },
      {
        emoji: "💰",
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 5,
      },
      {
        emoji: "💰",
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 6,
      },
      {
        emoji: "💰",
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
        id: 7,
      },
    ];

  if (typeof currentUpgrade === "undefined") currentUpgrade = 2;
  if (!balance) balance = 0;

  const visibleUpgrade = upgrades[currentUpgrade];

  const renderSideUpgrade = (upgrade, index, isPrevious) => (
    <div
      key={`${isPrevious ? "prev" : "next"}-${index}`}
      style={{
        width: `${smallUpgradeWidth}px`,
        height: `${upgradeHeight * 0.9}px`,
        backgroundColor: "#71BCF7",
        borderRadius: "8px",
        display: "flex",
        marginRight: isPrevious ? `${5 - index * 5}px` : "0",
        marginLeft: isPrevious ? "0" : `${5 - index * 5}px`,
        filter: `blur(${(index + 1) * 2}px)`,
        transform: `scale(${1 - index * 0.1})`,
        position: "relative",
        overflow: "hidden",
      }}
    />
  );

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: `${padding}px`,
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          height: `${upgradeHeight}px`,
          position: "relative",
        }}
      >
        {/* Previous upgrades */}
        <div
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            marginRight: "10px",
            position: "absolute",
            right: "84%",
            zIndex: 1,
          }}
        >
          {upgrades
            .slice(0, currentUpgrade)
            .map((upgrade, index) => renderSideUpgrade(upgrade, index, true))}
        </div>

        {/* Current upgrade */}
        <div
          style={{
            width: `${upgradeWidth}px`,
            height: `${upgradeHeight}px`,
            backgroundColor: "#71BCF7",
            borderRadius: "15px",
            padding: "15px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "4px solid #FFA500",
            zIndex: 10,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "5px",
                display: "flex",
                alignItems: "center",
                flexWrap: "nowrap",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {typeof visibleUpgrade.id === "number" && (
                <span
                  style={{
                    marginRight: "10px",
                    flexShrink: 0,
                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                    borderRadius: "8px",
                    padding: "4px 8px",
                  }}
                >
                  #{visibleUpgrade.id}
                </span>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  borderRadius: "8px",
                  padding: "4px 8px",
                }}
              >
                <span style={{ marginRight: "10px", flexShrink: 0 }}>
                  {visibleUpgrade.emoji}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {visibleUpgrade.title}
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: "24px",
                opacity: 0.8,
                display: "flex",
                flexDirection: "row",
              }}
            >
              {visibleUpgrade.description}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    display: "flex",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: "8px",
                    padding: "4px 8px",
                  }}
                >
                  Level {visibleUpgrade.currentLevel}
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ margin: "0 8px" }}>→</span>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      display: "flex",
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                      borderRadius: "8px",
                      padding: "4px 8px",
                    }}
                  >
                    {visibleUpgrade.nextLevel}
                  </div>
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#FFA500",
                  borderRadius: "10px",
                  padding: "5px 10px",
                  fontSize: "24px",
                  display: "flex",
                  fontWeight: "bold",
                }}
              >
                {visibleUpgrade.price} 💵
              </div>
            </div>
            <div
              style={{
                width: "100%",
                height: "12px",
                display: "flex",
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${visibleUpgrade.progress}%`,
                  height: "100%",
                  backgroundColor: "#4CAF50",
                }}
              />
            </div>
          </div>
        </div>

        {/* Next upgrades */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            marginLeft: "10px",
            position: "absolute",
            left: "84%",
            zIndex: 1,
          }}
        >
          {upgrades
            .slice(currentUpgrade + 1)
            .map((upgrade, index) => renderSideUpgrade(upgrade, index, false))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: `${padding}px`,
          left: `${padding}px`,
          right: `${padding}px`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <img
            src={
              interaction?.user?.displayAvatarURL({
                size: 1024,
                extension: "png",
              }) || "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User Avatar"
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "25%",
              marginRight: "10px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              fontSize: "24px",
              padding: "4px 8px",
            }}
          >
            <span style={{ marginRight: "10px" }}>💵</span>
            {balance}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradesDisplay;
