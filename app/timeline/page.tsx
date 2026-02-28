import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TimelineView from "./timeline-view";

export default async function TimelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <TimelineView userId={user.id} />;
}