export type LaunchPlan = "starter" | "growth" | "global";
export type FormationState = "delaware" | "wyoming" | "new_mexico" | "florida";
export type Industry =
  | "software_saas"
  | "freelancing"
  | "ecommerce"
  | "consulting"
  | "marketing_agency"
  | "crypto_web3"
  | "other";
export type RevenueBand = "below_5k" | "between_5k_50k" | "above_50k";
export type BusinessModel = "saas" | "freelancing" | "ecommerce" | "marketplace" | "agency";
export type CustomerRegion = "usa" | "europe" | "global";
export type PaymentMethod = "ach" | "card_payments" | "wire_transfers" | "virtual_cards";
export type DocumentType =
  | "passport_id"
  | "proof_of_address"
  | "ein_letter"
  | "formation_certificate"
  | "operating_agreement";
export type BusinessAddressMode = "priyo_registered_address" | "custom";

export type AddressInput = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type UploadDocumentMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: DocumentType;
  uploadStatus: "pending_upload" | "uploaded" | "generated";
  storageKey?: string | null;
};

export type OwnerInput = {
  name: string;
  ownershipPercentage: number;
  citizenshipCountry: string;
  address: AddressInput;
};

export type ApplicationDraftValues = {
  applicationId?: string;
  draftToken?: string;
  currentStep: number;
  selectedPlan: LaunchPlan;
  founder: {
    fullLegalName: string;
    emailAddress: string;
    phoneNumber: string;
  };
  company: {
    primaryLLCName: string;
    alternativeLLCName: string;
    industry: Industry | "";
    businessDescription: string;
    businessWebsite: string;
  };
  stateOfFormation: FormationState | "";
  ownership: {
    numberOfOwners: number;
    soleOwner: boolean;
    owners: OwnerInput[];
  };
  businessAddress: {
    mode: BusinessAddressMode;
    customAddress: AddressInput;
    addRegisteredAgent: boolean;
  };
  bankingSetup: {
    wantPriyoPayBusinessAccount: boolean;
    expectedMonthlyRevenue: RevenueBand | "";
    businessModel: BusinessModel | "";
    expectedCustomerRegions: CustomerRegion[];
    requiredPaymentMethods: PaymentMethod[];
  };
  documents?: UploadDocumentMeta[];
};

