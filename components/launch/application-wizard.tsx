"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import type { ZodIssue } from "zod";

import { Button } from "@/components/ui/button";
import {
  BUSINESS_MODEL_OPTIONS,
  CUSTOMER_REGION_OPTIONS,
  FORMATION_STATE_OPTIONS,
  INDUSTRY_OPTIONS,
  LOCAL_DRAFT_KEY,
  LOCAL_SUBMISSION_KEY,
  PAYMENT_METHOD_OPTIONS,
  PLAN_DETAILS,
  REVENUE_OPTIONS,
  STEP_META,
} from "@/lib/launch-config";
import { createDefaultDraft, normalizeDraft } from "@/lib/launch-data";
import type { ApplicationDraftValues, LaunchPlan } from "@/lib/types";
import {
  applicationDraftSchema,
  bankingSetupSchema,
  businessAddressSchema,
  companySchema,
  founderSchema,
  ownershipSchema,
} from "@/lib/validation";
import { cn, toTitleCase } from "@/lib/utils";

import { FintechInput, SelectField, TextareaField } from "./form-fields";
import { GlassCard } from "./glass-card";
import { ProgressBar } from "./progress-bar";
import { ReviewPanel } from "./review-panel";
import { StepRail } from "./step-rail";

const TOTAL_STEPS = 7;

function getError(errors: FieldErrors<ApplicationDraftValues>, path: string) {
  let current: unknown = errors;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (!current || typeof current !== "object") {
    return undefined;
  }
  return (current as { message?: string }).message;
}

function pathFromIssue(prefix: string, issue: ZodIssue) {
  const suffix = issue.path.length ? `.${issue.path.join(".")}` : "";
  return `${prefix}${suffix}` as Path<ApplicationDraftValues>;
}

function checkboxCard(active: boolean) {
  return cn(
    "flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
    active ? "border-primary/40 bg-primary/10 text-white" : "border-white/10 bg-white/[0.03] text-muted hover:border-primary/20 hover:text-white",
  );
}

export function ApplicationWizard({ initialPlan }: { initialPlan: LaunchPlan }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("Draft saved locally until your secure record is created.");
  const autosaveRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<ApplicationDraftValues>({
    defaultValues: createDefaultDraft(initialPlan),
    mode: "onBlur",
  });

  const {
    register,
    control,
    reset,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = form;

  const currentValues = useWatch({ control });
  const currentStep = useWatch({ control, name: "currentStep" }) || 1;
  const selectedPlan = useWatch({ control, name: "selectedPlan" }) || initialPlan;
  const soleOwner = useWatch({ control, name: "ownership.soleOwner" });
  const wantPriyoPay = useWatch({ control, name: "bankingSetup.wantPriyoPayBusinessAccount" });
  const businessAddressMode = useWatch({ control, name: "businessAddress.mode" });

  const { fields, replace } = useFieldArray({
    control,
    name: "ownership.owners",
  });

  useEffect(() => {
    let mounted = true;

    async function hydrateDraft() {
      const localDraft = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_DRAFT_KEY) : null;
      let draft = createDefaultDraft(initialPlan);

      if (localDraft) {
        try {
          const parsed = JSON.parse(localDraft) as ApplicationDraftValues;
          draft = normalizeDraft(parsed, initialPlan);
        } catch {
          draft = createDefaultDraft(initialPlan);
        }
      }

      if (draft.draftToken) {
        try {
          const response = await fetch(`/api/launch/drafts/${draft.draftToken}`);
          if (response.ok) {
            const payload = await response.json();
            if (mounted) {
              reset(normalizeDraft(payload.values, initialPlan));
              setSaveMessage("Draft restored from your secure Priyo Launch record.");
            }
          } else if (mounted) {
            reset(normalizeDraft(draft, initialPlan));
          }
        } catch {
          if (mounted) {
            reset(normalizeDraft(draft, initialPlan));
          }
        }
      } else if (mounted) {
        reset(normalizeDraft(draft, initialPlan));
      }

      if (mounted) {
        setHydrated(true);
        setIsBootstrapping(false);
      }
    }

    void hydrateDraft();

    return () => {
      mounted = false;
    };
  }, [initialPlan, reset]);

  useEffect(() => {
    if (!hydrated || !currentValues) {
      return;
    }

    window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(normalizeDraft(currentValues, initialPlan)));
  }, [currentValues, hydrated, initialPlan]);

  useEffect(() => {
    if (!hydrated || !currentValues?.draftToken) {
      return;
    }

    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
    }

    autosaveRef.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/launch/drafts/${currentValues.draftToken}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: currentValues }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Autosave failed.");
        }
        setSaveState("saved");
        setSaveMessage("Draft synced to your secure Priyo Launch record.");
      } catch (error) {
        setSaveState("error");
        setSaveMessage(error instanceof Error ? error.message : "Autosave failed.");
      }
    }, 900);

    return () => {
      if (autosaveRef.current) {
        clearTimeout(autosaveRef.current);
      }
    };
  }, [currentValues, hydrated]);

  useEffect(() => {
    if (!soleOwner) {
      const totalOwners = getValues("ownership.numberOfOwners");
      if (fields.length !== totalOwners) {
        replace(
          Array.from({ length: totalOwners }, (_, index) => {
            const existing = fields[index] as (typeof fields)[number] | undefined;
            return existing ?? {
              id: `${index}`,
              name: "",
              ownershipPercentage: Number((100 / totalOwners).toFixed(0)),
              citizenshipCountry: "",
              address: { street: "", city: "", state: "", postalCode: "", country: "" },
            };
          }) as never[],
        );
      }
      return;
    }

    replace([
      {
        id: "sole-owner",
        name: getValues("founder.fullLegalName"),
        ownershipPercentage: 100,
        citizenshipCountry: "",
        address: { street: "", city: "", state: "", postalCode: "", country: "" },
      },
    ] as never[]);
    setValue("ownership.numberOfOwners", 1, { shouldDirty: true });
  }, [fields, getValues, replace, setValue, soleOwner]);

  // Clear errors when switching to step 1
  useEffect(() => {
    if (currentStep === 1) {
      clearErrors();
    }
  }, [currentStep, clearErrors]);

  const currentPlan = PLAN_DETAILS[selectedPlan];

  const reviewSections = useMemo(() => {
    const values = normalizeDraft(getValues(), initialPlan);
    return [
      {
        title: "Founder information",
        rows: [
          { label: "Name", value: values.founder.fullLegalName || "-" },
          { label: "Email", value: values.founder.emailAddress || "-" },
          { label: "Phone", value: values.founder.phoneNumber || "-" },
        ],
      },
      {
        title: "Company details",
        rows: [
          { label: "Primary name", value: values.company.primaryLLCName || "-" },
          { label: "Alternative name", value: values.company.alternativeLLCName || "-" },
          { label: "Industry", value: values.company.industry ? toTitleCase(values.company.industry) : "-" },
          { label: "Formation state", value: values.stateOfFormation ? toTitleCase(values.stateOfFormation) : "-" },
        ],
      },
      {
        title: "Ownership",
        rows: values.ownership.owners.map((owner, index) => ({
          label: `Owner ${index + 1}`,
          value: `${owner.name || "Unfilled"} - ${owner.ownershipPercentage || 0}%`,
        })),
      },
      {
        title: "Services selected",
        rows: [
          { label: "Plan", value: currentPlan.name },
          { label: "Registered Agent", value: values.businessAddress.addRegisteredAgent ? "Included" : "Not selected" },
          { label: "Business address", value: values.businessAddress.mode === "custom" ? "Custom address" : "Use Priyo registered address" },
          { label: "Priyo Pay", value: values.bankingSetup.wantPriyoPayBusinessAccount ? "Requested" : "Not requested" },
        ],
      },
      {
        title: "Banking setup",
        rows: [
          { label: "Revenue", value: values.bankingSetup.expectedMonthlyRevenue ? toTitleCase(values.bankingSetup.expectedMonthlyRevenue) : "-" },
          { label: "Business model", value: values.bankingSetup.businessModel ? toTitleCase(values.bankingSetup.businessModel) : "-" },
          { label: "Customer regions", value: values.bankingSetup.expectedCustomerRegions.length ? values.bankingSetup.expectedCustomerRegions.map(toTitleCase).join(", ") : "-" },
          { label: "Payment methods", value: values.bankingSetup.requiredPaymentMethods.length ? values.bankingSetup.requiredPaymentMethods.map(toTitleCase).join(", ") : "-" },
        ],
      },
    ];
  }, [currentPlan.name, getValues, initialPlan]);

  const setIssues = (prefix: string, issues: ZodIssue[]) => {
    issues.forEach((issue) => {
      setError(pathFromIssue(prefix, issue), { type: "manual", message: issue.message });
    });
  };

  const ensureDraftToken = async () => {
    const values = normalizeDraft(getValues(), initialPlan);
    if (values.draftToken) {
      return values.draftToken;
    }

    clearErrors();
    const founderCheck = founderSchema.safeParse(values.founder);
    if (!founderCheck.success) {
      setIssues("founder", founderCheck.error.issues);
      setSaveState("error");
      setSaveMessage("Complete founder details before uploading documents.");
      return null;
    }

    setSaveState("saving");
    const response = await fetch("/api/launch/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setSaveState("error");
      setSaveMessage(payload.error || "Unable to create draft.");
      return null;
    }

    setValue("applicationId", payload.values.applicationId, { shouldDirty: false });
    setValue("draftToken", payload.values.draftToken, { shouldDirty: false });
    setSaveState("saved");
    setSaveMessage("Secure draft created. Uploads and autosave are now active.");
    return payload.values.draftToken as string;
  };

  const validateStep = async (step: number) => {
    const values = normalizeDraft(getValues(), initialPlan);
    if (step === 1) {
      console.log('Step 1 - skipping validation, allowing forward movement');
      return true;
    }

    if (step === 2) {
      const result = companySchema.safeParse(values.company);
      if (!result.success) {
        setIssues("company", result.error.issues);
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (!values.stateOfFormation) {
        setError("stateOfFormation", { type: "manual", message: "Select a formation state." });
        return false;
      }
      return true;
    }

    if (step === 4) {
      const result = ownershipSchema.safeParse(values.ownership);
      if (!result.success) {
        setIssues("ownership", result.error.issues);
        return false;
      }
      return true;
    }

    if (step === 5) {
      const result = businessAddressSchema.safeParse(values.businessAddress);
      if (!result.success) {
        setIssues("businessAddress", result.error.issues);
        return false;
      }
      return true;
    }

    if (step === 6) {
      const result = bankingSetupSchema.safeParse(values.bankingSetup);
      if (!result.success) {
        setIssues("bankingSetup", result.error.issues);
        return false;
      }
      return true;
    }

    const finalResult = applicationDraftSchema.safeParse(values);
    if (!finalResult.success) {
      finalResult.error.issues.forEach((issue) => {
        const path = issue.path.join(".") as Path<ApplicationDraftValues>;
        setError(path, { type: "manual", message: issue.message });
      });
      return false;
    }

    return true;
  };

  const goToStep = (step: number) => {
    setValue("currentStep", step, { shouldDirty: true });
  };

  const handleContinue = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      return;
    }

    if (currentStep === 1 && !getValues("draftToken")) {
      const draftToken = await ensureDraftToken();
      if (!draftToken) {
        return;
      }
    }

    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    }
  };

  const handleSubmit = async () => {
    const isValid = await validateStep(7);
    if (!isValid) {
      return;
    }

    let draftToken: string | null | undefined = getValues("draftToken");
    if (!draftToken) {
      draftToken = await ensureDraftToken();
      if (!draftToken) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const normalizedValues = normalizeDraft(getValues(), initialPlan);
      const response = await fetch(`/api/launch/drafts/${draftToken}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: normalizedValues }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit application.");
      }
      window.localStorage.setItem(LOCAL_SUBMISSION_KEY, draftToken);
      window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(normalizeDraft(payload.values, initialPlan)));
      router.push(`/launch/success?draft=${draftToken}`);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Unable to submit application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="glass-panel flex items-center gap-3 px-6 py-4 text-sm text-white">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading your Priyo Launch draft...
        </div>
      </div>
    );
  }

  return (
    <div className="launch-shell min-h-screen">
      <div className="section-shell pb-6 pt-8">
        <div className="glass-panel sticky top-4 z-30 mb-8 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mono-label mb-2">Priyo Launch application</p>
              <h1 className="text-2xl font-semibold text-white">Atlas-style onboarding for global founders</h1>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">Selected plan</p>
              <p className="mt-1 text-lg font-semibold text-white">{currentPlan.name} <span className="font-mono text-primary">{currentPlan.priceLabel}</span></p>
            </div>
          </div>
          <div className="mt-5">
            <ProgressBar step={currentStep} total={TOTAL_STEPS} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <StepRail currentStep={currentStep} />
          <div className="space-y-6">
            <div className="glass-panel p-4 sm:hidden">
              <div className="scrollbar-none flex gap-3 overflow-x-auto">
                {STEP_META.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={cn(
                      "min-w-[140px] rounded-2xl border px-4 py-3 text-left transition",
                      step.id === currentStep ? "border-primary/40 bg-primary/12 text-white" : "border-white/10 bg-white/[0.03] text-muted",
                    )}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em]">Step {step.id}</div>
                    <div className="mt-2 text-sm font-semibold">{step.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <GlassCard className="p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="mono-label mb-2">{STEP_META[currentStep - 1]?.caption}</p>
                  <h2 className="text-2xl font-semibold text-white">{STEP_META[currentStep - 1]?.label}</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
                  <Save className="h-4 w-4 text-primary" />
                  {saveState === "saving" ? "Saving" : saveState === "error" ? "Needs attention" : "Autosave"}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-6"
                >
                  {currentStep === 1 ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <FintechInput label="Full Legal Name" {...register("founder.fullLegalName")} error={getError(errors, "founder.fullLegalName")} />
                      <FintechInput label="Email Address" type="email" {...register("founder.emailAddress")} error={getError(errors, "founder.emailAddress")} />
                      <FintechInput label="Phone Number" {...register("founder.phoneNumber")} error={getError(errors, "founder.phoneNumber")} />
                    </div>
                  ) : null}

                  {currentStep === 2 ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <FintechInput label="Primary LLC Name" {...register("company.primaryLLCName")} error={getError(errors, "company.primaryLLCName")} />
                      <FintechInput label="Alternative LLC Name" {...register("company.alternativeLLCName")} error={getError(errors, "company.alternativeLLCName")} />
                      <SelectField label="Business Industry" {...register("company.industry")} error={getError(errors, "company.industry")}>
                        <option value="">Select industry</option>
                        {INDUSTRY_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                      </SelectField>
                      <FintechInput label="Business Website (optional)" placeholder="https://example.com" {...register("company.businessWebsite")} error={getError(errors, "company.businessWebsite")} />
                      <TextareaField label="Business Description" className="md:col-span-2" {...register("company.businessDescription")} error={getError(errors, "company.businessDescription")} />
                    </div>
                  ) : null}

                  {currentStep === 3 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {FORMATION_STATE_OPTIONS.map((option) => (
                        <label key={option.value} className={checkboxCard(getValues("stateOfFormation") === option.value)}>
                          <div>
                            <p className="text-base font-semibold text-white">{option.label}</p>
                            <p className="mt-2 text-sm leading-6 text-muted">{option.benefits}</p>
                          </div>
                          <input type="radio" value={option.value} className="h-4 w-4 accent-[var(--primary)]" {...register("stateOfFormation")} />
                        </label>
                      ))}
                      {getError(errors, "stateOfFormation") ? <p className="text-sm text-rose-300 md:col-span-2">{getError(errors, "stateOfFormation")}</p> : null}
                    </div>
                  ) : null}

                  {currentStep === 4 ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-[160px_1fr] md:items-end">
                        <FintechInput label="Number of Owners" type="number" min={1} max={10} disabled={soleOwner} {...register("ownership.numberOfOwners", { valueAsNumber: true })} error={getError(errors, "ownership.numberOfOwners")} />
                        <label className={checkboxCard(soleOwner)}>
                          <div>
                            <p className="text-base font-semibold text-white">I am the sole owner</p>
                            <p className="mt-2 text-sm text-muted">We will mirror founder details for ownership and set the split to 100%.</p>
                          </div>
                          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...register("ownership.soleOwner")} />
                        </label>
                      </div>

                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <GlassCard key={field.id} className="p-5">
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-white">Owner {index + 1}</h3>
                              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">{getValues(`ownership.owners.${index}.ownershipPercentage`)}%</span>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <FintechInput label="Owner Name" disabled={soleOwner} {...register(`ownership.owners.${index}.name` as const)} error={getError(errors, `ownership.owners.${index}.name`)} />
                              <FintechInput label="Ownership Percentage" type="number" disabled={soleOwner} {...register(`ownership.owners.${index}.ownershipPercentage` as const, { valueAsNumber: true })} error={getError(errors, `ownership.owners.${index}.ownershipPercentage`)} />
                              <FintechInput label="Country of Citizenship" disabled={soleOwner} {...register(`ownership.owners.${index}.citizenshipCountry` as const)} error={getError(errors, `ownership.owners.${index}.citizenshipCountry`)} />
                              <FintechInput label="Street" disabled={soleOwner} {...register(`ownership.owners.${index}.address.street` as const)} error={getError(errors, `ownership.owners.${index}.address.street`)} />
                              <FintechInput label="City" disabled={soleOwner} {...register(`ownership.owners.${index}.address.city` as const)} error={getError(errors, `ownership.owners.${index}.address.city`)} />
                              <FintechInput label="State / Province" disabled={soleOwner} {...register(`ownership.owners.${index}.address.state` as const)} error={getError(errors, `ownership.owners.${index}.address.state`)} />
                              <FintechInput label="Postal Code" disabled={soleOwner} {...register(`ownership.owners.${index}.address.postalCode` as const)} error={getError(errors, `ownership.owners.${index}.address.postalCode`)} />
                              <FintechInput label="Country" disabled={soleOwner} {...register(`ownership.owners.${index}.address.country` as const)} error={getError(errors, `ownership.owners.${index}.address.country`)} />
                            </div>
                          </GlassCard>
                        ))}
                      </div>
                      {getError(errors, "ownership.owners") ? <p className="text-sm text-rose-300">{getError(errors, "ownership.owners")}</p> : null}
                    </div>
                  ) : null}

                  {currentStep === 5 ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={checkboxCard(businessAddressMode === "priyo_registered_address")}>
                          <div>
                            <p className="text-base font-semibold text-white">Use Priyo Registered Address</p>
                            <p className="mt-2 text-sm text-muted">Best for founders who want a turnkey U.S. setup.</p>
                          </div>
                          <input type="radio" value="priyo_registered_address" className="h-4 w-4 accent-[var(--primary)]" {...register("businessAddress.mode")} />
                        </label>
                        <label className={checkboxCard(businessAddressMode === "custom")}>
                          <div>
                            <p className="text-base font-semibold text-white">Provide Custom Address</p>
                            <p className="mt-2 text-sm text-muted">Use your own U.S. address if you already have one available.</p>
                          </div>
                          <input type="radio" value="custom" className="h-4 w-4 accent-[var(--primary)]" {...register("businessAddress.mode")} />
                        </label>
                      </div>

                      {businessAddressMode === "custom" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <FintechInput label="Street" {...register("businessAddress.customAddress.street")} error={getError(errors, "businessAddress.customAddress.street")} />
                          <FintechInput label="City" {...register("businessAddress.customAddress.city")} error={getError(errors, "businessAddress.customAddress.city")} />
                          <FintechInput label="State" {...register("businessAddress.customAddress.state")} error={getError(errors, "businessAddress.customAddress.state")} />
                          <FintechInput label="ZIP Code" {...register("businessAddress.customAddress.postalCode")} error={getError(errors, "businessAddress.customAddress.postalCode")} />
                          <FintechInput label="Country" className="md:col-span-2" {...register("businessAddress.customAddress.country")} error={getError(errors, "businessAddress.customAddress.country")} />
                        </div>
                      ) : null}

                      <label className={checkboxCard(Boolean(getValues("businessAddress.addRegisteredAgent")))}>
                        <div>
                          <p className="text-base font-semibold text-white">Add Registered Agent service</p>
                          <p className="mt-2 text-sm text-muted">Recommended to maintain good standing and receive legal notices.</p>
                        </div>
                        <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...register("businessAddress.addRegisteredAgent")} />
                      </label>
                    </div>
                  ) : null}

                  {currentStep === 6 ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={checkboxCard(Boolean(wantPriyoPay))}>
                          <div>
                            <p className="text-base font-semibold text-white">Yes, I want a Priyo Pay Business Account</p>
                            <p className="mt-2 text-sm text-muted">We will evaluate banking readiness alongside formation.</p>
                          </div>
                          <input type="radio" checked={Boolean(wantPriyoPay)} onChange={() => setValue("bankingSetup.wantPriyoPayBusinessAccount", true, { shouldDirty: true })} className="h-4 w-4 accent-[var(--primary)]" />
                        </label>
                        <label className={checkboxCard(!wantPriyoPay)}>
                          <div>
                            <p className="text-base font-semibold text-white">No, formation only for now</p>
                            <p className="mt-2 text-sm text-muted">You can still complete formation and add banking later.</p>
                          </div>
                          <input type="radio" checked={!wantPriyoPay} onChange={() => setValue("bankingSetup.wantPriyoPayBusinessAccount", false, { shouldDirty: true })} className="h-4 w-4 accent-[var(--primary)]" />
                        </label>
                      </div>

                      {wantPriyoPay ? (
                        <div className="grid gap-5 md:grid-cols-2">
                          <SelectField label="Expected Monthly Revenue" {...register("bankingSetup.expectedMonthlyRevenue")} error={getError(errors, "bankingSetup.expectedMonthlyRevenue")}>
                            <option value="">Select revenue band</option>
                            {REVENUE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </SelectField>
                          <SelectField label="Business Model" {...register("bankingSetup.businessModel")} error={getError(errors, "bankingSetup.businessModel")}>
                            <option value="">Select business model</option>
                            {BUSINESS_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </SelectField>

                          <div className="space-y-3 md:col-span-2">
                            <p className="text-sm font-medium text-white">Expected customer regions</p>
                            <div className="grid gap-3 sm:grid-cols-3">
                              {CUSTOMER_REGION_OPTIONS.map((option) => {
                                const selected = getValues("bankingSetup.expectedCustomerRegions").includes(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={checkboxCard(selected)}
                                    onClick={() => {
                                      const current = getValues("bankingSetup.expectedCustomerRegions");
                                      setValue("bankingSetup.expectedCustomerRegions", selected ? current.filter((item) => item !== option.value) : [...current, option.value], { shouldDirty: true });
                                    }}
                                  >
                                    <span>{option.label}</span>
                                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                                  </button>
                                );
                              })}
                            </div>
                            {getError(errors, "bankingSetup.expectedCustomerRegions") ? <p className="text-sm text-rose-300">{getError(errors, "bankingSetup.expectedCustomerRegions")}</p> : null}
                          </div>

                          <div className="space-y-3 md:col-span-2">
                            <p className="text-sm font-medium text-white">Required payment methods</p>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              {PAYMENT_METHOD_OPTIONS.map((option) => {
                                const selected = getValues("bankingSetup.requiredPaymentMethods").includes(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={checkboxCard(selected)}
                                    onClick={() => {
                                      const current = getValues("bankingSetup.requiredPaymentMethods");
                                      setValue("bankingSetup.requiredPaymentMethods", selected ? current.filter((item) => item !== option.value) : [...current, option.value], { shouldDirty: true });
                                    }}
                                  >
                                    <span>{option.label}</span>
                                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                                  </button>
                                );
                              })}
                            </div>
                            {getError(errors, "bankingSetup.requiredPaymentMethods") ? <p className="text-sm text-rose-300">{getError(errors, "bankingSetup.requiredPaymentMethods")}</p> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {currentStep === 7 ? (
                    <div className="space-y-5">
                      <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-5 text-sm text-slate-100">
                        <div className="flex items-center gap-3 text-primary"><Sparkles className="h-5 w-5" /> Review everything before submission</div>
                        <p className="mt-3 text-muted">You can jump back to any section to edit details before Priyo Launch receives your application.</p>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {reviewSections.map((section, index) => (
                          <div key={section.title} className="space-y-3">
                            <ReviewPanel title={section.title} rows={section.rows} />
                            {index < 4 ? <Button variant="ghost" onClick={() => goToStep(index + 1)}>Edit section</Button> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </GlassCard>

            <div className="glass-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted">{saveMessage}</p>
                {getValues("draftToken") ? <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.24em] text-primary">Draft token active</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {currentStep > 1 && (
                  <Button variant="secondary" onClick={() => goToStep(Math.max(1, currentStep - 1))} disabled={isSubmitting}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                )}
                {currentStep < TOTAL_STEPS ? (
                  <Button onClick={handleContinue} disabled={isSubmitting}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit Application</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

