import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config";

export type Role = "ADMIN" | "TECHNICIAN" | "CUSTOMER";
export type AuthUser = { id: string; role: Role; exp?: number; iat?: number };

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    if (request.user.exp && request.user.exp - Math.floor(Date.now() / 1000) < 600) {
      const token = request.server.jwt.sign(
        { id: request.user.id, role: request.user.role },
        { expiresIn: "15m" }
      );
      reply.setCookie("crms_token", token, {
        httpOnly: true,
        secure: config.secureCookies,
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60
      });
    }
  } catch {
    return reply.code(401).send({ error: "Authentication required" });
  }
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "You do not have permission to perform this action" });
    }
  };
}
