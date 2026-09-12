/// The optional "just these days" on a copy request.
///
/// A body is optional and may be anything — this is a public endpoint and
/// the reader is a stranger — so a malformed one means "all of it" rather
/// than an error. Day numbers are the source trip's own indexes.
export async function requestedDays(request: Request): Promise<number[] | undefined> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return undefined;

  const days = (body as { days?: unknown }).days;
  if (!Array.isArray(days)) return undefined;

  const clean = days.filter(
    (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0,
  );
  return clean.length > 0 ? clean : undefined;
}
