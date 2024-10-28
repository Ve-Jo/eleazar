const Transfer = ({ interaction, database, amount, isDeposit }) => {
  const user =
    interaction?.options.getMember("user") || interaction?.user || false;

  const arrowDirection = isDeposit ? "🔽" : "🔼";

  return (
    <div
      style={{
        width: "400px",
        height: "200px",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "10px 20px 20px 20px",
        color: "white",
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
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: "0 0 10px 0", fontSize: "24px" }}>
            {isDeposit ? "Deposit" : "Withdraw"}
          </h2>
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "0",
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "#1565c0",
              display: "flex",
            }}
          >
            <img
              src={
                user
                  ? user?.displayAvatarURL({ extension: "png", size: 256 })
                  : "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="User"
              width="100"
              height="100"
              style={{ objectFit: "cover", borderRadius: "25%" }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 10px",
              display: "flex",
              position: "relative",
            }}
          >
            <span style={{ fontSize: "24px", marginRight: "10px" }}>💵</span>
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              {database?.balance.toFixed(2) || "{balance}"}
            </span>
          </div>
          <div
            style={{
              padding: "0 10px",
              height: "25px",
              display: "flex",
              borderRadius: "5px",
              margin: "5px 0",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: "bold" }}>
              {arrowDirection} {amount?.toFixed(2) || "{amount}"}
            </span>
          </div>
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 10px",
              display: "flex",
              alignItems: "center",
              position: "relative",
            }}
          >
            <span style={{ fontSize: "24px", marginRight: "10px" }}>💳</span>
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              {database?.bank.toFixed(2) || "{bank}"}
            </span>
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

export default Transfer;
