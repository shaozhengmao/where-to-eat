export async function onRequestGet() {
  return Response.json({ ok: true, service: "where-to-eat", requiresUserKey: true });
}
