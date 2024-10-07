const Balance = ({ interaction, database }) => {
  const user =
    interaction?.options.getMember("user") || interaction?.user || false;

  console.log(JSON.stringify(user, null, 2));

  return (
    <div
      style={{
        width: "400px",
        height: "200px",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "20px",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h2 style={{ margin: "0", fontSize: "24px" }}>Balance</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px",
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "28px", marginRight: "10px" }}>💵</span>
              <span style={{ fontSize: "28px", fontWeight: "bold" }}>
                {database?.balance.toFixed(2) || "{balance}"}
              </span>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px",
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "28px", marginRight: "10px" }}>💳</span>
              <span style={{ fontSize: "28px", fontWeight: "bold" }}>
                {database?.bank.toFixed(2) || "{bank}"}
              </span>
            </div>
          </div>
        </div>
        <div
          style={{
            width: "110px",
            height: "110px",
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
              user
                ? user?.displayAvatarURL({ extension: "png" })
                : "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User"
            width="110"
            height="110"
            style={{ objectFit: "cover", borderRadius: "25px" }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
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

export default Balance;
