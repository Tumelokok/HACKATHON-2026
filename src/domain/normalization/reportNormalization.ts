import type {
  NormalizedReport,
  RawReport,
  ReportCategory,
  ReportSeverity,
  ReporterType,
} from "@/types/report";

function normalizedWords(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\/_-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function enumKey(value: string): string {
  return normalizedWords(value).replace(/ /g, "_").toUpperCase();
}

const categoryAliases: Readonly<Record<string, ReportCategory>> = {
  network: "NETWORK_OUTAGE",
  network_outage: "NETWORK_OUTAGE",
  it: "NETWORK_OUTAGE",
  it_outage: "NETWORK_OUTAGE",
  electrical_fault: "ELECTRICAL",
  electrical_danger: "ELECTRICAL",
  water: "WATER_LEAK",
  water_leak: "WATER_LEAK",
  lift_accessibility: "LIFT",
};

const severityAliases: Readonly<Record<string, ReportSeverity>> = {
  LOW: "LOW",
  MINOR: "LOW",
  MEDIUM: "MEDIUM",
  MODERATE: "MEDIUM",
  HIGH: "HIGH",
  SEVERE: "HIGH",
  CRITICAL: "CRITICAL",
  EMERGENCY: "CRITICAL",
};

const reporterTypeAliases: Readonly<Record<string, ReporterType>> = {
  STUDENT: "STUDENT",
  LEARNER: "STUDENT",
  STAFF: "STAFF",
  EMPLOYEE: "STAFF",
  SECURITY: "SECURITY",
  GUARD: "SECURITY",
  MAINTENANCE: "MAINTENANCE",
  FACILITIES: "MAINTENANCE",
  ICT: "ICT",
  IT: "ICT",
  CONTRACTOR: "CONTRACTOR",
};

function normalizeCategory(value: string): ReportCategory {
  const key = enumKey(value);
  return categoryAliases[key] ?? key;
}

function normalizeSeverity(value: string): ReportSeverity {
  const key = enumKey(value);
  return severityAliases[key] ?? key;
}

function normalizeReporterType(value: string): ReporterType {
  const key = enumKey(value);
  return reporterTypeAliases[key] ?? key;
}

function parseTimestamp(value: string): Date | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

/** Normalized fields are comparison keys; raw fields remain untouched for evidence. */
export function normalizeReport(rawReport: RawReport): NormalizedReport {
  return {
    ...rawReport,
    timestampRaw: rawReport.timestamp,
    timestampParsed: parseTimestamp(rawReport.timestamp),
    locationRaw: rawReport.location,
    locationNormalized: normalizedWords(rawReport.location),
    categoryRaw: rawReport.category,
    categoryNormalized: normalizeCategory(rawReport.category),
    reportedSeverityRaw: rawReport.reported_severity,
    reportedSeverityNormalized: normalizeSeverity(rawReport.reported_severity),
    descriptionRaw: rawReport.description,
    reporterTypeRaw: rawReport.reporter_type,
    reporterTypeNormalized: normalizeReporterType(rawReport.reporter_type),
  };
}