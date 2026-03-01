import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventDashboard from "./event-dashboard";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-heading">Wedding Planner</h1>
          <p className="text-body">Plan your perfect day, together.</p>
          <div className="space-x-4">
            <a href="/auth/login" className="bg-rose-app text-white px-6 py-2 rounded-lg hover:bg-rose-app-hover">
              Sign In
            </a>
            <a href="/auth/sign-up" className="bg-surface text-rose-app border border-rose-app px-6 py-2 rounded-lg hover:bg-rose-light-bg">
              Sign Up
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Fetch user's events
  const { data: memberships } = await supabase
    .from("event_members")
    .select("event_id, role, events(id, name, wedding_date, venue)")
    .eq("user_id", user.id);

  return <EventDashboard memberships={memberships || []} userId={user.id} />;
}
