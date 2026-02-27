import { redirect } from "next/navigation";

export const dynamic = "force-static";

export default function Home() {
  // Next applies `basePath` automatically to redirects.
  redirect("/dashboard");
}
