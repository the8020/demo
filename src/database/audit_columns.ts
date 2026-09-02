import { columns, t } from "@the8020/db";

export const auditColumns = columns({
  createdAt: t.datetime().defaultNow(),
  updatedAt: t.datetime().defaultNow(),
});
