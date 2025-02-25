const Transfer = (props) => {
  let {
    interaction,
    database,
    amount,
    isDeposit,
    isTransfer,
    recipient,
    i18n,
    coloring,
  } = props;
  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring || {};

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(Transfer.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const mainBackground = database?.bannerUrl
    ? "transparent"
    : backgroundGradient;

  // Determine title based on operation type
  const title = isTransfer
    ? translations.transfer
    : isDeposit
    ? translations.deposit
    : translations.withdraw;

  return (
    <div
      style={{
        width: "400px",
        height: "260px",
        borderRadius: database?.bannerUrl ? "0px" : "20px",
        padding: "20px",
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        background: mainBackground,
      }}
    >
      {/* Banner Background */}
      {database?.bannerUrl && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <img
            src={database.bannerUrl}
            alt="Banner"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: "blur(8px)",
              transform: "scale(1.1)",
              display: "flex",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
        }}
      >
        <div
          style={{
            width: "260px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <img
              src={
                interaction?.guild?.iconURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="Guild Icon"
              width={24}
              height={24}
              style={{ borderRadius: "5px", display: "flex" }}
            />
            <h2
              style={{
                margin: "0",
                fontSize: "24px",
                display: "flex",
                color: textColor,
              }}
            >
              {title}
            </h2>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "10px",
              gap: "5px",
            }}
          >
            {/* Wallet Balance */}
            <div
              style={{
                display: "flex",
                backgroundColor: overlayBackground,
                borderRadius: "10px 10px 10px 0",
                padding: "5px 15px",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "150px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  marginRight: "15px",
                }}
              >
                💵
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    color: secondaryTextColor,
                    opacity: "0.8",
                  }}
                >
                  {translations.wallet || "WALLET"}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: textColor,
                  }}
                >
                  {database.economy.balance.toFixed(2) || "{balance}"}
                </div>
              </div>
            </div>

            {/* Transfer Amount */}
            <div
              style={{
                display: "flex",
                backgroundColor: isDeposit
                  ? "rgba(76, 175, 80, 0.3)"
                  : isTransfer
                  ? "rgba(33, 150, 243, 0.3)"
                  : "rgba(218, 165, 32, 0.3)",
                borderRadius: "0 8px 8px 0",
                padding: "3px 12px",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "130px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "20px",
                  marginRight: "10px",
                }}
              >
                {isDeposit ? "🔽" : isTransfer ? "🔽" : "🔼"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "12px",
                    color: secondaryTextColor,
                    opacity: "0.8",
                  }}
                >
                  {translations.amount || "AMOUNT"}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "22px",
                    fontWeight: "bold",
                    color: textColor,
                  }}
                >
                  {amount?.toFixed(2) || "{amount}"}
                </div>
              </div>
            </div>

            {/* Bank Balance or Recipient Balance */}
            <div
              style={{
                display: "flex",
                backgroundColor: overlayBackground,
                borderRadius: "0 10px 10px 10px",
                padding: "5px 15px",
                alignItems: "center",
                alignSelf: "flex-start",
                minWidth: "150px",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  marginRight: "15px",
                }}
              >
                {isTransfer ? "💵" : "💳"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    color: secondaryTextColor,
                    opacity: "0.8",
                  }}
                >
                  {isTransfer
                    ? `${translations.balance || "BALANCE"} @${
                        recipient?.username || "{username}"
                      }`
                    : translations.bank || "BANK"}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: textColor,
                  }}
                >
                  {isTransfer
                    ? recipient?.balance?.toFixed(2) || "{balance}"
                    : database.economy.bankBalance.toFixed(2) || "{bank}"}
                </div>
              </div>

              {/* Recipient Avatar (only for transfers) */}
              {isTransfer && recipient && (
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    top: "-15px",
                    right: "-15px",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid rgba(255, 255, 255, 0.5)",
                    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <img
                    src={
                      recipient.avatarURL ||
                      "https://cdn.discordapp.com/embed/avatars/0.png"
                    }
                    alt="Recipient"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Avatar */}
        <div
          style={{
            display: "flex",
            width: "110px",
            height: "110px",
            borderRadius: "25px",
            overflow: "hidden",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            position: "absolute",
            top: "5px",
            right: "5px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={
                interaction?.user?.avatarURL ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt="User"
              width="110"
              height="110"
              style={{
                objectFit: "cover",
                borderRadius: "25px",
                display: "flex",
              }}
            />
          </div>
        </div>
      </div>

      {/* User Info */}
      <div
        style={{
          position: "absolute",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          bottom: "10%",
          right: "6%",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "16px",
            color: textColor,
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          {interaction?.user?.username ||
            interaction?.user?.displayName ||
            "{username}"}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "12px",
            opacity: "0.4",
            color: tertiaryTextColor,
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          #{interaction?.user?.id || "{id}"}
        </div>
      </div>
    </div>
  );
};

Transfer.dimensions = {
  width: 400,
  height: 260,
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
  transfer: {
    en: "Transfer",
    ru: "Перевод",
    uk: "Переказ",
  },
  amount: {
    en: "Amount",
    ru: "Сумма",
    uk: "Сума",
  },
  wallet: {
    en: "WALLET",
    ru: "КОШЕЛЁК",
    uk: "ГАМАНЕЦЬ",
  },
  bank: {
    en: "BANK",
    ru: "БАНК",
    uk: "БАНК",
  },
  balance: {
    en: "BALANCE",
    ru: "БАЛАНС",
    uk: "БАЛАНС",
  },
};

export default Transfer;
