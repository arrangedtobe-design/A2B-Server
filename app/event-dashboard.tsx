"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function EventDashboard({ memberships, userId }: { memberships: any[]; userId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [venue, setVenue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Create the event
    const { data: event, error } = await supabase
      .from("events")
      .insert({ name, wedding_date: weddingDate || null, venue: venue || null, created_by: userId })
      .select()
      .single();

    if (error) {
      alert("Error creating event: " + error.message);
      setIsLoading(false);
      return;
    }

    // Add creator as owner
    await supabase
      .from("event_members")
      .insert({ event_id: event.id, user_id: userId, role: "owner" });

    // Store active event and go to dashboard
    localStorage.setItem("activeEventId", event.id);
    router.refresh();
    setIsLoading(false);
  };

  const selectEvent = (eventId: string) => {
    localStorage.setItem("activeEventId", eventId);
    router.push("/dashboard");
  };

  const handleCreateDemo = async () => {
    if (!confirm("This will create a demo wedding with sample guests, vendors, tasks, and budget. Continue?")) return;
    setIsCreatingDemo(true);
    try {
      const res = await fetch("/api/seed-mock-wedding", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert("Error creating demo: " + (data.error || "Unknown error"));
        return;
      }
      localStorage.setItem("activeEventId", data.eventId);
      router.refresh();
    } catch {
      alert("Failed to create demo wedding");
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    setDeletingId(eventId);
    try {
      const res = await fetch("/api/delete-wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error deleting: " + (data.error || "Unknown error"));
        return;
      }
      // Clear active event if it was the deleted one
      if (localStorage.getItem("activeEventId") === eventId) {
        localStorage.removeItem("activeEventId");
      }
      router.refresh();
    } catch {
      alert("Failed to delete wedding");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleSignOut = async () => {
    await fetch("/auth/sign-out", { method: "POST" });
    router.push("/auth/login");
  };

  // If user has an active event, go to dashboard
  const activeEventId = typeof window !== "undefined" ? localStorage.getItem("activeEventId") : null;
  const activeMembership = memberships.find((m: any) => m.event_id === activeEventId);

  useEffect(() => {
    if (activeMembership) {
      router.push("/dashboard");
    }
  }, [activeMembership, router]);

  if (activeMembership) {
    return null;
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-heading">Wedding Planner</h1>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitcher />
            <button onClick={handleSignOut} className="text-subtle hover:text-body text-sm">
              Sign Out
            </button>
          </div>
        </div>

        {memberships.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-heading mb-4">Your Weddings</h2>
            <div className="space-y-3">
              {memberships.map((m: any) => (
                <div
                  key={m.event_id}
                  className="bg-surface rounded-lg shadow hover:shadow-md transition-shadow border border-app-border"
                >
                  <button
                    onClick={() => selectEvent(m.event_id)}
                    className="w-full text-left p-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-heading">{m.events.name}</p>
                        {m.events.wedding_date && (
                          <p className="text-sm text-subtle">
                            {new Date(m.events.wedding_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </p>
                        )}
                        {m.events.venue && <p className="text-sm text-subtle">{m.events.venue}</p>}
                      </div>
                      <span className="text-xs bg-rose-light-bg text-rose-light-text px-2 py-1 rounded-full">{m.role}</span>
                    </div>
                  </button>

                  {m.role === "owner" && (
                    <div className="px-4 pb-3">
                      {confirmDelete === m.event_id ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-600 dark:text-red-400 font-medium">Delete this wedding and all its data?</span>
                          <button
                            onClick={() => handleDelete(m.event_id)}
                            disabled={deletingId === m.event_id}
                            className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            {deletingId === m.event_id ? "Deleting..." : "Yes, Delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1 rounded border border-app-border text-body text-xs hover:bg-page-bg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.event_id); }}
                          className="text-xs text-subtle hover:text-red-500"
                        >
                          Delete wedding
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!showCreate ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full bg-rose-app text-white py-3 rounded-lg hover:bg-rose-app-hover font-medium"
            >
              + Create New Wedding
            </button>
            <button
              onClick={handleCreateDemo}
              disabled={isCreatingDemo}
              className="w-full border border-app-border text-body py-3 rounded-lg hover:bg-surface font-medium disabled:opacity-50"
            >
              {isCreatingDemo ? "Creating Demo..." : "Try a Demo Wedding"}
            </button>
          </div>
        ) : (
          <div className="bg-surface p-6 rounded-lg shadow border border-app-border">
            <h2 className="text-xl font-semibold text-heading mb-4">Create Your Wedding</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-body mb-1">Wedding Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Brian & Karina's Wedding"
                  required
                  className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-body mb-1">Wedding Date</label>
                <input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-body mb-1">Venue</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover font-medium"
                >
                  {isLoading ? "Creating..." : "Create Wedding"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-app-border rounded-lg text-body hover:bg-page-bg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
