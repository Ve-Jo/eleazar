const Leaderboard = ({
  interaction,
  users,
  currentPage,
  totalPages,
  highlightedPosition,
  width = 400,
  height = 755,
}) => {
  const usersPerPage = 10;

  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;

  if (!users) {
    let allUsers = Array(250)
      .fill()
      .map((_, index) => ({
        id: index + 1,
        name: `@user_${index + 1}`,
        balance: Math.floor(Math.random() * 10000),
        bank: Math.floor(Math.random() * 10000),
      }));

    users = allUsers.slice(startIndex, endIndex);
  }

  if (typeof highlightedPosition === "undefined") highlightedPosition = 1;
  let highlightedUser = users.find(
    (user, index) => startIndex + index + 1 === highlightedPosition
  );

  const isHighlightedUserOnCurrentPage = users.some(
    (user, index) => startIndex + index + 1 === highlightedPosition
  );

  const renderUserRow = (user, position, isHighlighted) => (
    <div
      key={user.id}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          color: "white",
          paddingLeft: "10px",
          backgroundColor: isHighlighted
            ? "rgba(255, 255, 255, 0.2)"
            : "transparent",
          border: isHighlighted ? "3px solid gold" : "none",
          borderBottom: isHighlighted ? "none" : "none",
          borderRadius: isHighlighted ? "10px 10px 0 0" : "0",
          width: "100%",
        }}
      >
        {!isHighlighted && (
          <div
            style={{
              marginRight: "10px",
              fontSize: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              minWidth: "24px",
              maxWidth: "24px",
            }}
          >
            {position}.
          </div>
        )}

        <div
          style={{
            display: "flex",
            backgroundColor:
              position === 1
                ? "gold"
                : position === 2
                ? "silver"
                : position === 3
                ? "#cd7f32"
                : !isHighlighted
                ? "rgba(255, 255, 255, 0.1)"
                : "transparent",
            borderRadius: isHighlighted
              ? "7px 7px 0px 0px"
              : position === startIndex
              ? "10px 10px 0px 0px"
              : position === endIndex - 1 && !isHighlighted
              ? "0px 0px 10px 10px"
              : "0px",
            marginLeft: isHighlighted ? "-10px" : "0px",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
            padding: "2px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0)",
              borderRadius: "10px",
              padding: "5px",
            }}
          >
            <div
              style={{
                marginRight: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={
                  user?.avatar ||
                  "https://cdn.discordapp.com/embed/avatars/0.png"
                }
                alt="User Avatar"
                width={40}
                height={40}
                style={{ borderRadius: "15%", display: "block" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  paddingRight: "10px",
                  fontWeight: "bold",
                  display: "flex",
                }}
              >
                {user.name}
              </div>
              {isHighlighted && (
                <div style={{ fontSize: "8px", display: "flex" }}>
                  #{user.id}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              display: "flex",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              marginRight: "10px",
              padding: "5px",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            ${user.totalBalance.toLocaleString()}
          </div>
        </div>
      </div>
      {isHighlighted && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            color: "white",
            backgroundColor: "#4791DB",
            borderRadius: "0 0 10px 10px",
            padding: "5px",
            border: "3px solid gold",
            borderTop: "none",
            marginTop: "-1px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              marginLeft: "5px",
              padding: "5px 10px",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                display: "flex",
                margin: "0",
              }}
            >
              {position}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              margin: "5px",
              padding: "5px 10px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginRight: "5px",
                display: "flex",
              }}
            >
              💳
            </div>
            <div style={{ fontSize: "18px", display: "flex" }}>
              ${user.bank.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              marginRight: "5px",
              padding: "5px 10px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginRight: "10px",
                display: "flex",
              }}
            >
              💰
            </div>
            <div style={{ fontSize: "18px", display: "flex" }}>
              ${user.balance.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        width: width,
        height: height,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          backgroundColor: "#1976d2",
          borderRadius: "15px",
          padding: "15px",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: height - 75,
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        {users.map((user, index) =>
          renderUserRow(
            user,
            startIndex + index + 1,
            startIndex + index + 1 === highlightedPosition
          )
        )}
        {!isHighlightedUserOnCurrentPage && highlightedUser && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ width: "100%", display: "flex" }}>
              {renderUserRow(highlightedUser, highlightedPosition, true)}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: "16px",
          display: "flex",
          marginTop: "10px",
          color: "white",
          borderRadius: "10px",
          padding: "5px",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 45,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            padding: "5px",
          }}
        >
          <span style={{ display: "flex" }}>Current page:</span>
          <div
            style={{
              fontWeight: "bold",
              backgroundColor: "orange",
              padding: "5px",
              borderRadius: "5px",
              marginLeft: "5px",
              color: "white",
              display: "flex",
            }}
          >
            {currentPage} / {totalPages}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            padding: "5px",
          }}
        >
          <span style={{ display: "flex" }}>Sort by:</span>
          <div
            style={{
              fontWeight: "bold",
              backgroundColor: "orange",
              padding: "5px",
              borderRadius: "5px",
              marginLeft: "5px",
              color: "white",
              display: "flex",
            }}
          >
            Total
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
