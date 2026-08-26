import { defineService, z } from "@platform/http";
import { greeting } from "@packages/core/example1/src/greeting.ts";

const service = defineService();

service.get(
  "/value/:value",
  {
    summary: "Return a path variable through a cross-package helper",
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
      package: "core/example2",
      value: params.value,
      message: greeting("example2", params.value),
    }),
);

export default service;
