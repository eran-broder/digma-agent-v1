import { z } from "zod";
import { zutils } from "../common/zodUtils.js";

export function zodSchemaToSchema(schema: z.ZodType<any, any, any>) {
  return zutils.zodToJson(schema);
}
