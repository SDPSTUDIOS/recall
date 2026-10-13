import "server-only";
import pkg from "../../package.json";

/** The running Recall version. Release builds set it from the release tag. */
export const APP_VERSION: string = pkg.version;
