"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";


export default function Dashboard() {
  const [event, setEvent] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statsOpen, setStatsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadEvent = async () => {
      const eventId = localStorage.getItem("activeEventId");
      if (!eventId) {
        router.push("/");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (!eventData) {
        localStorage.removeItem("activeEventId");
        router.push("/");
        return;
      }

      const { data: memberData } = await supabase
        .from("event_members")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      const { data: allMembers } = await supabase
        .from("event_members")
        .select("*")
        .eq("event_id", eventId);

      setEvent(eventData);
      setMembership(memberData);
      setMembers(allMembers || []);

      // Fetch stats in parallel
      const [guestsRes, responsesRes, tasksRes, budgetRes, vendorsRes] = await Promise.all([
        supabase.from("guests").select("id, rsvp_status, party_members").eq("event_id", eventId),
        supabase.from("rsvp_responses").select("guest_id, party_responses").eq("event_id", eventId),
        supabase.from("tasks").select("is_complete").eq("event_id", eventId),
        supabase.from("budget_items").select("estimated_cost, actual_cost").eq("event_id", eventId),
        supabase.from("vendors").select("id").eq("event_id", eventId),
      ]);

      const guestsList = guestsRes.data || [];
      const responsesByGuest: Record<string, any> = {};
      for (const r of responsesRes.data || []) {
        responsesByGuest[r.guest_id] = r;
      }
      const tasksList = tasksRes.data || [];
      const budgetList = budgetRes.data || [];

      // Count all people (primary + party members) by status
      let total = 0, conf = 0, pend = 0, dec = 0;
      for (const g of guestsList) {
        const partyResponses: any[] = responsesByGuest[g.id]?.party_responses || [];
        const members = g.party_members || [];
        total++;
        if (g.rsvp_status === "confirmed") conf++;
        else if (g.rsvp_status === "declined") dec++;
        else pend++;
        members.forEach((_: any, i: number) => {
          total++;
          if (g.rsvp_status === "declined") { dec++; }
          else if (g.rsvp_status === "confirmed") {
            const status = partyResponses[i]?.attending || "coming";
            if (status === "coming") conf++;
            else if (status === "not_coming") dec++;
            else pend++;
          } else { pend++; }
        });
      }

      setStats({
        guestsTotal: total,
        confirmed: conf,
        pending: pend,
        declined: dec,
        tasksTotal: tasksList.length,
        tasksDone: tasksList.filter((t: any) => t.is_complete).length,
        vendorsTotal: (vendorsRes.data || []).length,
        budgetEstimated: budgetList.reduce((s: number, i: any) => s + (parseFloat(i.estimated_cost) || 0), 0),
        budgetActual: budgetList.reduce((s: number, i: any) => s + (parseFloat(i.actual_cost) || 0), 0),
      });

      setLoading(false);
    };

    loadEvent();
  }, []);

  const handleSignOut = async () => {
    localStorage.removeItem("activeEventId");
    await fetch("/auth/sign-out", { method: "POST" });
    router.push("/auth/login");
  };

  const switchEvent = () => {
    localStorage.removeItem("activeEventId");
    router.push("/");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  const navItems = [
    { label: "Checklist", href: "/tasks", icon: "✓", description: "Track your to-dos" },
    { label: "Guest List", href: "/guests", icon: "👥", description: "Manage RSVPs" },
    { label: "Timeline", href: "/timeline", icon: "🕐", description: "Day-of schedule" },
    { label: "Vendors", href: "/vendors", icon: "🏪", description: "Manage vendors" },
    { label: "Budget", href: "/budget", icon: "💰", description: "Track spending" },
    { label: "Wedding Team", href: "/members", icon: "💍", description: "Manage your team" },
    { label: "RSVP Page", href: "/rsvp-editor", icon: "💌", description: "Design your RSVP" },
    { label: "Seating Chart", href: "/seating", icon: "🪑", description: "Arrange your tables" },
  ];

  const canManageMembers = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "planner";

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-heading truncate min-w-0">{event.name}</h1>
          <div className="flex gap-2 items-center shrink-0">
            <Link href="/settings" className="text-subtle hover:text-heading text-lg" title="Event Settings">⚙️</Link>
            <ThemeSwitcher />
            <button onClick={switchEvent} className="text-sm text-subtle hover:text-body">
              Switch
            </button>
            <button onClick={handleSignOut} className="text-sm text-subtle hover:text-body">
              Sign Out
            </button>
          </div>
        </div>
        <div className="flex gap-3 text-sm text-subtle mb-2">
          {event.wedding_date && (
            <span>{new Date(event.wedding_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
          )}
          {event.venue && <span>{event.venue}</span>}
          <span>{membership?.role}</span>
        </div>

        <div className="mt-4 mb-4">
          <Link href="/members" className="text-sm text-rose-app hover:text-rose-app-hover">
            {members.length} member{members.length !== 1 ? "s" : ""} →
          </Link>
        </div>

        {/* Collapsible Overview */}
        {stats && (
          <div className="mb-6">
            <button
              onClick={() => setStatsOpen(!statsOpen)}
              className="flex items-center gap-1.5 text-sm font-medium text-heading mb-3 hover:text-rose-app transition-colors"
            >
              <span className="text-xs">{statsOpen ? "▾" : "▸"}</span>
              Overview
            </button>
            {statsOpen && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-2xl font-bold text-heading">{stats.guestsTotal}</p>
                    <p className="text-xs text-subtle">Guests</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.confirmed}</p>
                    <p className="text-xs text-subtle">Confirmed</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
                    <p className="text-xs text-subtle">Pending</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.declined}</p>
                    <p className="text-xs text-subtle">Declined</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-2xl font-bold text-heading">{stats.tasksDone}<span className="text-base font-normal text-subtle">/{stats.tasksTotal}</span></p>
                    <p className="text-xs text-subtle">Tasks Done</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-2xl font-bold text-heading">{stats.vendorsTotal}</p>
                    <p className="text-xs text-subtle">Vendors</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
                    <p className="text-lg font-bold text-heading">${stats.budgetActual.toLocaleString()}</p>
                    <p className="text-xs text-subtle">of ${stats.budgetEstimated.toLocaleString()} budget</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-surface p-5 rounded-lg shadow hover:shadow-md transition-shadow border border-app-border text-center"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-semibold text-heading">{item.label}</p>
              <p className="text-xs text-subtle mt-1">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
