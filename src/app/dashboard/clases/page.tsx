import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClasesClient from "./clases-client";

export default async function MisClasesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  return <ClasesClient />;
}
