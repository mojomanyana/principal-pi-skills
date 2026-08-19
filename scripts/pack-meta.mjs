/** Normalize `npm pack --json` across npm 10/11 (array) and npm 12 (package-keyed object). */
export function parsePackMetadata(output) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new Error(`npm pack did not return valid JSON: ${error.message}`);
  }
  const meta = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  if (!meta || typeof meta !== "object" || !Array.isArray(meta.files) || typeof meta.filename !== "string") {
    throw new Error("npm pack JSON contained no usable package metadata");
  }
  return meta;
}
