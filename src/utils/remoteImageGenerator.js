import axios from "axios";

export async function generateRemoteImage(
  componentName,
  props,
  config,
  scaling
) {
  try {
    // Convert any BigInt values to strings before sending
    const sanitizedProps = JSON.parse(
      JSON.stringify(props, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    const response = await axios.post(
      `${process.env.IMAGE_SERVER_URL}/generate`,
      {
        componentName,
        props: sanitizedProps,
        config,
        scaling,
      },
      {
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    console.error("Error generating remote image:", error);
    throw error;
  }
}
