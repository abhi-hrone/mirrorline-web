// Ocean's people-search department enum, split into business vs technical.
export const BUSINESS_DEPARTMENTS = [
  "Accounting and Finance",
  "Board",
  "Business Support",
  "Customer Relations",
  "Founder/Owner",
  "HR",
  "Legal",
  "Management",
  "Marketing and Advertising",
  "Operations",
  "PR and Communications",
  "Procurement",
  "Sales",
  "Supply Chain",
] as const;

export const TECH_DEPARTMENTS = [
  "Design",
  "Engineering",
  "Manufacturing",
  "Product",
  "Quality Control",
  "R&D",
] as const;

// Not offered as targets: Editorial Personnel, Education, Healthcare, Security, Other.
export const ALL_DEPARTMENTS: readonly string[] = [...BUSINESS_DEPARTMENTS, ...TECH_DEPARTMENTS];
