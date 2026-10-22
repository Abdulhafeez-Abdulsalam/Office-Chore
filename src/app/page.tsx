import { ChoreApp } from "@/components/ChoreApp";
import { getActiveMembers } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const members = await getActiveMembers();
  return <ChoreApp members={members} />;
}
