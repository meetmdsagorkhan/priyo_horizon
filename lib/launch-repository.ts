import {
  ApplicationStatus,
  BusinessAddressMode,
  DocumentStatus,
  DocumentType,
  LaunchPlan,
  Prisma,
} from "@prisma/client";

import { PLAN_DETAILS, getPlanDefaults } from "./launch-config";
import { createDefaultDraft } from "./launch-data";
import { prisma } from "./prisma";
import type { ApplicationDraftValues, UploadDocumentMeta } from "./types";

const applicationInclude = Prisma.validator<Prisma.ApplicationInclude>()({
  user: true,
  owners: true,
  services: true,
  documents: true,
  payment: true,
});

type ApplicationRecord = Prisma.ApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

export function syncOwnerFromFounder(values: ApplicationDraftValues): ApplicationDraftValues {
  return {
    ...values,
    ownership: {
      numberOfOwners: 1,
      soleOwner: true,
      owners: [
        {
          name: values.founder.fullLegalName,
          ownershipPercentage: 100,
          citizenshipCountry: "",
          address: { street: "", city: "", state: "", postalCode: "", country: "" },
        },
      ],
    },
  };
}

export async function createDraft(values: ApplicationDraftValues) {
  const normalized = syncOwnerFromFounder(values);
  const draftToken = crypto.randomUUID();

  const user = await prisma.user.upsert({
    where: { email: normalized.founder.emailAddress },
    update: {
      name: normalized.founder.fullLegalName,
      phone: normalized.founder.phoneNumber,
    },
    create: {
      name: normalized.founder.fullLegalName,
      email: normalized.founder.emailAddress,
      phone: normalized.founder.phoneNumber,
    },
  });

  const defaults = getPlanDefaults(normalized.selectedPlan);
  await prisma.application.create({
    data: {
      userId: user.id,
      companyName: normalized.company.primaryLLCName || "Draft LLC",
      altCompanyName: normalized.company.alternativeLLCName || null,
      stateOfFormation: normalized.stateOfFormation || null,
      industry: normalized.company.industry || null,
      businessDescription: normalized.company.businessDescription || null,
      businessWebsite: normalized.company.businessWebsite || null,
      selectedPlan: normalized.selectedPlan as LaunchPlan,
      currentStep: normalized.currentStep,
      draftToken,
      numberOfOwners: normalized.ownership.numberOfOwners,
      soleOwner: normalized.ownership.soleOwner,
      businessAddressMode: normalized.businessAddress.mode as BusinessAddressMode,
      businessAddress:
        normalized.businessAddress.mode === "custom"
          ? normalized.businessAddress.customAddress
          : undefined,
      services: {
        create: {
          einFiling: defaults.einFiling,
          registeredAgent: normalized.businessAddress.addRegisteredAgent || defaults.registeredAgent,
          businessAddress:
            normalized.businessAddress.mode === "priyo_registered_address" || defaults.businessAddress,
          complianceMonitoring: defaults.complianceMonitoring,
          priyoPayAccount:
            normalized.bankingSetup.wantPriyoPayBusinessAccount || defaults.priyoPayAccount,
          expectedMonthlyRevenue: normalized.bankingSetup.expectedMonthlyRevenue || null,
          businessModel: normalized.bankingSetup.businessModel || null,
          customerRegions: normalized.bankingSetup.expectedCustomerRegions,
          paymentMethods: normalized.bankingSetup.requiredPaymentMethods,
        },
      },
      owners: {
        create: normalized.ownership.owners.map((owner) => ({
          name: owner.name || normalized.founder.fullLegalName,
          ownershipPercentage: owner.ownershipPercentage,
          citizenshipCountry: owner.citizenshipCountry || "",
          address: owner.address,
        })),
      },
    },
    include: applicationInclude,
  });

  return loadDraftByToken(draftToken);
}

export async function loadDraftByToken(draftToken: string) {
  const application = await prisma.application.findUnique({
    where: { draftToken },
    include: applicationInclude,
  });

  if (!application) {
    return null;
  }

  return serializeApplication(application);
}

export async function saveDraft(draftToken: string, values: ApplicationDraftValues) {
  const existing = await prisma.application.findUnique({
    where: { draftToken },
    include: applicationInclude,
  });

  if (!existing) {
    return null;
  }

  const normalized = syncOwnerFromFounder(values);
  const defaults = getPlanDefaults(normalized.selectedPlan);

  await prisma.user.update({
    where: { id: existing.userId },
    data: {
      name: normalized.founder.fullLegalName,
      email: normalized.founder.emailAddress,
      phone: normalized.founder.phoneNumber,
    },
  });

  await prisma.application.update({
    where: { id: existing.id },
    data: {
      companyName: normalized.company.primaryLLCName,
      altCompanyName: normalized.company.alternativeLLCName || null,
      industry: normalized.company.industry || null,
      businessDescription: normalized.company.businessDescription,
      businessWebsite: normalized.company.businessWebsite || null,
      selectedPlan: normalized.selectedPlan as LaunchPlan,
      currentStep: normalized.currentStep,
      stateOfFormation: normalized.stateOfFormation || null,
      numberOfOwners: normalized.ownership.numberOfOwners,
      soleOwner: normalized.ownership.soleOwner,
      businessAddressMode: normalized.businessAddress.mode as BusinessAddressMode,
      businessAddress:
        normalized.businessAddress.mode === "custom"
          ? normalized.businessAddress.customAddress
          : Prisma.DbNull,
      owners: {
        deleteMany: {},
        create: normalized.ownership.owners.map((owner) => ({
          name: owner.name,
          ownershipPercentage: owner.ownershipPercentage,
          citizenshipCountry: owner.citizenshipCountry,
          address: owner.address,
        })),
      },
      services: {
        upsert: {
          create: {
            einFiling: defaults.einFiling,
            registeredAgent: normalized.businessAddress.addRegisteredAgent || defaults.registeredAgent,
            businessAddress:
              normalized.businessAddress.mode === "priyo_registered_address" || defaults.businessAddress,
            complianceMonitoring: defaults.complianceMonitoring,
            priyoPayAccount:
              normalized.bankingSetup.wantPriyoPayBusinessAccount || defaults.priyoPayAccount,
            expectedMonthlyRevenue: normalized.bankingSetup.expectedMonthlyRevenue || null,
            businessModel: normalized.bankingSetup.businessModel || null,
            customerRegions: normalized.bankingSetup.expectedCustomerRegions,
            paymentMethods: normalized.bankingSetup.requiredPaymentMethods,
          },
          update: {
            einFiling: defaults.einFiling,
            registeredAgent: normalized.businessAddress.addRegisteredAgent || defaults.registeredAgent,
            businessAddress:
              normalized.businessAddress.mode === "priyo_registered_address" || defaults.businessAddress,
            complianceMonitoring: defaults.complianceMonitoring,
            priyoPayAccount:
              normalized.bankingSetup.wantPriyoPayBusinessAccount || defaults.priyoPayAccount,
            expectedMonthlyRevenue: normalized.bankingSetup.expectedMonthlyRevenue || null,
            businessModel: normalized.bankingSetup.businessModel || null,
            customerRegions: normalized.bankingSetup.expectedCustomerRegions,
            paymentMethods: normalized.bankingSetup.requiredPaymentMethods,
          },
        },
      },
    },
  });

  return loadDraftByToken(draftToken);
}

export async function submitDraft(draftToken: string, values: ApplicationDraftValues) {
  const saved = await saveDraft(draftToken, { ...values, currentStep: 7 });
  if (!saved) {
    return null;
  }

  const application = await prisma.application.update({
    where: { draftToken },
    data: {
      status: ApplicationStatus.submitted,
      submittedAt: new Date(),
    },
    include: applicationInclude,
  });

  await prisma.payment.upsert({
    where: { applicationId: application.id },
    update: {
      plan: values.selectedPlan as LaunchPlan,
      amount: PLAN_DETAILS[values.selectedPlan].amount,
      paymentStatus: "pending",
    },
    create: {
      applicationId: application.id,
      plan: values.selectedPlan as LaunchPlan,
      amount: PLAN_DETAILS[values.selectedPlan].amount,
      currency: "USD",
      paymentStatus: "pending",
    },
  });

  return serializeApplication(application);
}

export async function saveDocumentMeta(params: {
  draftToken: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string | null;
  uploadStatus: DocumentStatus;
}) {
  const application = await prisma.application.findUnique({
    where: { draftToken: params.draftToken },
  });

  if (!application) {
    return null;
  }

  const document = await prisma.document.upsert({
    where: {
      applicationId_type: {
        applicationId: application.id,
        type: params.type,
      },
    },
    update: {
      fileName: params.fileName,
      mimeType: params.mimeType,
      size: params.size,
      storageKey: params.storageKey,
      storageBucket: process.env.S3_BUCKET ?? null,
      uploadStatus: params.uploadStatus,
      uploadedAt: params.uploadStatus === DocumentStatus.uploaded ? new Date() : null,
    },
    create: {
      applicationId: application.id,
      type: params.type,
      fileName: params.fileName,
      mimeType: params.mimeType,
      size: params.size,
      storageKey: params.storageKey,
      storageBucket: process.env.S3_BUCKET ?? null,
      uploadStatus: params.uploadStatus,
      uploadedAt: params.uploadStatus === DocumentStatus.uploaded ? new Date() : null,
    },
  });

  return serializeDocument(document);
}

export async function completeDocumentUpload(draftToken: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      application: {
        draftToken,
      },
    },
  });

  if (!document) {
    return null;
  }

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: {
      uploadStatus: DocumentStatus.uploaded,
      uploadedAt: new Date(),
    },
  });

  return serializeDocument(updated);
}

function serializeDocument(document: {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: DocumentType;
  uploadStatus: DocumentStatus;
  storageKey: string | null;
}): UploadDocumentMeta {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    type: document.type.toLowerCase() as UploadDocumentMeta["type"],
    uploadStatus: document.uploadStatus.toLowerCase() as UploadDocumentMeta["uploadStatus"],
    storageKey: document.storageKey,
  };
}

function serializeApplication(application: NonNullable<ApplicationRecord>) {
  const defaultDraft = createDefaultDraft(application.selectedPlan as ApplicationDraftValues["selectedPlan"]);

  return {
    applicationId: application.id,
    draftToken: application.draftToken,
    status: application.status,
    submittedAt: application.submittedAt?.toISOString() ?? null,
    payment: application.payment
      ? {
          plan: application.payment.plan,
          amount: application.payment.amount,
          currency: application.payment.currency,
          paymentStatus: application.payment.paymentStatus,
        }
      : null,
    values: {
      ...defaultDraft,
      applicationId: application.id,
      draftToken: application.draftToken,
      currentStep: application.currentStep,
      selectedPlan: application.selectedPlan as ApplicationDraftValues["selectedPlan"],
      founder: {
        fullLegalName: application.user.name,
        emailAddress: application.user.email,
        phoneNumber: application.user.phone,
      },
      company: {
        primaryLLCName: application.companyName,
        alternativeLLCName: application.altCompanyName ?? "",
        industry: (application.industry as ApplicationDraftValues["company"]["industry"]) ?? "",
        businessDescription: application.businessDescription ?? "",
        businessWebsite: application.businessWebsite ?? "",
      },
      stateOfFormation: (application.stateOfFormation as ApplicationDraftValues["stateOfFormation"]) ?? "",
      ownership: {
        numberOfOwners: application.numberOfOwners ?? (application.owners.length || 1),
        soleOwner: application.soleOwner,
        owners:
          application.owners.map((owner) => ({
            name: owner.name,
            ownershipPercentage: owner.ownershipPercentage,
            citizenshipCountry: owner.citizenshipCountry,
            address: owner.address as ApplicationDraftValues["ownership"]["owners"][number]["address"],
          })) || defaultDraft.ownership.owners,
      },
      businessAddress: {
        mode: application.businessAddressMode as ApplicationDraftValues["businessAddress"]["mode"],
        customAddress:
          (application.businessAddress as ApplicationDraftValues["businessAddress"]["customAddress"]) ??
          defaultDraft.businessAddress.customAddress,
        addRegisteredAgent: application.services?.registeredAgent ?? defaultDraft.businessAddress.addRegisteredAgent,
      },
      bankingSetup: {
        wantPriyoPayBusinessAccount:
          application.services?.priyoPayAccount ?? defaultDraft.bankingSetup.wantPriyoPayBusinessAccount,
        expectedMonthlyRevenue:
          (application.services?.expectedMonthlyRevenue as ApplicationDraftValues["bankingSetup"]["expectedMonthlyRevenue"]) ?? "",
        businessModel:
          (application.services?.businessModel as ApplicationDraftValues["bankingSetup"]["businessModel"]) ?? "",
        expectedCustomerRegions:
          (application.services?.customerRegions as ApplicationDraftValues["bankingSetup"]["expectedCustomerRegions"]) ?? [],
        requiredPaymentMethods:
          (application.services?.paymentMethods as ApplicationDraftValues["bankingSetup"]["requiredPaymentMethods"]) ?? [],
      },
      documents: application.documents.map(serializeDocument),
    },
  };
}



