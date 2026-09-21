export function msUntilJakartaNightRefresh() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(new Date()).reduce<Record<string, number>>((result, part) => {
    if (part.type !== "literal") result[part.type] = Number(part.value);
    return result;
  }, {});
  const tonightUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 14, 0, 0);
  const nextRefresh = tonightUtc > Date.now() ? tonightUtc : tonightUtc + 86_400_000;
  return Math.max(60_000, nextRefresh - Date.now());
}