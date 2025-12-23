import { redirect } from "next/navigation";

export default function SignupPage() {
  // Signup requires an invite - redirect to homepage where users can join waitlist
  redirect("/");
}
