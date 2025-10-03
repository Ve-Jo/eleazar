const SettingsDisplay = (props) => {
  let {
    settings,
    highlightedPosition,
    visibleCount = 1,
    height = 650,
    width = 600,
    maxSettingsHided = 5,
    maxSettingsHidedWidth = 320,
    maxCategoriesDistance = 0,
    coloring,
  } = props;

  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring || {};

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
        currentValue: [
          "Enabled <bold> </bold>",
          "Enabled <bold> </bold>",
          "Enabled <bold> </bold>",
          "Enabled <bold> </bold>",
          "Enabled <bold> </bold>",
        ],
        category: "General",
      },
      {
        title: "Leveling3",
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
        title: "Leveling3",
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
        title: "XP2",
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

    const startIndex = Math.max(
      0,
      highlightedPosition - Math.floor(visibleCount / 2)
    );
    const endIndex = Math.min(settings.length, startIndex + visibleCount);

    return settings.slice(startIndex, endIndex);
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
          fontFamily: "Inter600, sans-serif",
          marginBottom: position === "top" ? "5px" : "0",
          marginTop: position === "bottom" ? "5px" : "0",
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
                  marginTop: "10px",
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
                    color: secondaryTextColor,
                  }}
                >
                  {category}
                  <div
                    style={{
                      display: "flex",
                      marginLeft: "auto",
                      maxWidth: maxSettingsHidedWidth,
                      alignItems: "center",
                    }}
                  >
                    {categorySettings
                      .slice(0, maxSettingsHided)
                      .map((setting, index) => (
                        <div
                          key={`category-setting-${index}`}
                          style={{
                            backgroundColor: overlayBackground,
                            borderRadius: "5px",
                            padding: "2px 6px",
                            fontSize: "20px",
                            fontWeight: "bold",
                            marginLeft: "5px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: textColor,
                          }}
                        >
                          {setting.title}
                        </div>
                      ))}
                  </div>
                  {categorySettings.length > maxSettingsHided && (
                    <div
                      style={{
                        backgroundColor: overlayBackground,
                        borderRadius: "5px",
                        padding: "2px 6px",
                        display: "flex",
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginLeft: "5px",
                        color: textColor,
                      }}
                    >
                      +{categorySettings.length - maxSettingsHided}
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            return (
              <div
                key={`category-${category}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
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
                        backgroundColor: overlayBackground,
                        borderRadius: "10px",
                        padding: "5px 10px",
                        margin: "0 5px 5px 0",
                        display: "flex",
                        fontSize: "26px",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        color: textColor,
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
        borderRadius: "20px",
        padding: "20px",
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        position: "relative",
        overflowY: "auto",
        background: backgroundGradient,
      }}
    >
      {renderBlurredSettings(blurredSettingsTop, "top")}

      {visibleSettings.map((setting, index) => {
        let actualIndex = visibleStartIndex + index;
        return (
          <div
            key={actualIndex}
            style={{
              backgroundColor: overlayBackground,
              borderRadius: "10px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              border:
                highlightedPosition === actualIndex
                  ? `5px solid ${
                      coloring?.isDarkText
                        ? "rgba(255, 165, 0, 0.8)"
                        : "#FFA500"
                    }`
                  : "none",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                marginBottom: "5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: textColor,
              }}
            >
              <span>{setting.title}</span>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                  backgroundColor: coloring?.isDarkText
                    ? "rgba(255, 165, 0, 0.8)"
                    : "#FFA500",
                  borderRadius: "10px",
                  padding: "5px 10px",
                  color: textColor,
                }}
              >
                {setting.category}
              </div>
            </div>
            <div
              style={{
                fontSize: "24px",
                display: "flex",
                flexDirection: "column",
                marginBottom: "5px",
                color: secondaryTextColor,
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
                        backgroundColor: coloring?.isDarkText
                          ? "rgba(255, 165, 0, 0.8)"
                          : "#FFA500",
                        borderRadius: "5px",
                        padding: "5px 5px",
                        display: "flex",
                        fontSize: "24px",
                        fontWeight: "bold",
                        alignSelf: "flex-start",
                        color: textColor,
                      }}
                    >
                      {value.split(/(<[^>]+>)/).map((part, partIdx) =>
                        part.startsWith("<") && part.endsWith(">") ? (
                          <span
                            key={partIdx}
                            style={{
                              backgroundColor: coloring?.isDarkText
                                ? "rgba(255, 215, 0, 0.8)"
                                : "#FFD700",
                              margin: "0 3px",
                              borderRadius: "5px",
                              padding: "0 3px",
                              color: textColor,
                            }}
                          >
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      )}
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

SettingsDisplay.dimensions = {
  width: 600,
  height: 650,
};

export default SettingsDisplay;
