import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/index";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import { nanoid } from "nanoid";

const DO_API = "https://api.digitalocean.com/v2";

/** Retrieves the DigitalOcean API token stored in app settings */
async function getDoToken(): Promise<string | null> {
  const [setting] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "do_api_token"))
    .limit(1);
  return setting?.value ?? null;
}

/**
 * Registers DigitalOcean integration routes.
 * Requires a stored DO API token in settings (key: do_api_token).
 */
export async function digitalOceanRoutes(app: FastifyInstance): Promise<void> {
  /** List all DigitalOcean droplets using the stored API token */
  app.get("/api/do/droplets", { preHandler: authenticate }, async (_request, reply) => {
    const token = await getDoToken();
    if (!token) {
      return reply.code(400).send({
        success: false,
        error: "DigitalOcean API token not configured. Add it in Settings.",
      });
    }

    const res = await fetch(`${DO_API}/droplets`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return reply.code(res.status).send({ success: false, error: `DO API error: ${res.statusText}` });
    }

    const data = (await res.json()) as { droplets: unknown[] };
    return reply.send({ success: true, data: data.droplets ?? [] });
  });

  /**
   * Create an SSH deploy target from a DigitalOcean droplet.
   * Uses the droplet's public IPv4. SSH key auth must be configured separately.
   */
  app.post("/api/do/droplets/:id/create-target", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const token = await getDoToken();
    if (!token) {
      return reply.code(400).send({
        success: false,
        error: "DigitalOcean API token not configured.",
      });
    }

    const res = await fetch(`${DO_API}/droplets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      droplet?: {
        name: string;
        networks: { v4: Array<{ ip_address: string; type: string }> };
      };
    };

    if (!data.droplet) {
      return reply.code(404).send({ success: false, error: "Droplet not found" });
    }

    const droplet = data.droplet;
    const publicIp = droplet.networks.v4.find((n) => n.type === "public")?.ip_address;
    if (!publicIp) {
      return reply.code(400).send({ success: false, error: "Droplet has no public IP" });
    }

    const body = request.body as { username?: string; remotePath?: string; webUrl?: string };
    const targetId = nanoid();

    await db.insert(schema.deployTargets).values({
      id: targetId,
      name: `DO — ${droplet.name}`,
      host: publicIp,
      port: 22,
      username: body.username ?? "root",
      authType: "key",
      remotePath: body.remotePath ?? "/var/www/html",
      webUrl: body.webUrl ?? null,
    });

    return reply.code(201).send({
      success: true,
      data: { id: targetId, name: `DO — ${droplet.name}`, host: publicIp },
    });
  });
}
