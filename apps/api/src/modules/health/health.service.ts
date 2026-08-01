import { env } from "@/config/env";

class HealthService {
  getHealth() {
    return {
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    };
  }
}

export const healthService = new HealthService();
