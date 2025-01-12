import { z } from "zod";
import { zodSchemaToSchema } from "./toolToFunction.js";

export interface Tool<
  TArgument extends z.ZodTypeAny = z.ZodTypeAny,
  TResult extends z.ZodTypeAny = z.ZodTypeAny
> {
  name(): string;
  description(): string;
  argumentSchema(): TArgument;
  resultSchema(): TResult;
  readonly execute: (argument: z.infer<TArgument>) => Promise<z.infer<TResult>>;
  toJSON(): any;
}

//TODO: DRY!!!!
export interface StaticToolArgs<
  TArgument extends z.ZodTypeAny,
  TResult extends z.ZodTypeAny
> {
  name: string;
  description: string;
  argumentSchema: TArgument;
  resultSchema: TResult;
  execute: (argument: z.infer<TArgument>) => Promise<z.infer<TResult>>;
}

//create a dynamic tool interface that accepts the right callbacks
export interface DynamicToolArgs<
  TArgument extends z.ZodTypeAny,
  TResult extends z.ZodTypeAny
> {
  name: () => string;
  description: () => string;
  argumentSchema: () => TArgument;
  resultSchema: () => TResult;
  execute: (argument: z.infer<TArgument>) => Promise<z.infer<TResult>>;
}

function toolToJson<
  TArgument extends z.ZodTypeAny,
  TResult extends z.ZodTypeAny
>(tool: StaticToolArgs<TArgument, TResult>) {
  return {
    name: tool.name,
    description: tool.description,
    argumentSchema: zodSchemaToSchema(tool.argumentSchema),
    resultSchema: zodSchemaToSchema(tool.resultSchema),
  };
}

export const createDynamicTool = <
  TArgument extends z.ZodTypeAny,
  TResult extends z.ZodTypeAny
>(
  args: DynamicToolArgs<TArgument, TResult>
): Tool => {
  return {
    name: args.name,
    description: args.description,
    argumentSchema: args.argumentSchema,
    resultSchema: args.resultSchema,
    execute: args.execute,
    toJSON: () =>
      toolToJson({
        name: args.name(),
        description: args.description(),
        argumentSchema: args.argumentSchema(),
        resultSchema: args.resultSchema(),
        execute: args.execute,
      }),
  };
};

export const createStaticTool = <
  TArgument extends z.ZodSchema,
  TResult extends z.ZodSchema
>(
  args: StaticToolArgs<TArgument, TResult>
): Tool => {
  //call the create dynamic with the right args
  return createDynamicTool({
    name: () => args.name,
    description: () => args.description,
    argumentSchema: () => args.argumentSchema,
    resultSchema: () => args.resultSchema,
    execute: args.execute,
  });
};

export const createStaticToolTyped = <
  TArgument extends z.ZodSchema,
  TResult extends z.ZodSchema
>(
  args: StaticToolArgs<TArgument, TResult>
) => {
  const theTool = {
    name: () => args.name,
    description: () => args.description,
    argumentSchema: () => args.argumentSchema,
    resultSchema: () => args.resultSchema,
    execute: args.execute,
    toJSON: () => toolToJson(args),
  };

  return { ...theTool, generalize: () => theTool as Tool };
};

export type GeneralTool = Tool<z.ZodTypeAny, z.ZodTypeAny>;
