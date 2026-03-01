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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-heading">Wedding Planner</h1>
          <div className="flex items-center gap-2">
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
                <button
                  key={m.event_id}
                  onClick={() => selectEvent(m.event_id)}
                  className="w-full text-left bg-surface p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-app-border"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-heading">{m.events.name}</p>
                      {m.events.wedding_date && (
                        <p className="text-sm text-subtle">
                          {new Date(m.events.wedding_date + "T00:00:00").toLocaleDateString()}
                        </p>
                      )}
                      {m.events.venue && <p className="text-sm text-subtle">{m.events.venue}</p>}
                    </div>
                    <span className="text-xs bg-rose-light-bg text-rose-light-text px-2 py-1 rounded-full">{m.role}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full bg-rose-app text-white py-3 rounded-lg hover:bg-rose-app-hover font-medium"
          >
            + Create New Wedding
          </button>
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
