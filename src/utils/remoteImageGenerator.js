import axios from "axios";

const MAX_RETRIES = 4;
const INITIAL_DELAY = 1500;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateRemoteImage(
  componentName,
  props,
  config,
  scaling
) {
  let retries = 0;

  while (true) {
    try {
      const locale = props.locale || "en";

      const sanitizedProps = JSON.parse(
        JSON.stringify(
          { ...props, locale }, // Include locale in props
          (_, value) => (typeof value === "bigint" ? value.toString() : value)
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
      retries++;

      if (retries > MAX_RETRIES) {
        console.error(
          "Max retries reached. Error generating remote image:",
          error
        );
        throw error;
      }

      const backoffDelay = INITIAL_DELAY * Math.pow(2, retries - 1);
      console.log(
        `Attempt ${retries} failed, retrying in ${
          backoffDelay / 1000
        } seconds...`
      );

      await delay(backoffDelay);
    }
  }
}
