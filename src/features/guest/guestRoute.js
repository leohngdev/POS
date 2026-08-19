import { useEffect, useState } from "react";

export function parseGuestRoute(hash) {
  const match = String(hash ?? "").match(/^#\/order(?:\/([^/?#]*))?\/?(?:\?.*)?$/);
  if (!match) return { isGuest: false, tableId: null };
  return { isGuest: true, tableId: match[1] || null };
}

export function useGuestRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return parseGuestRoute(hash);
}
