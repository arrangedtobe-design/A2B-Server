"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";


export default function Dashboard() {
  const [event, setEvent] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
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
  ];

  const canManageMembers = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "planner";

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-3xl font-bold text-heading">{event.name}</h1>
            <div className="flex gap-3 text-sm text-subtle mt-1">
              {event.wedding_date && (
                <span>{new Date(event.wedding_date + "T00:00:00").toLocaleDateString()}</span>
              )}
              {event.venue && <span>{event.venue}</span>}
              <span>{membership?.role}</span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={switchEvent} className="text-sm text-subtle hover:text-body">
              Switch
            </button>
            <button onClick={handleSignOut} className="text-sm text-subtle hover:text-body">
              Sign Out
            </button>
          </div>
        </div>

        <div className="mt-4 mb-8 flex items-center gap-2">
          <span className="text-sm text-subtle">{members.length} member{members.length !== 1 ? "s" : ""}</span>
          {canManageMembers && (
            <Link href="/members" className="text-sm text-rose-app hover:text-rose-app-hover">+ Invite</Link>
          )}
        </div>

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
