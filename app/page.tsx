import { getSessionStore } from "@/lib/session-store";
import { getJobs } from "@/lib/jobs";
import Dashboard from "@/components/dashboard/client-dashboard";

export default async function HomePage() {
  const session = await getSessionStore();
  const initialJobs = await getJobs();
  return <Dashboard initialAnalysis={session.latestAnalysis} initialJobs={initialJobs} />;
}
