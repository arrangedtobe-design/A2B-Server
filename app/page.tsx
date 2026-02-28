import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventDashboard from "./event-dashboard";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-gray-900">Wedding Planner</h1>
          <p className="text-gray-600">Plan your perfect day, together.</p>
          <div className="space-x-4">
            <a href="/auth/login" className="bg-rose-600 text-white px-6 py-2 rounded-lg hover:bg-rose-700">
              Sign In
            </a>
            <a href="/auth/sign-up" className="bg-white text-rose-600 border border-rose-600 px-6 py-2 rounded-lg hover:bg-rose-50">
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