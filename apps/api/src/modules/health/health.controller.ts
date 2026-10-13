import type { AppContext } from "@/types/context";

import { success } from "@/utils/response";

import { healthService } from "./health.service";

class HealthController {
  getHealth(c: AppContext) {
    const health = healthService.getHealth();
    return success(c, health);
  }
}

export const healthController = new HealthController();
