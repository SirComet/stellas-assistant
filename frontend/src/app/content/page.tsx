import { redirect } from "next/navigation";

/** Redirect /content to /content/blog by default. */
export default function ContentPage() {
  redirect("/content/blog");
}
