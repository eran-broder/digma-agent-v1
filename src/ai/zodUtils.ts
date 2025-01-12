import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchemaToZod } from "json-schema-to-zod";

//create a type that excludes a specific type
type ExcludeType<T, E> = T extends E ? never : T;
type NotString<T> = ExcludeType<T, string>;

function zodToJson(zodSchema: z.ZodType<any>) {
  const schema = zodToJsonSchema(zodSchema, { target: "openApi3" });
  return schema;
}

export type OurJsonSchema = ReturnType<typeof zodToJson>;
function jsonToZod(json: OurJsonSchema): z.ZodType<any> {
  const zodString = jsonSchemaToZod(json);
  const zodSchema = new Function("z", `return ${zodString}`)(z);
  return zodSchema as z.ZodType<any>;
}

type Numbers<
  N extends number,
  Arr extends unknown[] = [],
  Result = never
> = Arr["length"] extends N
  ? Result | `${N}`
  : Numbers<
      N,
      [...Arr, unknown],
      Result | `${Arr["length"] extends 0 ? never : Arr["length"]}`
    >;

type Names<K extends string, N extends number> = N extends 0
  ? never
  : `${K}${Numbers<N>}`;

type SchemaObject<K extends string, N extends number, T> = {
  [Key in Names<K, N>]: T;
};

function repeatedSchema<
  K extends string,
  N extends number,
  T extends z.ZodTypeAny
>(
  prefix: K,
  count: N,
  baseSchema: T
): {
  schema: z.ZodObject<SchemaObject<K, N, T>>;
  toArray: (obj: z.infer<z.ZodObject<SchemaObject<K, N, T>>>) => z.infer<T>[];
} {
  const obj: Record<string, z.ZodTypeAny> = {};
  for (let i = 1; i <= count; i++) {
    obj[`${prefix}${i}`] = baseSchema;
  }

  const schema = z.object(obj) as z.ZodObject<SchemaObject<K, N, T>>;

  const toArray = (input: z.infer<z.ZodObject<SchemaObject<K, N, T>>>) => {
    const result: z.infer<T>[] = [];
    for (let i = 1; i <= count; i++) {
      const key = `${prefix}${i}` as Names<K, N>;
      result.push(input[key]);
    }
    return result;
  };

  return { schema, toArray };
}

export const zutils = {
  zodToJson,
  jsonToZod,
  repeatedSchema,
};
