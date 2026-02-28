import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GuestList from "./guest-list";

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <GuestList userId={user.id} />;
}