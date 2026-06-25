"use client";

import { Building2, FileText, Loader2, MailCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { GlassCard } from "@/components/launch/glass-card";
import { LOCAL_SUBMISSION_KEY, PLAN_DETAILS } from "@/lib/launch-config";

export function DashboardShell({ initialDraftToken }: { initialDraftToken?: string }) {
  const [payload, setPayload] = useState<{
    status: string;
    payment: { paymentStatus: string } | null;
    values: {
      selectedPlan: keyof typeof PLAN_DETAILS;
      company: { primaryLLCName: string };
      founder: {
        fullLegalName: string;
        passportDocument: { id: string; fileName: string; size: number; uploadStatus: string } | null;
      };
      stateOfFormation: string;
      bankingSetup: { wantPriyoPayBusinessAccount: boolean };
      documents?: { id: string; fileName: string; size: number; uploadStatus: string; type: string }[];
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = initialDraftToken || window.localStorage.getItem(LOCAL_SUBMISSION_KEY);
    if (!token) {
      setError("No submitted application found on this device yet.");
      setLoading(false);
      return;
    }

    fetch(`/api/launch/drafts/${token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load dashboard.");
        }
        return data;
      })
      .then((data) => setPayload(data))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard."))
      .finally(() => setLoading(false));
  }, [initialDraftToken]);

  if (loading) {
    return <div className="glass-panel flex items-center gap-3 px-5 py-4 text-white"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading dashboard...</div>;
  }

  if (error || !payload) {
    return <GlassCard className="p-6 text-white"><p className="text-lg font-semibold">Dashboard unavailable</p><p className="mt-2 text-sm text-muted">{error || "No dashboard data available."}</p></GlassCard>;
  }

  const plan = PLAN_DETAILS[payload.values.selectedPlan];
  const docs = payload.values.documents || (payload.values.founder.passportDocument ? [payload.values.founder.passportDocument] : []);

  return (
    <div className="space-y-6">
      <GlassCard className="p-8">
        <p className="mono-label mb-3">Priyo Launch dashboard</p>
        <h1 className="text-4xl font-semibold text-white">{payload.values.company.primaryLLCName || "Your company application"}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">Status: <span className="text-primary">{payload.status.replace("_", " ")}</span>. Priyo will coordinate formation, EIN support, and any requested banking setup from here.</p>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-3">
        {[{ icon: Building2, title: "Package", value: `${plan.name} • ${plan.priceLabel}` }, { icon: Wallet, title: "Payment status", value: payload.payment?.paymentStatus || "pending" }, { icon: MailCheck, title: "Next update", value: "By email once review begins" }].map((item) => {
          const Icon = item.icon;
          return <GlassCard key={item.title} className="p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-primary"><Icon className="h-5 w-5" /></div><p className="mt-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted">{item.title}</p><p className="mt-2 text-xl font-semibold text-white">{item.value}</p></GlassCard>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white">Submission summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><span className="text-muted">Founder</span><span className="text-white">{payload.values.founder.fullLegalName}</span></div>
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><span className="text-muted">Formation state</span><span className="text-white">{payload.values.stateOfFormation.replace("_", " ")}</span></div>
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><span className="text-muted">Priyo Pay requested</span><span className="text-white">{payload.values.bankingSetup.wantPriyoPayBusinessAccount ? "Yes" : "No"}</span></div>
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><span className="text-muted">Package pricing</span><span className="text-white">{plan.priceLabel}</span></div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white">Your Documents</h2>
          <div className="mt-5 space-y-3">
            {docs.length ? docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${doc.uploadStatus === "generated" ? "bg-green-500/20 text-green-400" : "bg-white/6 text-primary"}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{doc.fileName || (doc as any).type?.replace("_", " ") || "Document"}</p>
                    <p className="text-xs text-muted">{Math.round((doc.size || 0) / 1024)} KB</p>
                  </div>
                </div>
                <span className={`font-mono text-[11px] uppercase tracking-[0.24em] ${doc.uploadStatus === "generated" ? "text-green-400" : "text-primary"}`}>
                  {doc.uploadStatus?.replace("_", " ") || "Uploaded"}
                </span>
              </div>
            )) : <p className="text-sm text-muted">No documents are attached yet.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}


