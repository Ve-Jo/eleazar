const ImageTemplate = ({ username }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      color: "black",
    }}
  >
    <h1>My First Web Page!</h1>
    <h2>You are a {username || "{username}"}</h2>
  </div>
);

export default ImageTemplate;
