export type BusinessContext = {
  businessName: string; phoneNumber: string; email: string;
  businessDescription: string; location: string; serviceLocation: string;
  logoUrl: string;
};

export const EMPTY_BUSINESS_CONTEXT: BusinessContext = {
  businessName: "", phoneNumber: "", email: "", businessDescription: "", location: "", serviceLocation: "", logoUrl: "",
};

const labels: Array<{ key: keyof BusinessContext; label: string }> = [
  { key: "businessName",        label: "Business Name" },
  { key: "phoneNumber",         label: "Phone Number" },
  { key: "email",               label: "Email" },
  { key: "businessDescription", label: "Business Description" },
  { key: "location",            label: "Location" },
  { key: "serviceLocation",     label: "Service Location" },
  { key: "logoUrl",             label: "Logo URL" },
];

export function normalizeBusinessContext(input?: Partial<BusinessContext> | null): BusinessContext {
  return {
    businessName:        input?.businessName?.trim()        ?? "",
    phoneNumber:         input?.phoneNumber?.trim()         ?? "",
    email:               input?.email?.trim()               ?? "",
    businessDescription: input?.businessDescription?.trim() ?? "",
    location:            input?.location?.trim()            ?? "",
    serviceLocation:     input?.serviceLocation?.trim()     ?? "",
    logoUrl:             input?.logoUrl?.trim()             ?? "",
  };
}

export function formatBusinessContext(input?: Partial<BusinessContext> | null): string {
  const n = normalizeBusinessContext(input);
  const lines = labels.map(({ key, label }) => (n[key] ? `- ${label}: ${n[key]}` : "")).filter(Boolean);
  if (lines.length === 0) return "";
  return ["Business Context:", ...lines].join("\n");
}
