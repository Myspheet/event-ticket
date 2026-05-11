import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function GuestFormModal({
  mode,
  guest,
  parentId,
  onClose,
  onSuccess,
}) {
  // mode: 'add-parent' | 'add-child' | 'edit'
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    seat_number: "",
  });
  const [loading, setLoading] = useState(false);
  const isChildGuest =
    mode === "add-child" || (mode === "edit" && guest?.type === "child");

  useEffect(() => {
    if (mode === "edit" && guest) {
      setForm({
        name: guest.name || "",
        phone: guest.phone || "",
        email: guest.email || "",
        seat_number: guest.seat_number || "",
      });
      return;
    }
    setForm({ name: "", phone: "", email: "", seat_number: "" });
  }, [mode, guest]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setLoading(true);
    try {
      let res;
      const payload = isChildGuest ? { ...form, email: "" } : form;
      if (mode === "add-parent") {
        res = await api.post("/guests/parent", payload);
        toast.success("Parent guest added!");
      } else if (mode === "add-child") {
        res = await api.post(`/guests/child/${parentId}`, payload);
        toast.success("Child guest added!");
      } else if (mode === "edit") {
        res = await api.put(`/guests/${guest.id}`, payload);
        toast.success("Guest updated!");
      }
      onSuccess(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "add-parent"
      ? "Add Parent Guest"
      : mode === "add-child"
        ? "Add Child Guest"
        : "Edit Guest";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              className="input"
              placeholder="Enter full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              className="input"
              placeholder="e.g. +1 234 567 8900"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          {!isChildGuest && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                className="input"
                placeholder="guest@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
              <p className="text-xs text-gray-400 mt-1">
                Guest card will be emailed to this address.
              </p>
            </div>
          )}
          {isChildGuest && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Child passes are linked to the parent record and are emailed to
              the parent when a parent email is available.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seat Number
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. A12, Row 3 Seat 4"
              value={form.seat_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, seat_number: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                title
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
