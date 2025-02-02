const Transfer = (props) => {
  let { interaction, database, amount, isDeposit, i18n } = props;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(Transfer.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const arrowDirection = isDeposit ? "🔽" : "🔼";

  console.log(interaction);

  return (
    <div
      style={{
        width: "400px",
        height: "200px",
        backgroundColor: database.bannerUrl ? "rgba(0, 0, 0, 0.6)" : "#2196f3",
        borderRadius: database.bannerUrl ? "0px" : "20px",
        padding: "10px 20px 20px 20px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
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
            {isDeposit ? translations.deposit : translations.withdraw}
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
                interaction?.user?.avatarURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
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
              {database.economy.balance.toFixed(2) || "{balance}"}
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
              {arrowDirection} {translations.amount}:{" "}
              {amount?.toFixed(2) || "{amount}"}
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
              {database.economy.bankBalance.toFixed(2) || "{bank}"}
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
          #{interaction?.user?.id || "{id}"}
        </span>
        <span style={{ fontSize: "16px" }}>
          {interaction?.user?.username ||
            interaction?.user?.displayName ||
            "{username}"}
        </span>
      </div>
    </div>
  );
};

// Static translations object that will be synchronized
Transfer.localization_strings = {
  deposit: {
    en: "Deposit",
    ru: "Пополнение",
    uk: "Поповнення",
  },
  withdraw: {
    en: "Withdraw",
    ru: "Вывод",
    uk: "Вивід",
  },
  amount: {
    en: "Amount",
    ru: "Сумма",
    uk: "Сума",
  },
};

export default Transfer;
