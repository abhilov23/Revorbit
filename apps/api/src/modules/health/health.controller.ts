import type {Context} from "hono";

import {success} from "@/utils/response";

import {healthService} from "./health.service";

class HealthController{
    getHealth(c: Context){
        const health = healthService.getHealth();
        return success(c, health);
    }
}

export const healthController = new HealthController();