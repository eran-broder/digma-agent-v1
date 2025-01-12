import { z } from "zod";
import { dedent } from "ts-dedent";

// Basic input validation schemas
export const querySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  query: z.string().min(1, "Query is required"),
  ormFramework: z.string().nullable().optional(),
  instrumentationLibrary: z
    .string()
    .min(1, "Instrumentation library is required"),
});

// Source schema for search results
export const sourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
});

// Core recommendation structure
const baseRecommendationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  priority: z.enum(["high", "medium", "low"]),
  description: z.string().min(1, "Description is required"),
  actionItems: z
    .array(z.string())
    .min(1, "At least one action item is required"),
  modifiedCode: z
    .string()
    .nullable()
    .optional()
    .describe(
      dedent`This is not "code" per se, but a modification to the software element presented in the input. 
      can be lines of code. 
      can be query. 
      can be statement
      put here the best change that can be made to the input to improve the performance of the software element.`
    ),
  searchTerms: z.array(
    z
      .string()
      .describe(
        "This search term must be extremely specific to the context of the recommendation. use natural language. this will be "
      )
  ),
});

// Extended recommendation with sources
export const recommendationSchema = baseRecommendationSchema.extend({
  sources: z.array(sourceSchema),
});

// Analysis output schemas
export const baseAnalysisSchema = z.object({
  recommendations: z
    .array(baseRecommendationSchema)
    .min(1, "At least one recommendation is required"),
});

export const analysisSchema = z.object({
  recommendations: z
    .array(recommendationSchema)
    .min(1, "At least one recommendation is required"),
});

// Type exports
export type Query = z.infer<typeof querySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type BaseRecommendation = z.infer<typeof baseRecommendationSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type BaseAnalysis = z.infer<typeof baseAnalysisSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
