const UpgradesDisplay = ({
  interaction,
  upgrades,
  currentUpgrade,
  balance,
  width = 650,
  height = 300,
}) => {
  const upgradeWidth = 250;
  const upgradeHeight = 180;
  const padding = 20;

  if (!upgrades)
    upgrades = [
      {
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier `by 15%`",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
      },
      {
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
      },
      {
        title: "Daily Bonus",
        description: "Increase your daily bonus multiplier by 15%",
        currentLevel: 1,
        nextLevel: 2,
        price: 20,
        progress: 50,
      },
    ];

  if (!currentUpgrade) currentUpgrade = 0;
  if (!balance) balance = 52;

  const startIndex = Math.floor(currentUpgrade / 2) * 2;
  const visibleUpgrades = upgrades.slice(startIndex, startIndex + 2);

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
          justifyContent: "flex-start",
          gap: "15px",
        }}
      >
        {visibleUpgrades.map((upgrade, index) => (
          <div
            key={index}
            style={{
              width: `${upgradeWidth}px`,
              height: `${upgradeHeight}px`,
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "15px",
              padding: "15px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              border:
                currentUpgrade === index + startIndex
                  ? "4px solid #FFA500"
                  : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ marginRight: "10px" }}>💰</span>
                {upgrade.title}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  opacity: 0.8,
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {upgrade.description.split("`").map((part, index) =>
                  index % 2 === 0 ? (
                    <span key={index} style={{ display: "flex" }}>
                      {part}
                    </span>
                  ) : (
                    <span
                      key={index}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        borderRadius: "4px",
                        padding: "0 4px",
                        margin: "0 2px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {part}
                    </span>
                  )
                )}
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
                      fontSize: "16px",
                      fontWeight: "bold",
                      display: "flex",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      padding: "4px 8px",
                    }}
                  >
                    Level {upgrade.currentLevel}
                  </div>
                  {currentUpgrade === index + startIndex && (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ margin: "0 8px" }}>→</span>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "bold",
                          display: "flex",
                          backgroundColor: "rgba(255, 255, 255, 0.3)",
                          borderRadius: "8px",
                          padding: "4px 8px",
                        }}
                      >
                        {upgrade.nextLevel}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    backgroundColor: "#FFA500",
                    borderRadius: "10px",
                    padding: "5px 10px",
                    fontSize: "16px",
                    display: "flex",
                    fontWeight: "bold",
                  }}
                >
                  {upgrade.price} 💵
                </div>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  display: "flex",
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${upgrade.progress}%`,
                    height: "100%",
                    backgroundColor: "#4CAF50",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        {upgrades.length - startIndex > 2 && (
          <div
            style={{
              width: `${upgradeWidth}px`,
              height: `${upgradeHeight}px`,
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "15px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "48px",
              fontWeight: "bold",
            }}
          >
            +{upgrades.length - startIndex - 2}
          </div>
        )}
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
              interaction?.user?.displayAvatarURL ||
              "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User Avatar"
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              marginRight: "10px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              padding: "4px 8px",
            }}
          >
            <span style={{ marginRight: "10px" }}>💵</span>
            {balance}
          </div>
        </div>
        {upgrades.length - startIndex > 2 && (
          <div
            style={{
              fontSize: "14px",
              opacity: 0.8,
              display: "flex",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              padding: "4px 8px",
            }}
          >
            More upgrades available ({upgrades.length - startIndex - 2}) →
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradesDisplay;
