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
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

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
    setSelectedVendorId(null);
    setShowForm(true);
  };

  const deleteVendor = async (id: string) => {
    if (!eventId || !confirm("Delete this vendor? This will also remove them from any timeline events.")) return;
    await supabase.from("vendors").delete().eq("id", id);
    if (selectedVendorId === id) setSelectedVendorId(null);
    fetchVendors(eventId);
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) || null;

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

  const renderForm = () => (
    <div className="bg-surface p-5 rounded-lg shadow border border-app-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-heading">{editingId ? "Edit Vendor" : "Add Vendor"}</h2>
        <button onClick={resetForm} className="text-subtle hover:text-body text-xl">×</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-subtle uppercase mb-1">Vendor Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder='e.g., "Lens & Light Photography"' required className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-subtle uppercase mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">
            {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-subtle uppercase mb-1">Contact Name</label>
          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
            placeholder="Primary contact person" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-subtle uppercase mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="vendor@email.com" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-subtle uppercase mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
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
  );

  const renderDetailPanel = () => {
    if (!selectedVendor) return null;
    return (
      <div className="bg-surface p-5 rounded-lg shadow border border-app-border">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedVendor.color || VENDOR_COLORS[0] }} />
            <h2 className="text-lg font-semibold text-heading truncate">{selectedVendor.name}</h2>
          </div>
          <button onClick={() => setSelectedVendorId(null)} className="text-subtle hover:text-body text-xl shrink-0 ml-2">×</button>
        </div>

        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-page-bg text-body mb-4">{selectedVendor.category}</span>

        <div className="space-y-3 text-sm">
          {selectedVendor.contact_name && (
            <div>
              <span className="text-subtle text-xs uppercase font-semibold">Contact</span>
              <p className="text-body mt-0.5">{selectedVendor.contact_name}</p>
            </div>
          )}
          {selectedVendor.email && (
            <div>
              <span className="text-subtle text-xs uppercase font-semibold">Email</span>
              <p className="mt-0.5"><a href={`mailto:${selectedVendor.email}`} className="text-rose-app hover:text-rose-app-hover">{selectedVendor.email}</a></p>
            </div>
          )}
          {selectedVendor.phone && (
            <div>
              <span className="text-subtle text-xs uppercase font-semibold">Phone</span>
              <p className="mt-0.5"><a href={`tel:${selectedVendor.phone}`} className="text-rose-app hover:text-rose-app-hover">{selectedVendor.phone}</a></p>
            </div>
          )}
          {selectedVendor.notes && (
            <div>
              <span className="text-subtle text-xs uppercase font-semibold">Notes</span>
              <p className="mt-1 bg-page-bg p-2 rounded text-body whitespace-pre-wrap">{selectedVendor.notes}</p>
            </div>
          )}
          {!selectedVendor.contact_name && !selectedVendor.email && !selectedVendor.phone && !selectedVendor.notes && (
            <p className="text-subtle italic">No additional details.</p>
          )}
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-app-border">
          <button onClick={() => startEdit(selectedVendor)} className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover text-sm font-medium">Edit</button>
          <button onClick={() => deleteVendor(selectedVendor.id)} className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm">Delete</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-5xl mx-auto p-6">
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

        {/* Add button */}
        <button
          onClick={() => { resetForm(); setSelectedVendorId(null); setShowForm(true); }}
          className="w-full bg-rose-app text-white py-3 rounded-lg hover:bg-rose-app-hover font-medium mb-6"
        >
          + Add Vendor
        </button>

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

        {/* Mobile form overlay */}
        {showForm && (
          <div className="lg:hidden fixed inset-0 bg-page-bg z-50 overflow-y-auto p-4">
            {renderForm()}
          </div>
        )}

        <div className="flex gap-6">
          {/* Vendor List */}
          <div className="flex-1 min-w-0">
            <div className="space-y-3">
              {filteredVendors.map((vendor) => {
                const isSelected = selectedVendorId === vendor.id;
                return (
                  <div
                    key={vendor.id}
                    className={`bg-surface p-4 rounded-lg shadow-sm border-l-4 border border-app-border hover:shadow-md transition-shadow cursor-pointer ${isSelected ? "ring-2 ring-rose-400" : ""}`}
                    style={{ borderLeftColor: vendor.color || VENDOR_COLORS[0] }}
                    onClick={() => {
                      setSelectedVendorId(isSelected ? null : vendor.id);
                      setShowForm(false);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-heading truncate">{vendor.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-page-bg text-body shrink-0">{vendor.category}</span>
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
                          <p className="text-sm text-subtle mt-1 italic truncate">{vendor.notes}</p>
                        )}
                      </div>

                      <div className="flex gap-1 ml-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); startEdit(vendor); }} className="text-subtle hover:text-blue-500 text-sm px-1" title="Edit">✎</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteVendor(vendor.id); }} className="text-subtle hover:text-red-500 text-lg px-1" title="Delete">×</button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredVendors.length === 0 && (
                <p className="text-center text-subtle py-8">
                  {vendors.length === 0 ? "No vendors yet. Add your first one!" : "No vendors in this category."}
                </p>
              )}
            </div>
          </div>

          {/* Desktop sidebar — detail panel or form */}
          {(showForm || selectedVendor) && (
            <div className="hidden lg:block w-[400px] shrink-0 sticky top-6 self-start">
              {showForm ? renderForm() : renderDetailPanel()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
