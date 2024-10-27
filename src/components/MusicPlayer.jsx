const MusicPlayer = ({
  currentSong,
  previousSong,
  nextSongs,
  queueLength,
  currentTime,
  duration,
  userAvatar,
  width = 525,
  height = 200,
}) => {
  const defaultAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";

  // Example variables
  const exampleCurrentSong = {
    title: "Example Song Long Name",
    artist: "Artist Name",
    thumbnail: defaultAvatar,
    addedBy: "User1",
    addedByAvatar: defaultAvatar,
    duration: 271,
  };
  const examplePreviousSong = /*{
    title: "Previous Song Title",
    duration: 232,
    thumbnail: defaultAvatar,
    addedBy: "User2",
    addedByAvatar: defaultAvatar,
  };*/ undefined;
  const exampleNextSongs = /*[
    {
      title: "Next Song Title 1",
      duration: 192,
      thumbnail: defaultAvatar,
      addedBy: "User3",
      addedByAvatar: defaultAvatar,
    },
    {
      title: "Next Song Title 2",
      duration: 215,
      thumbnail: defaultAvatar,
      addedBy: "User4",
      addedByAvatar: defaultAvatar,
    },
    {
      title: "Next Song Title 3",
      duration: 203,
      thumbnail: defaultAvatar,
      addedBy: "User5",
      addedByAvatar: defaultAvatar,
    },
    {
      title: "Next Song Title 4",
      duration: 203,
      thumbnail: defaultAvatar,
      addedBy: "User6",
      addedByAvatar: defaultAvatar,
    },
    {
      title: "Next Song Title 5",
      duration: 203,
      thumbnail: defaultAvatar,
      addedBy: "User6",
      addedByAvatar: defaultAvatar,
    },
    /*{
      title: "Next Song Title 6",
      duration: 203,
      thumbnail: defaultAvatar,
      addedBy: "User6",
      addedByAvatar: defaultAvatar,
    },
  ];*/ undefined;

  // Use provided values or fallback to example values
  console.log(currentSong, previousSong, nextSongs);

  currentSong = currentSong || exampleCurrentSong;
  previousSong = previousSong || examplePreviousSong;
  nextSongs = nextSongs || exampleNextSongs;
  queueLength = (queueLength || (nextSongs ? nextSongs.length : 0)) + 1; // +2 for current and previous
  currentTime = currentTime || 32;
  duration = duration || currentSong.duration;
  userAvatar = userAvatar || defaultAvatar;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const renderSongThumbnails = (previousSong, nextSongs) => {
    if (!previousSong && (!nextSongs || nextSongs.length === 0)) {
      return null;
    }

    const allSongs = previousSong
      ? [previousSong, ...(nextSongs || []).slice(0, 4)]
      : (nextSongs || []).slice(0, 5);
    const thumbnailWidth = 120;
    const overlap = 35;

    console.log(allSongs);

    return allSongs.map((song, index) => {
      const isPrevious = previousSong && index === 0;
      let leftOffset = 0;

      if (previousSong && nextSongs && nextSongs.length <= 5) {
        // Place both previous and next song to the left
        leftOffset = index * (thumbnailWidth - overlap);
      } else {
        if (nextSongs) {
          leftOffset =
            width -
            (allSongs.length - index + (6 - nextSongs.length)) *
              (thumbnailWidth - overlap) -
            15;
        }
      }

      const opacity = isPrevious ? 0.3 : 1; // Adjust opacity based on index

      return (
        <div
          key={index}
          style={{
            width: `${thumbnailWidth}px`,
            height: "80px",
            position: "absolute",
            left: `${leftOffset}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: opacity,
          }}
        >
          <div
            style={{
              width: "100px",
              height: "50px",
              borderRadius: "10px",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0, 0, 0, 0)",
            }}
          >
            <img
              src={song.thumbnail}
              alt={`${song.title} thumbnail`}
              width={100}
              height={50}
              style={{
                objectFit: "cover",
                borderRadius: "10px",
                /*border: "3px solid #2196f3",*/
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: "-8px",
              left: "3px",
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              /*border: "3px solid #2196f3",*/
            }}
          >
            <img
              src={song.addedByAvatar}
              alt={`${song.addedBy} avatar`}
              width={30}
              height={30}
              style={{
                objectFit: "cover",
                borderRadius: "10px",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "0",
              left: "10px",
              width: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.0)",
              color: "white",
              padding: "4px",
              fontSize: "10px",
              borderRadius: "0 0 10px 10px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
              }}
            >
              {song.title}
            </span>
            <span style={{ display: "flex" }}>{formatTime(song.duration)}</span>
          </div>
        </div>
      );
    });
  };

  const progressPercentage = (currentTime / duration) * 100;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: "20px",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Blurred background */}
      <img
        src={currentSong.thumbnail}
        alt="Background"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "20px",
          opacity: 1,
        }}
      />

      {/* Overlay to ensure text readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
        }}
      />

      <div
        style={{
          padding: "15px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Current Song */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
              }}
            >
              {currentSong.title}
            </div>
            <div
              style={{
                fontSize: "18px",
                opacity: 0.8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
              }}
            >
              {currentSong.artist}
            </div>
          </div>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "12px",
              overflow: "hidden",
              marginLeft: "15px",
              display: "flex",
            }}
          >
            <img
              src={userAvatar}
              alt="User Avatar"
              width={60}
              height={60}
              style={{
                objectFit: "cover",
                borderRadius: "15px",
              }}
            />
          </div>
        </div>

        {/* Queue */}
        <div
          style={{
            height: "80px",
            position: "relative",
            display: "flex",
            marginBottom: "15px",
          }}
        >
          {renderSongThumbnails(previousSong, nextSongs)}

          {/* More songs indicator */}
          {queueLength > 5 && (
            <div
              style={{
                fontSize: "14px",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                padding: "4px 8px",
                borderRadius: "10px",
                display: "flex",
                height: "45px",
                position: "absolute",
                right: "-5px",
                bottom: "32px",
                justifyContent: "center",
                alignItems: "center",
                maxWidth: "40px",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              +{queueLength - 6 + (previousSong ? 1 : 0)}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          height: "25px",
          backgroundColor: "rgba(255, 255, 255, 0.3)",
          borderRadius: "0 0 20px 20px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "0 15px",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "0",
            top: "0",
            bottom: "0",
            width: `${progressPercentage}%`,
            backgroundColor: "white",
            borderRadius: "0 0 0 20px",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            zIndex: "1",
            fontSize: "14px",
          }}
        >
          <span style={{ color: "rgba(0, 0, 0, 0.5)", display: "flex" }}>
            {formatTime(currentTime)}
          </span>
          <span style={{ color: "rgba(0, 0, 0, 0.5)", display: "flex" }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
