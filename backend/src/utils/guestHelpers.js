const { db } = require("../db/database");

// ─── Status model ────────────────────────────────────────────────
const STATUS = Object.freeze({
  PENDING: "pending",
  INSIDE: "inside",
  STEPPED_OUT: "stepped_out",
  DEPARTED: "departed",
});

// Tunables (could move to env)
const MAX_ENTRIES = parseInt(process.env.MAX_ENTRIES || "5", 10);
const REENTRY_COOLDOWN_SECONDS = parseInt(
  process.env.REENTRY_COOLDOWN_SECONDS || "20",
  10,
);

// ─── Normalization ───────────────────────────────────────────────
function normalizeEmail(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value) {
  return typeof value === "string" && EMAIL_RE.test(value);
}

// ─── Uniqueness checks (return conflicting guest or null) ────────
async function findEmailConflict(email, excludeId = null) {
  if (!email) return null;
  const sql = excludeId
    ? "SELECT id, name FROM guests WHERE LOWER(email) = ? AND id <> ?"
    : "SELECT id, name FROM guests WHERE LOWER(email) = ?";
  const params = excludeId ? [email, excludeId] : [email];
  return (await db.get(sql, params)) || null;
}

async function findSeatConflict(seat, excludeId = null) {
  if (!seat) return null;
  const sql = excludeId
    ? "SELECT id, name FROM guests WHERE seat_number = ? AND id <> ?"
    : "SELECT id, name FROM guests WHERE seat_number = ?";
  const params = excludeId ? [seat, excludeId] : [seat];
  return (await db.get(sql, params)) || null;
}

// ─── Audit log writer ────────────────────────────────────────────
async function logGuestEvent({
  guestId,
  action,
  fromStatus = null,
  toStatus = null,
  req = null,
  reason = null,
}) {
  const userId = req?.user?.id || null;
  const username = req?.user?.username || null;
  const ip =
    req?.ip ||
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    null;
  const ua = req?.headers?.["user-agent"]?.slice(0, 500) || null;

  try {
    await db.run(
      `INSERT INTO guest_events
        (guest_id, action, from_status, to_status, performed_by, performed_by_username, ip, user_agent, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [guestId, action, fromStatus, toStatus, userId, username, ip, ua, reason],
    );
  } catch (err) {
    console.error("[Audit] Failed to write guest_event:", err.message);
  }
}

// ─── Transition validation ───────────────────────────────────────
/**
 * Validate that a transition from `current` to `next` is allowed.
 * Returns { ok: true } or { ok: false, status, error }.
 */
function validateTransition(guest, action, opts = {}) {
  const isAdmin = opts.isAdmin === true;
  const current = guest.status || STATUS.PENDING;
  const lastAt = guest.last_action_at
    ? new Date(guest.last_action_at).getTime()
    : 0;
  const now = Date.now();
  const secondsSince = lastAt ? Math.floor((now - lastAt) / 1000) : Infinity;

  switch (action) {
    case "checkin": {
      if (current === STATUS.INSIDE) {
        return { ok: false, status: 400, error: "Guest is already inside" };
      }
      if (current === STATUS.DEPARTED) {
        return {
          ok: false,
          status: 403,
          error:
            "Guest has already finally exited. An admin must reopen the pass before re-entry.",
        };
      }
      if (!isAdmin && (guest.entry_count || 0) >= MAX_ENTRIES) {
        return {
          ok: false,
          status: 403,
          error: `Re-entry limit (${MAX_ENTRIES}) reached. Admin override required.`,
        };
      }
      if (secondsSince < REENTRY_COOLDOWN_SECONDS) {
        return {
          ok: false,
          status: 429,
          error: `Please wait ${REENTRY_COOLDOWN_SECONDS - secondsSince}s before re-entry.`,
        };
      }
      return { ok: true, next: STATUS.INSIDE };
    }
    case "step_out": {
      if (current !== STATUS.INSIDE) {
        return {
          ok: false,
          status: 400,
          error: "Guest must be inside to step out",
        };
      }
      return { ok: true, next: STATUS.STEPPED_OUT };
    }
    case "final_exit": {
      if (current === STATUS.DEPARTED) {
        return { ok: false, status: 400, error: "Guest has already departed" };
      }
      if (current === STATUS.PENDING) {
        return {
          ok: false,
          status: 400,
          error: "Guest has not entered yet",
        };
      }
      return { ok: true, next: STATUS.DEPARTED };
    }
    case "reopen": {
      if (!isAdmin) {
        return {
          ok: false,
          status: 403,
          error: "Only admins can reopen a departed guest",
        };
      }
      if (current !== STATUS.DEPARTED) {
        return {
          ok: false,
          status: 400,
          error: "Only departed guests can be reopened",
        };
      }
      return { ok: true, next: STATUS.STEPPED_OUT };
    }
    default:
      return { ok: false, status: 400, error: "Unknown action" };
  }
}

module.exports = {
  STATUS,
  MAX_ENTRIES,
  REENTRY_COOLDOWN_SECONDS,
  normalizeEmail,
  normalizeText,
  isValidEmail,
  findEmailConflict,
  findSeatConflict,
  logGuestEvent,
  validateTransition,
};
