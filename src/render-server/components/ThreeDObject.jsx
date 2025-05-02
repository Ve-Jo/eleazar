import React from "react";

const ThreeDObject = (props) => {
  const {
    imageData,
    title = "3D Object View",
    width = 600,
    height = 400,
    coloring,
    debug,
  } = props;

  const {
    textColor = "#FFFFFF",
    secondaryTextColor = "rgba(255, 255, 255, 0.8)",
    overlayBackground = "rgba(0, 0, 0, 0.2)",
    backgroundGradient = "linear-gradient(145deg, #2B2D31, #1E1F22)",
  } = coloring || {};

  const containerStyle = {
    display: "flex",
    width: `${ThreeDObject.dimensions.width}px`,
    height: `${ThreeDObject.dimensions.height}px`,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter400, sans-serif",
    background: backgroundGradient,
    color: textColor,
    padding: "20px",
    borderRadius: "15px",
    overflow: "hidden",
    position: "relative",
    border: debug ? "2px solid lime" : "none",
  };

  const imageStyle = {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: "8px",
    border: `1px solid ${secondaryTextColor}`,
  };

  return (
    <div style={containerStyle}>
      {imageData ? (
        <img src={imageData} style={imageStyle} alt="3D Rendered Object" />
      ) : (
        <div style={{ textAlign: "center", opacity: 0.8 }}>
          Rendering 3D Image...
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: "15px",
          left: "20px",
          fontSize: "20px",
          fontWeight: "600",
          backgroundColor: overlayBackground,
          padding: "5px 10px",
          borderRadius: "5px",
        }}
      >
        {title}
      </div>
      {debug && (
        <div
          style={{
            position: "absolute",
            bottom: "5px",
            right: "5px",
            fontSize: "10px",
            background: "rgba(0,0,0,0.5)",
            padding: "2px 4px",
            borderRadius: "3px",
          }}
        >
          Debug Mode
        </div>
      )}
    </div>
  );
};

// Static properties for the preview system
ThreeDObject.requires3D = true; // Signal that this component needs Puppeteer

// Define controls for the preview page
ThreeDObject.previewControls = [
  {
    name: "modelType",
    label: "Model Type",
    type: "select",
    options: [
      { value: "cube", label: "Cube" },
      { value: "sphere", label: "Sphere" },
      { value: "torus", label: "Torus" },
    ],
    defaultValue: "cube",
  },
  {
    name: "rotationX",
    label: "Rotation X",
    type: "range",
    min: 0,
    max: 6.28,
    step: 0.1,
    defaultValue: 0.5,
  },
  {
    name: "rotationY",
    label: "Rotation Y",
    type: "range",
    min: 0,
    max: 6.28,
    step: 0.1,
    defaultValue: 0.5,
  },
];

ThreeDObject.dimensions = {
  width: 600,
  height: 400,
};

ThreeDObject.localization_strings = {
  title: {
    en: "3D Object View",
    ru: "3D Объект",
    uk: "3D Об'єкт",
  },
};

export default ThreeDObject;
