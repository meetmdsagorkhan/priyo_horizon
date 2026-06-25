import Link from "next/link";
import { GlassCard } from "@/components/launch/glass-card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      payment: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Applications</h1>
          <p className="text-muted mt-2">Manage LLC formations and pending documents.</p>
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/80">
            <thead className="bg-white/5 text-xs uppercase text-white/60">
              <tr>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Founder</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Submitted</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted">
                    No applications found.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white">
                      {app.companyName || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      {app.user.name} <br />
                      <span className="text-xs text-muted">{app.user.email}</span>
                    </td>
                    <td className="px-6 py-4 capitalize">{app.selectedPlan}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          app.status === "approved"
                            ? "bg-green-500/10 text-green-400"
                            : app.status === "in_review"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : app.status === "submitted"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        {app.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {app.submittedAt
                        ? new Date(app.submittedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                        : "Draft"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/${app.id}`}
                        className="inline-flex items-center text-primary hover:text-primary/80 hover:underline"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
