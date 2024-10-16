const SettingsDisplay = ({
  settings,
  highlightedPosition,
  visibleCount = 1,
  height = 650,
  width = 500,
  maxCategoriesDistance = 0,
}) => {
  if (!settings)
    settings = [
      {
        title: "Leveling",
        description: "Enable or disable leveling system",
        currentValue: ["Enabled"],
        category: "General",
      },
      {
        title: "Leveling2",
        description: "Enable or disable leveling system",
        currentValue: ["Enabled"],
        category: "General",
      },
      {
        title: "Leveling3",
        description: "Enable or disable leveling system",
        currentValue: ["Enabled"],
        category: "General",
      },
      {
        title: "XP",
        description: "How much XP to give to a user for a message",
        currentValue: ["10"],
        category: "Experience",
      },
      {
        title: "OptionMaybeNextLine",
        description: "How much XP to give to a user for a message",
        currentValue: ["10"],
        category: "Miscellaneous",
      },
      {
        title: "XP2",
        description: "How much XP to give to a user for a message",
        currentValue: ["10"],
        category: "Experience",
      },
      {
        title: "LongLongLongOption",
        description: "How much XP to give to a user for a message",
        currentValue: ["10"],
        category: "Advanced",
      },
      {
        title: "InsanelyVeryLongOption",
        description: "How much XP to give to a user for a message",
        currentValue: ["10"],
        category: "Advanced",
      },
      {
        title: "OptionMaybeNextLine",
        description: "How much XP to give to a user for a message",
        currentValue: ["10"],
        category: "Miscellaneous",
      },
    ];

  if (typeof highlightedPosition === "undefined") highlightedPosition = 1;

  const categories = [...new Set(settings.map((setting) => setting.category))];
  const highlightedCategory = settings[highlightedPosition].category;
  const highlightedCategoryIndex = categories.indexOf(highlightedCategory);

  const getVisibleSettings = () => {
    if (visibleCount === 1) {
      return [settings[highlightedPosition]];
    }

    const visibleCategories = categories.filter((category, index) => {
      return Math.abs(index - highlightedCategoryIndex) <= 1;
    });

    return settings.filter((setting) =>
      visibleCategories.includes(setting.category)
    );
  };

  const visibleSettings = getVisibleSettings();
  const visibleStartIndex = settings.findIndex(
    (setting) => setting === visibleSettings[0]
  );
  const visibleEndIndex =
    settings.findIndex(
      (setting) => setting === visibleSettings[visibleSettings.length - 1]
    ) + 1;

  const blurredSettingsTop = settings.slice(0, visibleStartIndex);
  const blurredSettingsBottom = settings.slice(visibleEndIndex);

  const renderBlurredSettings = (settings, position) => {
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: position === "top" ? "10px" : "0",
          marginTop: position === "bottom" ? "10px" : "0",
        }}
      >
        {Object.entries(groupedSettings).map(([category, categorySettings]) => {
          const categoryIndex = categories.indexOf(category);
          if (
            Math.abs(categoryIndex - highlightedCategoryIndex) >
            maxCategoriesDistance
          ) {
            return (
              <div
                key={`category-${category}`}
                style={{
                  marginBottom: "10px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: "26px",
                    opacity: 0.7,
                    marginBottom: "5px",
                    display: "flex",
                  }}
                >
                  {category}
                  <div
                    style={{
                      display: "flex",
                      marginLeft: "auto",
                      backgroundColor: "rgba(255, 255, 255, 0.5)",
                      borderRadius: "5px",
                      padding: "2px 6px",
                      fontSize: "26px",
                      fontWeight: "bold",
                    }}
                  >
                    {categorySettings.length}
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div
                key={`category-${category}`}
                style={{
                  marginBottom: "10px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: "26px",
                    opacity: 0.7,
                    marginBottom: "5px",
                    display: "flex",
                  }}
                >
                  {category}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "flex-start",
                    alignItems: "center",
                  }}
                >
                  {categorySettings.map((setting, index) => (
                    <div
                      key={`blurred-${position}-${category}-${index}`}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.3)",
                        borderRadius: "10px",
                        padding: "5px 10px",
                        margin: "0 5px 5px 0",
                        display: "flex",
                        fontSize: "26px",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {setting.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        width: width,
        height: height,
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "20px",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        position: "relative",
        overflowY: "auto",
      }}
    >
      {renderBlurredSettings(blurredSettingsTop, "top")}
      {visibleSettings.map((setting, index) => {
        const actualIndex = visibleStartIndex + index;
        return (
          <div
            key={actualIndex}
            style={{
              backgroundColor:
                highlightedPosition === actualIndex
                  ? "rgba(255, 255, 255, 0.3)"
                  : "rgba(255, 255, 255, 0.3)",
              borderRadius: "10px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              marginBottom: "5px",
              border:
                highlightedPosition === actualIndex
                  ? "5px solid #FFA500"
                  : "none",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                marginBottom: "5px",
                display: "flex",
              }}
            >
              {setting.title}
            </div>
            <div
              style={{
                fontSize: "24px",
                opacity: "0.8",
                display: "flex",
                flexDirection: "column",
                marginBottom: "5px",
              }}
            >
              {setting.description}
            </div>
            {Array.isArray(setting.currentValue) &&
              setting.currentValue.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  {setting.currentValue.map((value, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "#FFA500",
                        borderRadius: "5px",
                        padding: "2px 5px",
                        display: "flex",
                        fontSize: "24px",
                        fontWeight: "bold",
                        alignSelf: "flex-start",
                      }}
                    >
                      {value}
                    </div>
                  ))}
                </div>
              )}
          </div>
        );
      })}
      {renderBlurredSettings(blurredSettingsBottom, "bottom")}
    </div>
  );
};

export default SettingsDisplay;
