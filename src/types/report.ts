export const reportCategories = [
  "NETWORK_OUTAGE",
  "ELECTRICAL",
  "FIRE",
  "SMOKE",
  "WATER_LEAK",
  "LIFT",
  "SECURITY",
  "OTHER",
] as const;

export type ReportCategory = (typeof reportCategories)[number] | (string & {});

export const reportSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type ReportSeverity = (typeof reportSeverities)[number] | (string & {});

export const reporterTypes = [
  "STUDENT",
  "STAFF",
  "SECURITY",
  "MAINTENANCE",
  "ICT",
  "CONTRACTOR",
  "OTHER",
] as const;

export type ReporterType = (typeof reporterTypes)[number] | (string & {});

/** The seven values supplied by an input row, before any normalization. */
export interface RawReportInput {
  report_id: string;
  timestamp: string;
  location: string;
  category: string;
  reported_severity: string;
  description: string;
  reporter_type: string;
}

/** A raw row with the caller-owned order in which it must be processed. */
export interface RawReport extends RawReportInput {
  processingOrder: number;
}

export type ValidatedReport = RawReport;

export interface NormalizedReport extends ValidatedReport {
  timestampRaw: string;
  timestampParsed: Date | null;
  locationRaw: string;
  locationNormalized: string;
  categoryRaw: string;
  categoryNormalized: ReportCategory;
  reportedSeverityRaw: string;
  reportedSeverityNormalized: ReportSeverity;
  descriptionRaw: string;
  reporterTypeRaw: string;
  reporterTypeNormalized: ReporterType;
}