import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function IndexPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.must_change_password) {
    redirect("/change-password");
  }

  if (user.role === "ADMIN") {
    redirect("/admin/dashboard");
  } else if (user.role === "RC") {
    redirect("/rc/dashboard");
  } else if (user.role === "STUDENT") {
    redirect("/student/dashboard");
  }

  redirect("/login");
}
