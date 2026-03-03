"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function EventSettings({ userId }: { userId: string }) {
  const [event, setEvent] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [venue, setVenue] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const eventId = localStorage.getItem("activeEventId");
      if (!eventId) {
        router.push("/");
        return;
      }

      const [{ data: eventData }, { data: memberData }] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).single(),
        supabase
          .from("event_members")
          .select("*")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .single(),
      ]);

      if (!eventData) {
        localStorage.removeItem("activeEventId");
        router.push("/");
        return;
      }

      setEvent(eventData);
      setMembership(memberData);
      setName(eventData.name || "");
      setWeddingDate(eventData.wedding_date || "");
      setVenue(eventData.venue || "");
      setLoading(false);
    };

    load();
  }, []);

  const canEdit = membership?.role === "owner" || membership?.role === "partner";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !event) return;
    setSaving(true);

    await supabase
      .from("events")
      .update({
        name: name.trim(),
        wedding_date: weddingDate || null,
        venue: venue.trim() || null,
      })
      .eq("id", event.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/dashboard" className="text-rose-app hover:text-rose-app-hover text-sm shrink-0">← Dashboard</a>
            <h1 className="text-2xl font-bold text-heading truncate">Event Settings</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitcher />
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow border border-app-border">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-body mb-1">Event Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={!canEdit}
                className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-body mb-1">Wedding Date</label>
              <input
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                disabled={!canEdit}
                className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-body mb-1">Venue</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Optional"
                disabled={!canEdit}
                className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading disabled:opacity-60"
              />
            </div>

            {canEdit ? (
              <button
                type="submit"
                disabled={saving}
                className="bg-rose-app text-white px-6 py-2 rounded-lg hover:bg-rose-app-hover font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
              </button>
            ) : (
              <p className="text-sm text-subtle">Only owners and partners can edit event details.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
