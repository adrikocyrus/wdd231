import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server } from "node:http";
import { parse } from "cookie";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { AuthUser } from "./auth";

declare module "socket.io" {
  interface SocketData {
    user: AuthUser;
  }
}

export async function attachRealtime(server: Server) {
  const publisher = new Redis(config.redisUrl);
  const subscriber = publisher.duplicate();
  const io = new SocketServer(server, {
    cors: { origin: config.frontendOrigin, credentials: true },
    transports: ["websocket", "polling"]
  });
  io.adapter(createAdapter(publisher, subscriber));
  io.use(async (socket, next) => {
    try {
      const token = parse(socket.handshake.headers.cookie ?? "").crms_token;
      if (!token) return next(new Error("Authentication required"));
      const payload = jwt.verify(token, config.jwtSecret);
      if (typeof payload === "string" || typeof payload.id !== "string" ||
          (payload.role !== "ADMIN" && payload.role !== "TECHNICIAN" && payload.role !== "CUSTOMER")) {
        return next(new Error("Invalid authentication token"));
      }
      socket.data.user = { id: payload.id, role: payload.role };
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });
  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(user.role === "CUSTOMER" ? `customer:${user.id}` : "staff");
  });
  return {
    io,
    async close() {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.all([publisher.quit(), subscriber.quit()]);
    }
  };
}
