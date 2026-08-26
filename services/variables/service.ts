import { defineService, z } from "@platform/http";
import { greeting } from "../../src/greeting.ts";

const service = defineService();

service.get(
  "/value/:value",
  {
    summary: "Return a path variable",
    params: z.object({ value: z.string().min(1) }),
    responses: {
      200: z.object({
        package: z.string(),
        value: z.string(),
        message: z.string(),
      }),
    },
  },
  ({ params }) =>
    Response.json({
      package: "core/example1",
      value: params.value,
      message: greeting("example1", params.value),
    }),
);

export default service;
