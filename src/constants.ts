/** Shared constants for the Illustrator MCP server. */

export const SERVER_NAME = "illustrator-mcp-server";
export const SERVER_VERSION = "0.1.0";

/** Bundle identifier used to target Illustrator via AppleScript on macOS. */
export const ILLUSTRATOR_BUNDLE_ID = "com.adobe.illustrator";

/**
 * Timeout for a single Illustrator call. Cold-launching Illustrator can take a
 * while, so this is generous.
 */
export const CALL_TIMEOUT_MS = 180_000;

/** Max stdout we accept from the bridge process (structured responses). */
export const MAX_BUFFER = 16 * 1024 * 1024;
