const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateUniqueCode, generateBackupCode } = require('../utils/codeGen');
const { generateQRCodeDataUrl } = require('../services/qrService');
const { sendGuestCardEmail } = require('../services/emailService');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/guests — list all guests with children nested
router.get("/", async (req, res) => {
  try {
    const parents = await db.all(`
      SELECT g.*,
             CASE WHEN g.checked_in = 1 THEN 1 ELSE 0 END as checked_in
      FROM guests g
      WHERE g.type = 'parent'
      ORDER BY g.created_at DESC
    `);

    const children = await db.all(`
      SELECT g.*,
             CASE WHEN g.checked_in = 1 THEN 1 ELSE 0 END as checked_in
      FROM guests g
      WHERE g.type = 'child'
      ORDER BY g.created_at ASC
    `);

    const childrenByParent = {};
    for (const child of children) {
      if (!childrenByParent[child.parent_id]) {
        childrenByParent[child.parent_id] = [];
      }
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

// GET /api/guests/flat — flat list of all guests
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

// GET /api/guests/checked-in — list of currently checked-in guests
router.get("/checked-in", async (req, res) => {
  try {
    const guests = await db.all(`
      SELECT g.*, p.name as parent_name
      FROM guests g
      LEFT JOIN guests p ON g.parent_id = p.id
      WHERE g.checked_in = 1
      ORDER BY g.checked_in_at DESC
    `);
    res.json(guests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/guests/code/:uniqueCode — lookup by unique code (used from QR scan)
// NOTE: This must be defined BEFORE the /:id route, otherwise Express matches "code" as an :id param
router.get("/code/:uniqueCode", async (req, res) => {
  try {
    const guest = await db.get("SELECT * FROM guests WHERE unique_code = ?", [
      req.params.uniqueCode,
    ]);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    let children = [];
    let parent = null;

    if (guest.type === "parent") {
      children = await db.all(
        "SELECT id, name, unique_code, backup_code, seat_number, checked_in FROM guests WHERE parent_id = ?",
        [guest.id],
      );
    } else if (guest.parent_id) {
      parent = await db.get(
        "SELECT id, name, unique_code FROM guests WHERE id = ?",
        [guest.parent_id],
      );
    }

    res.json({ ...guest, children, parent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/guests/code/:uniqueCode — lookup by unique code (used from QR scan)
// NOTE: This must be defined BEFORE the /:id route, otherwise Express matches "code" as an :id param
router.get("/backup/:uniqueCode", async (req, res) => {
  try {
    const guest = await db.get("SELECT * FROM guests WHERE backup_code = ?", [
      req.params.uniqueCode,
    ]);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    let children = [];
    let parent = null;

    if (guest.type === "parent") {
      children = await db.all(
        "SELECT id, name, unique_code, backup_code, seat_number, checked_in FROM guests WHERE parent_id = ?",
        [guest.id],
      );
    } else if (guest.parent_id) {
      parent = await db.get(
        "SELECT id, name, unique_code FROM guests WHERE id = ?",
        [guest.parent_id],
      );
    }

    res.json({ ...guest, children, parent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// GET /api/guests/:id
router.get("/:id", async (req, res) => {
  try {
    const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
      req.params.id,
    ]);
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

// POST /api/guests/parent — admin only
router.post('/parent', requireRole('admin'), async (req, res) => {
  const { name, phone, email, seat_number } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const uniqueCode = generateUniqueCode();
  const backupCode = generateBackupCode();
  const guestUrl = `${process.env.FRONTEND_URL}/guest/${uniqueCode}`;

  try {
    const qrDataUrl = await generateQRCodeDataUrl(guestUrl);

    const result = await db.run(
      `
      INSERT INTO guests (unique_code, backup_code, name, phone, email, seat_number, type, qr_code_url)
      VALUES (?, ?, ?, ?, ?, ?, 'parent', ?)
    `,
      [
        uniqueCode,
        backupCode,
        name,
        phone || null,
        email || null,
        seat_number || null,
        guestUrl,
      ],
    );

    const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
      result.lastId,
    ]);

    // Send email async (don't block response)
    sendGuestCardEmail({ ...guest, backup_code: backupCode }, qrDataUrl).catch(err =>
      console.error('[Email] Failed to send:', err.message)
    );

    res.status(201).json({ ...guest, qr_data_url: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create guest' });
  }
});

// POST /api/guests/child/:parentId — admin only
router.post('/child/:parentId', requireRole('admin'), async (req, res) => {
  const { name, phone, email, seat_number } = req.body;
  const parentId = parseInt(req.params.parentId);

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const parent = await db.get(
    "SELECT * FROM guests WHERE id = ? AND type = ?",
    [parentId, "parent"],
  );
  if (!parent) return res.status(404).json({ error: 'Parent not found' });

  const uniqueCode = generateUniqueCode();
  const backupCode = generateBackupCode();
  const guestUrl = `${process.env.FRONTEND_URL}/guest/${uniqueCode}`;

  try {
    const qrDataUrl = await generateQRCodeDataUrl(guestUrl);

    const result = await db.run(
      `
      INSERT INTO guests (unique_code, backup_code, name, phone, email, seat_number, type, parent_id, qr_code_url)
      VALUES (?, ?, ?, ?, ?, ?, 'child', ?, ?)
    `,
      [
        uniqueCode,
        backupCode,
        name,
        phone || null,
        email || null,
        seat_number || null,
        parentId,
        guestUrl,
      ],
    );

    const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
      result.lastId,
    ]);

    sendGuestCardEmail({ ...guest, backup_code: backupCode }, qrDataUrl).catch(err =>
      console.error('[Email] Failed to send:', err.message)
    );

    res.status(201).json({ ...guest, qr_data_url: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create child guest' });
  }
});

// PUT /api/guests/:id — admin only
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { name, phone, email, seat_number } = req.body;
    const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
      req.params.id,
    ]);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    await db.run(
      `
      UPDATE guests SET name = ?, phone = ?, email = ?, seat_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        name || guest.name,
        phone !== undefined ? phone : guest.phone,
        email !== undefined ? email : guest.email,
        seat_number !== undefined ? seat_number : guest.seat_number,
        guest.id,
      ],
    );

    const updated = await db.get("SELECT * FROM guests WHERE id = ?", [
      guest.id,
    ]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/guests/:id — admin only
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
      req.params.id,
    ]);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    await db.run("DELETE FROM guests WHERE id = ?", [guest.id]);
    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/guests/:id/checkin — admin or manager
router.post(
  "/:id/checkin",
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
        req.params.id,
      ]);
      if (!guest) return res.status(404).json({ error: "Guest not found" });

      if (guest.checked_in) {
        return res.status(400).json({ error: "Guest is already checked in" });
      }

      await db.run(
        `
      UPDATE guests SET checked_in = 1, checked_in_at = CURRENT_TIMESTAMP, checked_out_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
        [guest.id],
      );

      const updated = await db.get("SELECT * FROM guests WHERE id = ?", [
        guest.id,
      ]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/guests/:id/checkout — admin or manager
router.post(
  "/:id/checkout",
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
        req.params.id,
      ]);
      if (!guest) return res.status(404).json({ error: "Guest not found" });

      if (!guest.checked_in) {
        return res.status(400).json({ error: "Guest is not checked in" });
      }

      await db.run(
        `
      UPDATE guests SET checked_in = 0, checked_out_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
        [guest.id],
      );

      const updated = await db.get("SELECT * FROM guests WHERE id = ?", [
        guest.id,
      ]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/guests/checkin-by-code — admin or manager (scan backup code)
router.post(
  "/checkin-by-code",
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Code is required" });

      const guest = await db.get(
        "SELECT * FROM guests WHERE unique_code = ? OR backup_code = ?",
        [code, code],
      );
      if (!guest) return res.status(404).json({ error: "Guest not found" });

      if (guest.checked_in) {
        return res
          .status(400)
          .json({ error: "Guest already checked in", guest });
      }

      await db.run(
        `
      UPDATE guests SET checked_in = 1, checked_in_at = CURRENT_TIMESTAMP, checked_out_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
        [guest.id],
      );

      const updated = await db.get("SELECT * FROM guests WHERE id = ?", [
        guest.id,
      ]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/guests/:id/qr — regenerate QR data URL
router.get('/:id/qr', async (req, res) => {
  try {
    const guest = await db.get("SELECT * FROM guests WHERE id = ?", [
      req.params.id,
    ]);
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
