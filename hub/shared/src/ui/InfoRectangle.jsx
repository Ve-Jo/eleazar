const InfoRectangle = (props) => {
  const {
    icon = null,
    title = null,
    titleStyle = undefined,
    value = null,
    children = null,
    background = undefined,
    borderRadius = "12px",
    padding = "5px 12px",
    minWidth = "200px",
    maxWidth = "320px",
    iconMarginRight = "12px",
    iconSize = "24px",
    className = "",
    contentClassName = "",
    style = {},
  } = props;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        background: background || "rgba(255, 255, 255, 0.08)",
        borderRadius,
        padding,
        alignItems: "center",
        alignSelf: "flex-start",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        flexShrink: 0,
        width: "auto",
        minWidth,
        maxWidth,
        ...style,
      }}
    >
      {children}

      {icon ? (
        <div
          style={{
            display: "flex",
            fontSize: iconSize,
            marginRight: iconMarginRight,
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {icon}
        </div>
      ) : null}

      <div
        className={contentClassName}
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          position: "relative",
          zIndex: 1,
          gap: "2px",
        }}
      >
        {title ? <div style={{ display: "flex", ...titleStyle }}>{title}</div> : null}
        {value ? <div style={{ display: "flex" }}>{value}</div> : null}
      </div>
    </div>
  );
};

export default InfoRectangle;
