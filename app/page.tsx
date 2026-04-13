import { getSessionStore } from "@/lib/session-store";
import Dashboard from "@/components/dashboard/client-dashboard";

export default async function HomePage() {
  const session = await getSessionStore();
  return <Dashboard initialAnalysis={session.latestAnalysis} />;
}
