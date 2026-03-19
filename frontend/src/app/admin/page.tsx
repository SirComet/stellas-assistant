import { redirect } from "next/navigation";

/** Redirect /admin to /admin/users by default. */
export default function AdminPage() {
  redirect("/admin/users");
}
