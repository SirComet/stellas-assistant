import type { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ success: false, error: "Unauthorized" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const user = request.user as { role: string };
    if (user.role !== "admin") {
      reply.code(403).send({ success: false, error: "Forbidden: Admin access required" });
    }
  } catch {
    reply.code(401).send({ success: false, error: "Unauthorized" });
  }
}
