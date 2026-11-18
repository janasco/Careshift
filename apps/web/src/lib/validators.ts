/** Convex document ID validator used in client schemas. */
import { z } from "zod";

export const zId = z.string().min(1, "Required");
