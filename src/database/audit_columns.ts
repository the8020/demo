import { columns, t } from "/p/the8020/db/mod.ts";

export const auditColumns = columns({
  createdAt: t.datetime().defaultNow(),
  updatedAt: t.datetime().defaultNow(),
});
