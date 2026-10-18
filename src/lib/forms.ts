import type { z } from "zod";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  ok?: boolean;
  // What the user submitted, echoed back on error so fields can be refilled
  // (React resets forms after every action). Filled in client-side by useFormAction.
  values?: Record<string, string>;
} | null;

export function fromZodError(error: z.ZodError): FormState {
  return { error: "Please fix the highlighted fields.", fieldErrors: error.flatten().fieldErrors };
}
