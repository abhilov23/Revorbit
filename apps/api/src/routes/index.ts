import {Hono} from "hono";
import healthRouter from "./health";

const routes = new Hono();

routes.route("/health", healthRouter);

export default routes;