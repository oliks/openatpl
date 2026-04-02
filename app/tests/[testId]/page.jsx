import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyTestSetupRedirect({ params }) {
  const resolvedParams = await params;
  redirect(`/create-test?subject=${encodeURIComponent(resolvedParams.testId)}`);
}
