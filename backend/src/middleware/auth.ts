import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";

/**
 * Verifies the JWT on each request and confirms the user account is active.
 * Returns 401 if the token is invalid or the account has been deactivated.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as { id: string; email: string; role: string };

    // Check that the account is still active
    const [user] = await db
      .select({ active: schema.users.active })
      .from(schema.users)
      .where(eq(schema.users.id, payload.id))
      .limit(1);

    if (user && user.active === false) {
      reply.code(401).send({ success: false, error: "Account deactivated" });
    }
  } catch {
    reply.code(401).send({ success: false, error: "Unauthorized" });
  }
}

/**
 * Middleware that requires admin role.
 * Calls authenticate first, then checks the role claim in the JWT.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply);
  const user = request.user as { role?: string };
  if (user?.role !== "admin") {
    reply.code(403).send({ success: false, error: "Admin access required" });
  }
}
