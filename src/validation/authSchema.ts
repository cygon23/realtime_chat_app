import { z } from "zod";

export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email format"),

  password: z
    .string()
    .trim()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password is too long"),

  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscore allowed"),
});

export type AuthSchemaType = z.infer<typeof authSchema>;
