const Daily = ({ interaction, user, balance, amount }) => {
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
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: "45px",
              textAlign: "left",
              marginBottom: "10px",
            }}
          >
            🎁 Daily!
          </div>
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 10px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              💵 {balance?.toFixed(2) || "{balance}"}
              <span
                style={{
                  backgroundColor: "rgba(115, 220, 133, 1)",
                  borderRadius: "10px",
                  padding: "5px 10px",
                  marginLeft: "15px",
                  fontSize: "16px",
                  color: "#FFFFFF",
                  fontWeight: "bold",
                }}
              >
                + {amount?.toFixed(2) || "{amount}"}
              </span>
            </span>
          </div>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                padding: "5px 10px",
                borderRadius: "10px",
              }}
            >
              🕓 24:00:00
            </div>
          </span>
        </div>
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "25px",
            overflow: "hidden",
            backgroundColor: "#1565c0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={
              user?.displayAvatarURL?.({ extension: "png", size: 2048 }) ||
              "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User"
            width="100"
            height="100"
            style={{ objectFit: "cover", borderRadius: "25px" }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          width: "100%",
          marginTop: "8px",
        }}
      >
        <span style={{ fontSize: "14px", opacity: "0.2" }}>
          #{user?.id || "{id}"}
        </span>
        <span style={{ fontSize: "16px", fontWeight: "bold" }}>
          {user?.username || user?.displayName || "{username}"}
        </span>
      </div>
    </div>
  );
};

export default Daily;
