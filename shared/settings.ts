import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

/** Host-scoped preferences shared by every client connected to this daemon. */
export const preferences = defineSettings({
  id: "beads-preferences",
  scope: "host",
  version: 1,
  schema: z.object({
    /** Extra absolute directories to scan for a `.beads` database. */
    extraPaths: z.array(z.string()).default([]),
    /** Seconds between automatic board refreshes. 0 disables polling. */
    pollIntervalSeconds: z.number().int().min(0).max(3600).default(20),
    /** Show the Closed column by default. */
    showClosed: z.boolean().default(false),
  }),
});
