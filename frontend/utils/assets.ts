const rawBaseUrl = String(import.meta.env.BASE_URL || "/").trim();

const normalizedBaseUrl =
  rawBaseUrl === "/"
    ? "/"
    : rawBaseUrl.endsWith("/")
      ? rawBaseUrl
      : `${rawBaseUrl}/`;

export function resolveStaticAssetPath(path: string) {
  if (!path) {
    return path;
  }

  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  if (path.startsWith("/uploads/")) {
    return path;
  }

  if (path.startsWith("/tutorial/") || path.startsWith("tutorial/")) {
    const relativePath = path.replace(/^\/+/, "");
    return `${normalizedBaseUrl}${relativePath}`;
  }

  return path;
}