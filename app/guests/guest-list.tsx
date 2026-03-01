"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function GuestList({ userId }: { userId: string }) {
  const [guests, setGuests] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) {
      router.push("/");
      return;
    }
    setEventId(eid);
    fetchGuests(eid);
  }, []);

  const fetchGuests = async (eid: string) => {
    const { data } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", eid)
      .order("created_at", { ascending: false });
    setGuests(data || []);
    setLoading(false);
  };

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !eventId) return;

    const { error } = await supabase
      .from("guests")
      .insert({
        name: name.trim(),
        email: email.trim() || null,
        event_id: eventId,
      });

    if (!error) {
      setName("");
      setEmail("");
      fetchGuests(eventId);
    }
  };

  const updateRsvp = async (id: string, status: string) => {
    if (!eventId) return;
    await supabase.from("guests").update({ rsvp_status: status }).eq("id", id);
    fetchGuests(eventId);
  };

  const updateMeal = async (id: string, meal: string) => {
    if (!eventId) return;
    await supabase.from("guests").update({ meal_preference: meal }).eq("id", id);
    fetchGuests(eventId);
  };

  const togglePlusOne = async (id: string, current: boolean) => {
    if (!eventId) return;
    await supabase.from("guests").update({ plus_one: !current }).eq("id", id);
    fetchGuests(eventId);
  };

  const deleteGuest = async (id: string) => {
    if (!eventId) return;
    await supabase.from("guests").delete().eq("id", id);
    fetchGuests(eventId);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  const confirmed = guests.filter((g) => g.rsvp_status === "confirmed").length;
  const pending = guests.filter((g) => g.rsvp_status === "pending").length;
  const declined = guests.filter((g) => g.rsvp_status === "declined").length;
  const plusOnes = guests.filter((g) => g.plus_one).length;
  const estimatedTotal = confirmed + plusOnes;

  const filteredGuests = filterStatus === "All"
    ? guests
    : guests.filter((g) => g.rsvp_status === filterStatus.toLowerCase());

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-heading">Guest List</h1>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <a href="/dashboard" className="text-sm text-rose-app hover:text-rose-app-hover">← Dashboard</a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-heading">{guests.length}</p>
            <p className="text-xs text-subtle">Total</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{confirmed}</p>
            <p className="text-xs text-subtle">Confirmed</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pending}</p>
            <p className="text-xs text-subtle">Pending</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{declined}</p>
            <p className="text-xs text-subtle">Declined</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{plusOnes}</p>
            <p className="text-xs text-subtle">Plus Ones</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-rose-app">{estimatedTotal}</p>
            <p className="text-xs text-subtle">Est. Attending</p>
          </div>
        </div>

        {/* Add Guest Form */}
        <form onSubmit={addGuest} className="bg-surface p-4 rounded-lg shadow border border-app-border mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guest name"
              required
              className="flex-1 border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="flex-1 border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
            <button type="submit" className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover">
              Add
            </button>
          </div>
        </form>

        {/* RSVP Filters */}
        <div className="flex gap-2 mb-4">
          {["All", "Pending", "Confirmed", "Declined"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterStatus === status
                  ? "bg-rose-app text-white"
                  : "bg-surface text-body border border-app-border hover:bg-page-bg"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Guest List */}
        <div className="space-y-2">
          {filteredGuests.map((guest) => (
            <div key={guest.id} className="bg-surface p-3 rounded-lg shadow-sm border border-app-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-heading">{guest.name}</p>
                  {guest.email && <p className="text-xs text-subtle">{guest.email}</p>}
                </div>
                <button
                  onClick={() => deleteGuest(guest.id)}
                  className="text-subtle hover:text-red-500 text-lg"
                >
                  ×
                </button>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={guest.rsvp_status}
                  onChange={(e) => updateRsvp(guest.id, e.target.value)}
                  className={`text-xs border rounded px-2 py-1 ${
                    guest.rsvp_status === "confirmed"
                      ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : guest.rsvp_status === "declined"
                      ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="declined">Declined</option>
                </select>
                <input
                  type="text"
                  value={guest.meal_preference || ""}
                  onChange={(e) => updateMeal(guest.id, e.target.value)}
                  placeholder="Meal preference"
                  className="text-xs border border-app-border rounded px-2 py-1 flex-1 bg-surface text-heading"
                />
                <button
                  onClick={() => togglePlusOne(guest.id, guest.plus_one)}
                  className={`text-xs px-2 py-1 rounded border ${
                    guest.plus_one
                      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                      : "bg-surface text-subtle border-app-border"
                  }`}
                >
                  +1 {guest.plus_one ? "✓" : ""}
                </button>
              </div>
            </div>
          ))}
          {filteredGuests.length === 0 && (
            <p className="text-center text-subtle py-8">No guests yet. Add one above!</p>
          )}
        </div>
      </div>
    </div>
  );
}
