// Start of Selection
const Crime = ({ interaction, victim, robber, amount, success }) => {
  let victimUser = victim?.user || { id: "{id}", username: "{username}" };
  let robberUser = robber?.user ||
    interaction?.user || { id: "{id}", username: "{username}" };

  /*victim = { balance: 370 };
  robber = { balance: 370 };
  victimUser.id = "1234567890";
  robberUser.id = "1234567891";
  amount = 1000;
  success = true;*/

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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              backgroundColor: "#4CAF50",
              borderRadius: "10px",
              padding: "5px 10px",
              marginBottom: "5px",
            }}
          >
            Victim
          </div>
          <div
            style={{
              width: "80px",
              height: "120px",
              borderRadius: "15px",
              overflow: "hidden",
              backgroundColor: "#1565c0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                victimUser.displayAvatarURL?.({
                  extension: "png",
                  size: 256,
                }) || // Added size: 2048
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Victim"
              width="80"
              height="120"
              style={{ objectFit: "cover", borderRadius: "15px" }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: "0px",
              left: "95px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 25px 5px 10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              💵 {victim?.balance.toFixed(2) || "{balance}"}
            </span>
            {(success || !success) && (
              <span
                style={{
                  position: "absolute",
                  right: "5px",
                  top: "8px",
                  fontSize: "16px",
                  color: success ? "#C66161" : "#6EE78C",
                  fontWeight: "bold",
                }}
              >
                {success ? "-" : "+"}
                {amount?.toFixed(2) || "{amount}"}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              backgroundColor: "#F44336",
              borderRadius: "10px",
              padding: "5px 10px",
              marginBottom: "5px",
            }}
          >
            Robber
          </div>
          <div
            style={{
              width: "80px",
              height: "120px",
              borderRadius: "15px",
              overflow: "hidden",
              backgroundColor: "#1565c0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                robberUser.displayAvatarURL?.({
                  extension: "png",
                  size: 256,
                }) || // Added size: 2048
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Robber"
              width="80"
              height="120"
              style={{ objectFit: "cover", borderRadius: "15px" }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "0px",
              right: "95px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              padding: "5px 25px 5px 10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              💵 {robber?.balance.toFixed(2) || "{balance}"}
            </span>
            {(success || !success) && (
              <span
                style={{
                  position: "absolute",
                  right: "5px",
                  top: "8px",
                  fontSize: "16px",
                  color: success ? "#6EE78C" : "#C66161",
                  fontWeight: "bold",
                }}
              >
                {success ? "+" : "-"}
                {amount?.toFixed(2) || "{amount}"}
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          bottom: "-5px",
        }}
      >
        <span style={{ fontSize: "10px", opacity: "0.3" }}>
          #{victimUser.id}
        </span>
        <span
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: success ? "#6EE78C" : "#FF6B6B",
          }}
        >
          {success ? "Successful Crime" : "Failed Crime"}
        </span>
        <span style={{ fontSize: "10px", opacity: "0.3" }}>
          #{robberUser.id}
        </span>
      </div>
    </div>
  );
};

export default Crime;
