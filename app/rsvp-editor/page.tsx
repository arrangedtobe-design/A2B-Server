import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RsvpEditor from "./rsvp-editor";

export default async function RsvpEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <RsvpEditor userId={user.id} />;
}
