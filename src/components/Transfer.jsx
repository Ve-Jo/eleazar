const Transfer = ({ interaction, database, amount, isDeposit }) => {
  const user =
    interaction?.options.getMember("user") || interaction?.user || false;

  const arrowDirection = isDeposit ? "→" : "←";

  const leftGradient = isDeposit
    ? "linear-gradient(to right, #F44336, #8B0000)"
    : "linear-gradient(to right, #4CAF50, #006400)";

  const rightGradient = isDeposit
    ? "linear-gradient(to left, #4CAF50, #006400)"
    : "linear-gradient(to left, #F44336, #8B0000)";

  return (
    <div
      style={{
        width: "450px",
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
          <h2 style={{ margin: "0", fontSize: "24px" }}>
            {isDeposit ? "Deposit" : "Withdraw"}
          </h2>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "#1565c0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                user
                  ? user?.displayAvatarURL({ extension: "png" })
                  : "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="User"
              width="50"
              height="50"
              style={{ objectFit: "cover", borderRadius: "25%" }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "10px",
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              position: "relative",
              zIndex: 1,
            }}
          >
            <span style={{ fontSize: "18px" }}>Balance</span>
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px 10px 0 0",
                padding: "5px 10px",
                marginTop: "5px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "24px", fontWeight: "bold" }}>
                💵 {database?.balance.toFixed(2) || "{balance}"}
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: -10,
                height: "10px",
                width: "100%",
                borderRadius: "0 0 10px 10px",
                background: leftGradient,
              }}
            />
          </div>
          <div
            style={{
              width: "50px",
              height: "50px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              margin: "0",
              zIndex: 1,
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              {arrowDirection}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              position: "relative",
              zIndex: 1,
            }}
          >
            <span style={{ fontSize: "18px" }}>Bank</span>
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px 10px 0 0",
                padding: "5px 10px",
                marginTop: "5px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "24px", fontWeight: "bold" }}>
                💳 {database?.bank.toFixed(2) || "{bank}"}
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: -10,
                height: "10px",
                width: "100%",
                borderRadius: "0 0 10px 10px",
                background: rightGradient,
              }}
            />
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
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
