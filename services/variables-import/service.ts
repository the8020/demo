import { defineService, z } from "@the8020/http";
import { greeting } from "@packages/the8020/demo/src/greeting.ts";

const service = defineService();

service.get(
  "/value/:value",
  {
    summary: "Return a path variable through a shared package helper",
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
      package: "the8020/demo",
      value: params.value,
      message: greeting("variables-import", params.value),
    }),
);

export default service;
