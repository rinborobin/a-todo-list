/**
 * The server posts to whatever address a push subscription names, so only the
 * push services browsers really use are accepted. Anything else could point
 * the server at an internal address.
 */
const PUSH_HOSTS = [
  /(^|\.)push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

const MAX_ENDPOINT_LENGTH = 2048;

export function isPushServiceEndpoint(value: string): boolean {
  if (!value || value.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password || url.port) return false;
  return PUSH_HOSTS.some((host) => host.test(url.hostname));
}
