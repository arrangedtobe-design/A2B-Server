import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MembersList from "./members-list";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <MembersList userId={user.id} />;
}