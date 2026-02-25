import { redirect } from "next/navigation";

export default function Home() {
  // Next applies `basePath` automatically to redirects.
  redirect("/dashboard");
}
