import path from "node:path";

/**
 * Where the database, uploads and onboarding marker live. The installed app sets
 * RECALL_DATA_DIR to a folder outside the app, so updates (which replace the app
 * folder) never touch it. Running from a clone, it's ./data.
 */
export const DATA_DIR = process.env.RECALL_DATA_DIR || path.join(process.cwd(), "data");
