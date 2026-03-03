import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventSettings from "./event-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <EventSettings userId={user.id} />;
}
