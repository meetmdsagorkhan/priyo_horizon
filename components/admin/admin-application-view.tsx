"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/launch/glass-card";
import { UploadDropzone } from "@/components/launch/upload-dropzone";
import { Loader2, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function AdminApplicationView({ application }: { application: any }) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        router.refresh();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const documentTypes = [
    { type: "ein_letter", label: "EIN Letter" },
    { type: "formation_certificate", label: "Formation Certificate" },
    { type: "operating_agreement", label: "Operating Agreement" },
  ];

  const handleDocumentUploadComplete = () => {
    setActiveUploadType(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center text-sm text-muted hover:text-white transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to applications
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{application.companyName || "N/A"}</h1>
          <p className="text-muted mt-2">Application details and management.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted">Status</label>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isUpdating}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="needs_action">Needs Action</option>
            <option value="rejected">Rejected</option>
          </select>
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Founder Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Name</dt><dd className="text-white">{application.user.name}</dd></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Email</dt><dd className="text-white">{application.user.email}</dd></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Phone</dt><dd className="text-white">{application.user.phone}</dd></div>
          </dl>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Company Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Primary Name</dt><dd className="text-white">{application.companyName}</dd></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Formation State</dt><dd className="text-white capitalize">{application.stateOfFormation?.replace("_", " ")}</dd></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Plan</dt><dd className="text-white capitalize">{application.selectedPlan}</dd></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><dt className="text-muted">Submitted At</dt><dd className="text-white">{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : 'N/A'}</dd></div>
          </dl>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Final Documents</h2>
        <p className="text-sm text-muted mb-6">Upload generated documents (EIN, Certificate, etc.) for the user to download from their dashboard.</p>
        
        <div className="grid gap-4 md:grid-cols-3">
          {documentTypes.map((docType) => {
            const uploadedDoc = application.documents?.find((d: any) => d.type === docType.type && d.uploadStatus !== "pending_upload");
            
            return (
              <div key={docType.type} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center justify-center text-center">
                {uploadedDoc ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                    <h3 className="font-medium text-white">{docType.label}</h3>
                    <p className="text-xs text-muted mt-1">{uploadedDoc.fileName}</p>
                    <button onClick={() => setActiveUploadType(docType.type)} className="mt-3 text-xs text-primary hover:underline">Re-upload</button>
                  </>
                ) : (
                  <>
                    <FileText className="h-8 w-8 text-muted mb-2" />
                    <h3 className="font-medium text-white">{docType.label}</h3>
                    <button 
                      onClick={() => setActiveUploadType(docType.type)}
                      className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
                    >
                      Upload
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {activeUploadType && (
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">
                Uploading: {documentTypes.find(d => d.type === activeUploadType)?.label}
              </h3>
              <button onClick={() => setActiveUploadType(null)} className="text-sm text-muted hover:text-white">Cancel</button>
            </div>
            <UploadDropzone
              label="Upload Document"
              value={null}
              draftToken={application.draftToken}
              documentType={activeUploadType}
              onUploaded={handleDocumentUploadComplete}
              uploadUrlEndpoint={`/api/admin/applications/${application.id}/documents`}
            />
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Uploaded by User</h2>
        <div className="space-y-3">
          {application.documents?.filter((d: any) => d.type === "passport_id" || d.type === "proof_of_address").map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted" />
                <div>
                  <p className="text-sm font-medium text-white">{doc.fileName}</p>
                  <p className="text-xs text-muted capitalize">{doc.type.replace("_", " ")}</p>
                </div>
              </div>
              <span className="text-xs text-muted">{Math.round(doc.size / 1024)} KB</span>
            </div>
          ))}
          {(!application.documents || application.documents.filter((d: any) => d.type === "passport_id" || d.type === "proof_of_address").length === 0) && (
            <p className="text-sm text-muted">No user documents uploaded.</p>
          )}
        </div>
      </GlassCard>

    </div>
  );
}
