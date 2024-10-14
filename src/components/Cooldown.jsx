const Cooldown = ({ interaction, user, nextDaily, emoji }) => {
  const formatTime = (milliseconds) => {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getAdjacentNumbers = (time) => {
    const [hours, minutes, seconds] = time.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return [
      (totalSeconds + 2) % 86400,
      (totalSeconds + 1) % 86400,
      (totalSeconds - 1 + 86400) % 86400,
      (totalSeconds - 2 + 86400) % 86400,
    ].map((s) => {
      const sec = s % 60;
      return sec.toString().padStart(2, "0");
    });
  };

  const formattedTime = formatTime(nextDaily);
  const [nextTwo, nextOne, prevOne, prevTwo] =
    getAdjacentNumbers(formattedTime);

  return (
    <div
      style={{
        width: "450px",
        height: "200px",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "10px 20px",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                textAlign: "left",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                position: "relative",
              }}
            >
              {formattedTime}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  marginLeft: "10px",
                  opacity: 0.5,
                  position: "absolute",
                  right: "-0px",
                  lineHeight: "1",
                }}
              >
                <span style={{ filter: "blur(4px)" }}>{nextTwo}</span>
                <span style={{ filter: "blur(1px)" }}>{nextOne}</span>
                <span style={{ opacity: 0 }}>00</span>
                <span style={{ filter: "blur(1px)" }}>{prevOne}</span>
                <span style={{ filter: "blur(4px)" }}>{prevTwo}</span>
              </div>
            </div>
          </div>
          <div
            style={{
              width: "100px",
              fontSize: "85px",
              height: "100px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {emoji || "🎁"}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "8px",
          width: "100%",
        }}
      >
        <span style={{ fontSize: "14px", opacity: "0.2" }}>
          #{user?.id || "{id}"}
        </span>
        <span style={{ fontSize: "16px" }}>
          {user?.username || user?.displayName || "{username}"}
        </span>
      </div>
    </div>
  );
};

export default Cooldown;
