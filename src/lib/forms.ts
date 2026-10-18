import type { z } from "zod";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  ok?: boolean;
} | null;

export function fromZodError(error: z.ZodError): FormState {
  return { error: "Please fix the highlighted fields.", fieldErrors: error.flatten().fieldErrors };
}
