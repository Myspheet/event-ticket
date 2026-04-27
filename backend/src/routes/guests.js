const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateUniqueCode, generateBackupCode } = require('../utils/codeGen');
const { generateQRCodeDataUrl } = require('../services/qrService');
const { sendGuestCardEmail } = require('../services/emailService');
const {
  STATUS,
  normalizeEmail,
  normalizeText,
  isValidEmail,
  findEmailConflict,
  findSeatConflict,
  logGuestEvent,
  validateTransition,
} = require("../utils/guestHelpers");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Helpers ────────────────────────────────────────────────────
async function loadGuestById(id) {
  return db.get("SELECT * FROM guests WHERE id = ?", [id]);
}

/**
 * Validate + normalize input for create/update.
 * Returns { ok: true, data } or { ok: false, status, error }.
 */
async function validateGuestInput(body, { excludeId = null, partial = false } = {}) {
  const out = {};

  if (!partial || body.name !== undefined) {
    const name = normalizeText(body.name);
    if (!name) return { ok: false, status: 400, error: 'Name is required' };
    out.name = name;
  }

  if (!partial || body.phone !== undefined) {
    out.phone = normalizeText(body.phone);
  }

  if (!partial || body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (email && !isValidEmail(email)) {
      return { ok: false, status: 400, error: 'Invalid email format' };
    }
    if (email) {
      const conflict = await findEmailConflict(email, excludeId);
      if (conflict) {
        return {
          ok: false,
          status: 409,
          error: `Email already used by guest "${conflict.name}"`,
        };
      }
    }
    out.email = email;
  }

  if (!partial || body.seat_number !== undefined) {
    const seat = normalizeText(body.seat_number);
    if (seat) {
      const conflict = await findSeatConflict(seat, excludeId);
      if (conflict) {
        return {
          ok: false,
          status: 409,
          error: `Seat "${seat}" is already assigned to "${conflict.name}"`,
        };
      }
    }
    out.seat_number = seat;
  }

  return { ok: true, data: out };
}

/**
 * Apply a status transition + persist + log.
 */
async function applyTransition(guest, action, req, { reason = null } = {}) {
  const isAdmin = req.user?.role === 'admin';
  const decision = validateTransition(guest, action, { isAdmin });
  if (!decision.ok) return decision;

  const next = decision.next;
  const incrementEntry = action === 'checkin';

  const sets = [
    'status = ?',
    'last_action_at = CURRENT_TIMESTAMP',
    'last_action_by = ?',
    'updated_at = CURRENT_TIMESTAMP',
  ];
  const params = [next, req.user?.id || null];

  if (incrementEntry) {
    sets.push('entry_count = COALESCE(entry_count, 0) + 1');
    sets.push('checked_in = 1');
    sets.push('checked_in_at = CURRENT_TIMESTAMP');
    sets.push('checked_out_at = NULL');
  } else if (next === STATUS.STEPPED_OUT || next === STATUS.DEPARTED) {
    sets.push('checked_in = 0');
    sets.push('checked_out_at = CURRENT_TIMESTAMP');
  }

  await db.run(
    `UPDATE guests SET ${sets.join(', ')} WHERE id = ?`,
    [...params, guest.id],
  );

  await logGuestEvent({
    guestId: guest.id,
    action,
    fromStatus: guest.status || STATUS.PENDING,
    toStatus: next,
    req,
    reason,
  });

  const updated = await loadGuestById(guest.id);
  return { ok: true, guest: updated };
}

// ─── List ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const parents = await db.all(
      `SELECT * FROM guests WHERE type = 'parent' ORDER BY created_at DESC`,
    );
    const children = await db.all(
      `SELECT * FROM guests WHERE type = 'child' ORDER BY created_at ASC`,
    );

    const childrenByParent = {};
    for (const child of children) {
      if (!childrenByParent[child.parent_id])
        childrenByParent[child.parent_id] = [];
      childrenByParent[child.parent_id].push(child);
    }

    const result = parents.map((p) => ({
      ...p,
      children: childrenByParent[p.id] || [],
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/flat", async (req, res) => {
  try {
    const guests = await db.all(`
      SELECT g.*, p.name as parent_name
      FROM guests g
      LEFT JOIN guests p ON g.parent_id = p.id
      ORDER BY g.type ASC, g.created_at DESC
    `);
    res.json(guests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/checked-in", async (req, res) => {
  try {
    const guests = await db.all(`
      SELECT g.*, p.name as parent_name
      FROM guests g
      LEFT JOIN guests p ON g.parent_id = p.id
      WHERE g.status = 'inside'
      ORDER BY g.checked_in_at DESC
    `);
    res.json(guests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Lookup by code (must be defined before /:id) ───────────────
async function lookupByColumn(column, value, res) {
  const guest = await db.get(`SELECT * FROM guests WHERE ${column} = ?`, [
    value,
  ]);
  if (!guest) return res.status(404).json({ error: "Guest not found" });

  let children = [];
  let parent = null;
  if (guest.type === "parent") {
    children = await db.all(
      "SELECT id, name, unique_code, backup_code, seat_number, checked_in, status, entry_count FROM guests WHERE parent_id = ?",
      [guest.id],
    );
  } else if (guest.parent_id) {
    parent = await db.get(
      "SELECT id, name, unique_code FROM guests WHERE id = ?",
      [guest.parent_id],
    );
  }
  res.json({ ...guest, children, parent });
}

router.get("/code/:uniqueCode", (req, res) =>
  lookupByColumn("unique_code", req.params.uniqueCode, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }),
);

router.get("/backup/:uniqueCode", (req, res) =>
  lookupByColumn("backup_code", req.params.uniqueCode, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }),
);

// ─── Audit log for a guest (admin only) ─────────────────────────
router.get("/:id/events", requireRole("admin"), async (req, res) => {
  try {
    const events = await db.all(
      `SELECT * FROM guest_events WHERE guest_id = ? ORDER BY created_at DESC LIMIT 200`,
      [req.params.id],
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Single guest ───────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const guest = await loadGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    let children = [];
    if (guest.type === "parent") {
      children = await db.all("SELECT * FROM guests WHERE parent_id = ?", [
        guest.id,
      ]);
    }
    res.json({ ...guest, children });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Create parent ──────────────────────────────────────────────
router.post('/parent', requireRole('admin'), async (req, res) => {
  try {
    const validated = await validateGuestInput(req.body);
    if (!validated.ok)
      return res.status(validated.status).json({ error: validated.error });
    const { name, phone, email, seat_number } = validated.data;

    const uniqueCode = generateUniqueCode();
    const backupCode = generateBackupCode();
    const guestUrl = `${process.env.FRONTEND_URL}/guest/${uniqueCode}`;
    const qrDataUrl = await generateQRCodeDataUrl(guestUrl);

    const result = await db.run(
      `INSERT INTO guests (unique_code, backup_code, name, phone, email, seat_number, type, qr_code_url, status, entry_count)
       VALUES (?, ?, ?, ?, ?, ?, 'parent', ?, 'pending', 0)`,
      [uniqueCode, backupCode, name, phone, email, seat_number, guestUrl],
    );

    const guest = await loadGuestById(result.lastId);
    await logGuestEvent({
      guestId: guest.id,
      action: "created",
      toStatus: STATUS.PENDING,
      req,
    });

    sendGuestCardEmail({ ...guest, backup_code: backupCode }, qrDataUrl).catch(
      (err) => console.error("[Email] Failed to send:", err.message),
    );

    res.status(201).json({ ...guest, qr_data_url: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create guest" });
  }
});

// ─── Create child ───────────────────────────────────────────────
router.post('/child/:parentId', requireRole('admin'), async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    const parent = await db.get(
      "SELECT * FROM guests WHERE id = ? AND type = ?",
      [parentId, "parent"],
    );
    if (!parent) return res.status(404).json({ error: "Parent not found" });

    const validated = await validateGuestInput(req.body);
    if (!validated.ok)
      return res.status(validated.status).json({ error: validated.error });
    const { name, phone, email, seat_number } = validated.data;

    const uniqueCode = generateUniqueCode();
    const backupCode = generateBackupCode();
    const guestUrl = `${process.env.FRONTEND_URL}/guest/${uniqueCode}`;
    const qrDataUrl = await generateQRCodeDataUrl(guestUrl);

    const result = await db.run(
      `INSERT INTO guests (unique_code, backup_code, name, phone, email, seat_number, type, parent_id, qr_code_url, status, entry_count)
       VALUES (?, ?, ?, ?, ?, ?, 'child', ?, ?, 'pending', 0)`,
      [
        uniqueCode,
        backupCode,
        name,
        phone,
        email,
        seat_number,
        parentId,
        guestUrl,
      ],
    );

    const guest = await loadGuestById(result.lastId);
    await logGuestEvent({
      guestId: guest.id,
      action: "created",
      toStatus: STATUS.PENDING,
      req,
    });

    sendGuestCardEmail({ ...guest, backup_code: backupCode }, qrDataUrl).catch(
      (err) => console.error("[Email] Failed to send:", err.message),
    );

    res.status(201).json({ ...guest, qr_data_url: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create child guest" });
  }
});

// ─── Update guest ───────────────────────────────────────────────
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const guest = await loadGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const validated = await validateGuestInput(req.body, {
      excludeId: guest.id,
      partial: true,
    });
    if (!validated.ok)
      return res.status(validated.status).json({ error: validated.error });

    const next = {
      name: validated.data.name ?? guest.name,
      phone:
        validated.data.phone !== undefined ? validated.data.phone : guest.phone,
      email:
        validated.data.email !== undefined ? validated.data.email : guest.email,
      seat_number:
        validated.data.seat_number !== undefined
          ? validated.data.seat_number
          : guest.seat_number,
    };

    await db.run(
      `UPDATE guests SET name = ?, phone = ?, email = ?, seat_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [next.name, next.phone, next.email, next.seat_number, guest.id],
    );

    await logGuestEvent({
      guestId: guest.id,
      action: "updated",
      fromStatus: guest.status,
      toStatus: guest.status,
      req,
    });

    const updated = await loadGuestById(guest.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delete guest ───────────────────────────────────────────────
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const guest = await loadGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    await db.run("DELETE FROM guests WHERE id = ?", [guest.id]);
    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── State transitions ──────────────────────────────────────────
async function handleTransition(action, req, res) {
  try {
    const guest = await loadGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const result = await applyTransition(guest, action, req, {
      reason: normalizeText(req.body?.reason),
    });
    if (!result.ok)
      return res.status(result.status).json({ error: result.error });
    res.json(result.guest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Check in: pending → inside, or stepped_out → inside (re-entry)
router.post("/:id/checkin", requireRole("admin", "manager"), (req, res) =>
  handleTransition("checkin", req, res),
);

// Step out: temporary exit, re-entry allowed
router.post("/:id/step-out", requireRole("admin", "manager"), (req, res) =>
  handleTransition("step_out", req, res),
);

// Final exit: no re-entry without admin reopen
router.post(
  "/:id/final-exit",
  requireRole("admin", "manager"),
  (req, res) => handleTransition('final_exit', req, res),
);

// Reopen a departed guest (admin only)
router.post(
  "/:id/reopen",
  requireRole("admin"),
  (req, res) => handleTransition('reopen', req, res),
);

// Backwards-compat: /checkout maps to step-out by default,
// or final-exit when ?final=1 / { final: true }
router.post(
  "/:id/checkout",
  requireRole("admin", "manager"),
  (req, res) => {
    const final = req.body?.final === true || req.query?.final === '1';
    return handleTransition(final ? 'final_exit' : 'step_out', req, res);
  },
);

// Lookup-and-checkin in a single call, by either unique_code or backup_code
router.post(
  "/checkin-by-code",
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const code = normalizeText(req.body?.code);
      if (!code) return res.status(400).json({ error: "Code is required" });

      const guest = await db.get(
        "SELECT * FROM guests WHERE unique_code = ? OR backup_code = ?",
        [code, code],
      );
      if (!guest) return res.status(404).json({ error: "Guest not found" });

      const result = await applyTransition(guest, "checkin", req);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, guest });
      }
      res.json(result.guest);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─── QR regenerate ──────────────────────────────────────────────
router.get('/:id/qr', async (req, res) => {
  try {
    const guest = await loadGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const guestUrl = `${process.env.FRONTEND_URL}/guest/${guest.unique_code}`;
    const qrDataUrl = await generateQRCodeDataUrl(guestUrl);
    res.json({
      qr_data_url: qrDataUrl,
      backup_code: guest.backup_code,
      unique_code: guest.unique_code,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
