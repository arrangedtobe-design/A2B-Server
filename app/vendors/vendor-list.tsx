"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ThemeSwitcher } from "@/components/theme-switcher";

const VENDOR_CATEGORIES = [
  "Venue", "Photographer", "Videographer", "Florist", "Caterer", "Baker",
  "DJ / Band", "Officiant", "Hair & Makeup", "Planner / Coordinator",
  "Rentals", "Stationery", "Transportation", "Lighting", "Photo Booth", "Other"
];

export default function VendorList({ userId }: { userId: string }) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("All");

  const themeColors = useThemeColors();
  const VENDOR_COLORS = themeColors.vendorPalette;

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState(VENDOR_COLORS[0]);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) { router.push("/"); return; }
    setEventId(eid);
    fetchVendors(eid);
  }, []);

  const fetchVendors = async (eid: string) => {
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .eq("event_id", eid)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    setVendors(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setCategory("Other"); setContactName(""); setEmail("");
    setPhone(""); setNotes(""); setColor(VENDOR_COLORS[0]);
    setEditingId(null); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !eventId) return;

    const payload = {
      name: name.trim(),
      category,
      contact_name: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      color,
    };

    if (editingId) {
      await supabase.from("vendors").update(payload).eq("id", editingId);
    } else {
      await supabase.from("vendors").insert({ ...payload, event_id: eventId });
    }

    resetForm();
    fetchVendors(eventId);
  };

  const startEdit = (vendor: any) => {
    setName(vendor.name);
    setCategory(vendor.category || "Other");
    setContactName(vendor.contact_name || "");
    setEmail(vendor.email || "");
    setPhone(vendor.phone || "");
    setNotes(vendor.notes || "");
    setColor(vendor.color || VENDOR_COLORS[0]);
    setEditingId(vendor.id);
    setShowForm(true);
  };

  const deleteVendor = async (id: string) => {
    if (!eventId || !confirm("Delete this vendor? This will also remove them from any timeline events.")) return;
    await supabase.from("vendors").delete().eq("id", id);
    fetchVendors(eventId);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  // Count by category
  const categoryCounts: Record<string, number> = { All: vendors.length };
  vendors.forEach((v) => {
    categoryCounts[v.category] = (categoryCounts[v.category] || 0) + 1;
  });

  const filteredVendors = filterCategory === "All"
    ? vendors
    : vendors.filter((v) => v.category === filterCategory);

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-heading">Vendors</h1>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Link href="/dashboard" className="text-sm text-rose-app hover:text-rose-app-hover">← Dashboard</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-heading">{vendors.length}</p>
            <p className="text-xs text-subtle">Total Vendors</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-rose-app">
              {new Set(vendors.map((v) => v.category)).size}
            </p>
            <p className="text-xs text-subtle">Categories</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {vendors.filter((v) => v.email || v.phone).length}
            </p>
            <p className="text-xs text-subtle">With Contact</p>
          </div>
        </div>

        {/* Add button / Form */}
        {!showForm ? (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="w-full bg-rose-app text-white py-3 rounded-lg hover:bg-rose-app-hover font-medium mb-6"
          >
            + Add Vendor
          </button>
        ) : (
          <div className="bg-surface p-5 rounded-lg shadow border border-app-border mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-heading">{editingId ? "Edit Vendor" : "Add Vendor"}</h2>
              <button onClick={resetForm} className="text-subtle hover:text-body text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Vendor Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder='e.g., "Lens & Light Photography"' required className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
                <div className="w-[140px]">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">
                    {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-subtle uppercase mb-1">Contact Name</label>
                <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                  placeholder="Primary contact person" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendor@email.com" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-subtle uppercase mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contract details, pricing, special requests..." rows={2} className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-subtle uppercase mb-1">Color Tag</label>
                <div className="flex gap-2 flex-wrap">
                  {VENDOR_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover font-medium">
                  {editingId ? "Save Changes" : "+ Add Vendor"}
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-app-border rounded-lg text-body hover:bg-page-bg">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {["All", ...VENDOR_CATEGORIES].map((c) => {
            const count = categoryCounts[c] || 0;
            if (c !== "All" && count === 0) return null;
            return (
              <button key={c} onClick={() => setFilterCategory(c)}
                className={`px-3 py-1 rounded-full text-sm ${filterCategory === c ? "bg-rose-app text-white" : "bg-surface text-body border border-app-border hover:bg-page-bg"}`}>
                {c} ({count})
              </button>
            );
          })}
        </div>

        {/* Vendor List */}
        <div className="space-y-3">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-surface p-4 rounded-lg shadow-sm border-l-4 border border-app-border hover:shadow-md transition-shadow"
              style={{ borderLeftColor: vendor.color || VENDOR_COLORS[0] }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-heading">{vendor.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-page-bg text-body">{vendor.category}</span>
                  </div>

                  {vendor.contact_name && (
                    <p className="text-sm text-body mt-1">{vendor.contact_name}</p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-1">
                    {vendor.email && (
                      <span className="text-xs text-subtle">{vendor.email}</span>
                    )}
                    {vendor.phone && (
                      <span className="text-xs text-subtle">{vendor.phone}</span>
                    )}
                  </div>

                  {vendor.notes && (
                    <p className="text-sm text-subtle mt-1 italic">{vendor.notes}</p>
                  )}
                </div>

                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => startEdit(vendor)} className="text-subtle hover:text-blue-500 text-sm px-1" title="Edit">✎</button>
                  <button onClick={() => deleteVendor(vendor.id)} className="text-subtle hover:text-red-500 text-lg px-1" title="Delete">×</button>
                </div>
              </div>
            </div>
          ))}

          {filteredVendors.length === 0 && (
            <p className="text-center text-subtle py-8">
              {vendors.length === 0 ? "No vendors yet. Add your first one!" : "No vendors in this category."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
