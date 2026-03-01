"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useThemeColors } from "@/lib/use-theme-colors";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  partner: "Partner",
  planner: "Planner",
  bridal_party: "Bridal Party",
};

export default function MembersList({ userId }: { userId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("partner");
  const [displayName, setDisplayName] = useState("");
  const [myRole, setMyRole] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const themeColors = useThemeColors();
  const ROLE_COLORS = themeColors.roleColors;

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) {
      router.push("/");
      return;
    }
    setEventId(eid);
    fetchMembers(eid);
  }, []);

  const fetchMembers = async (eid: string) => {
    const { data } = await supabase
      .from("event_members")
      .select("*")
      .eq("event_id", eid)
      .order("created_at", { ascending: true });

    setMembers(data || []);

    const me = data?.find((m: any) => m.user_id === userId);
    setMyRole(me?.role || null);

    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !eventId) return;

    setError(null);
    setSuccess(null);

    const { data: foundUser, error: rpcError } = await supabase
      .rpc("get_user_id_by_email", { email_input: email.trim().toLowerCase() });

    if (rpcError || !foundUser) {
      setError("No account found with that email. They need to sign up first.");
      return;
    }

    // Check if already a member
    const existing = members.find((m: any) => m.user_id === foundUser);
    if (existing) {
      setError("This person is already a member of this event.");
      return;
    }

    const { error: insertError } = await supabase
      .from("event_members")
      .insert({
        event_id: eventId,
        user_id: foundUser,
        role: role,
        display_name: displayName.trim() || null,
      });

    if (insertError) {
      setError("Failed to add member: " + insertError.message);
      return;
    }

    setSuccess(`${email} added as ${ROLE_LABELS[role]}!`);
    setEmail("");
    setDisplayName("");
    fetchMembers(eventId);
  };

  const removeMember = async (memberId: string, memberUserId: string) => {
    if (!eventId) return;
    if (memberUserId === userId) {
      setError("You can't remove yourself.");
      return;
    }

    await supabase.from("event_members").delete().eq("id", memberId);
    fetchMembers(eventId);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  const canManage = myRole === "owner" || myRole === "partner" || myRole === "planner";

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-heading">Wedding Team</h1>
          <Link href="/dashboard" className="text-sm text-rose-app hover:text-rose-app-hover">← Dashboard</Link>
        </div>

        {/* Current Members */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-heading mb-3">Members ({members.length})</h2>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="bg-surface p-3 rounded-lg shadow-sm border border-app-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-heading">
                      {member.display_name || member.user_id.slice(0, 8) + "..."}
                      {member.user_id === userId && " (you)"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}>
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
                {canManage && myRole === "owner" && member.user_id !== userId && (
                  <button
                    onClick={() => removeMember(member.id, member.user_id)}
                    className="text-subtle hover:text-red-500 text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Invite Form */}
        {canManage && (
          <div className="bg-surface p-4 rounded-lg shadow border border-app-border">
            <h2 className="font-semibold text-heading mb-3">Invite Someone</h2>
            <p className="text-sm text-subtle mb-3">
              They must have an account first. Share the sign-up link with them, then add their email here.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-body mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="karina@example.com"
                  required
                  className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-body mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
                  >
                    <option value="partner">Partner (full access)</option>
                    <option value="planner">Planner (full access)</option>
                    <option value="bridal_party">Bridal Party (limited)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-body mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Karina"
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
              <button
                type="submit"
                className="w-full bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover font-medium"
              >
                Add to Wedding
              </button>
            </form>
          </div>
        )}

        {!canManage && (
          <p className="text-center text-subtle text-sm">Only owners, partners, and planners can invite members.</p>
        )}
      </div>
    </div>
  );
}
