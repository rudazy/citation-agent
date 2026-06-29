/** HttpOnly agent session cookie lifetime (90 days). */
export const AGENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** Rotate session id after this interval to limit fixation / hijack window. */
export const AGENT_SESSION_ROTATION_MS = 60 * 60 * 24 * 30;