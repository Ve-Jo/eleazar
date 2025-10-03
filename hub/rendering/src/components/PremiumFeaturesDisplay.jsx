const PremiumFeaturesDisplay = (props) => {
  let { features, plans, height = 650, width = 950 } = props;

  if (!features)
    features = [
      {
        title: "24/7 Music Player",
        description: "Keep your music playing `non-stop`",
      },
      {
        title: "Database Management",
        description: "Full control over all data in the database",
      },
      {
        title: "Support Role",
        description: "Get a special support role on our server",
      },
      {
        title: "AI Image Generation",
        description: "Generate `beatiful images` with AI",
      },
      {
        title: "Voice-to-Text",
        description: "Voice messages on this server get `transcription by AI`",
      },
      {
        title: "Banners",
        description:
          "Set a banner for any command that will add new customization for `cool-looking commands`",
      },
    ];

  if (!plans)
    plans = [
      { name: "1 month", price: "$4.50", discount: "" },
      { name: "3 months", price: "$12.00", discount: "-11%" },
    ];

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
        flexDirection: "row",
        justifyContent: "space-between",
        position: "relative",
        overflowY: "auto",
      }}
    >
      <div style={{ width: "68%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: "40px",
            fontWeight: "bold",

            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          Plus subscription (WorkInProgress)
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                borderRadius: "10px",
                padding: "10px",
                marginBottom: "10px",
                width: "48%",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  fontSize: "16px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                {feature.description.split("`").map((part, index) =>
                  index % 2 === 0 ? (
                    <span key={index} style={{ marginRight: "4px" }}>
                      {part}
                    </span>
                  ) : (
                    <span
                      key={index}
                      style={{
                        backgroundColor: "#FFA500",
                        color: "white",
                        padding: "2px 4px",
                        marginRight: "4px",
                        marginBottom: "2px",
                        borderRadius: "4px",
                        display: "flex",
                        flexShrink: 0,
                      }}
                    >
                      {part}
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
            }}
          >
            {plans.map((plan, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  borderRadius: "10px",
                  padding: "10px",
                  textAlign: "center",
                  width: "45%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    display: "flex",
                    padding: "5px",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <div>{plan.name}</div>
                  {plan.discount && (
                    <div
                      style={{
                        backgroundColor: "#FFA500",
                        padding: "5px",
                        borderRadius: "10px",
                        fontSize: "16px",
                        color: "#FFFFFF",
                      }}
                    >
                      {plan.discount}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "10px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#FFA500",
                      padding: "10px",
                      borderRadius: "10px",
                      fontSize: "52px",
                      color: "#FFFFFF",
                      marginTop: "5px",
                      display: "flex",
                    }}
                  >
                    {plan.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "35%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "20px",
        }}
      >
        <img
          src="https://cdn.discordapp.com/avatars/1282077041797365760/1e675ba60325f151e65ff347d7303d53.png?size=512"
          alt="Premium Features"
          width={256}
          height={256}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: "15%",
          }}
        />
      </div>
    </div>
  );
};

PremiumFeaturesDisplay.dimensions = {
  width: 950,
  height: 650,
};

export default PremiumFeaturesDisplay;
