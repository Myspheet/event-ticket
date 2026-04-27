const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/public/guest/:uniqueCode
// Public endpoint — only shows guest info, no check-in ability
router.get("/guest/:uniqueCode", async (req, res) => {
  try {
    const guest = await db.get("SELECT * FROM guests WHERE unique_code = ?", [
      req.params.uniqueCode,
    ]);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    let children = [];
    let parent = null;

    if (guest.type === "parent") {
      // Public view: never expose children's backup_code (only the parent's
      // own backup_code is shown so it can substitute for a failed QR scan).
      children = await db.all(
        "SELECT id, name, seat_number, checked_in FROM guests WHERE parent_id = ?",
        [guest.id],
      );
    } else if (guest.parent_id) {
      parent = await db.get(
        "SELECT id, name, unique_code FROM guests WHERE id = ?",
        [guest.parent_id],
      );
    }

    // Exclude sensitive fields if needed; for now return full record (no password here)
    res.json({
      id: guest.id,
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      seat_number: guest.seat_number,
      type: guest.type,
      unique_code: guest.unique_code,
      backup_code: guest.backup_code,
      checked_in: guest.checked_in,
      checked_in_at: guest.checked_in_at,
      checked_out_at: guest.checked_out_at,
      created_at: guest.created_at,
      children,
      parent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
