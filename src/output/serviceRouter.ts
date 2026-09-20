// Maps domain incident categories and action intents to service IDs from
// data/campus_services.csv. The mapping is deliberately data-driven and
// conservative: when in doubt, we prefer the service whose declared scope
// most closely matches the incident.

import type { ActionType } from "@/domain/actions";

export const SERVICE_IDS = {
  SECURITY: "SVC-SECURITY",
  MEDICAL: "SVC-MEDICAL",
  EMS: "SVC-EMS",
  FIRE: "SVC-FIRE",
  FACILITIES: "SVC-FACILITIES",
  ELECTRICAL: "SVC-ELECTRICAL",
  IT: "SVC-IT",
  ACCESS: "SVC-ACCESS",
  CLEANING: "SVC-CLEANING",
  MANAGEMENT: "SVC-MANAGEMENT",
  COMMS: "SVC-COMMS",
  COUNSELLING: "SVC-COUNSELLING",
} as const;

export type ServiceId = (typeof SERVICE_IDS)[keyof typeof SERVICE_IDS];

const CATEGORY_TO_SERVICE: Readonly<Record<string, ServiceId>> = {
  // Incident categories observed in the development data.
  FIRE: SERVICE_IDS.FIRE,
  SMOKE: SERVICE_IDS.FIRE,
  ELECTRICAL: SERVICE_IDS.ELECTRICAL,
  MEDICAL: SERVICE_IDS.MEDICAL,
  SECURITY: SERVICE_IDS.SECURITY,
  ACCESSIBILITY: SERVICE_IDS.ACCESS,
  LIFT: SERVICE_IDS.FACILITIES,
  FACILITIES: SERVICE_IDS.FACILITIES,
  WATER_LEAK: SERVICE_IDS.FACILITIES,
  NETWORK_OUTAGE: SERVICE_IDS.IT,
  IT: SERVICE_IDS.IT,
  ENVIRONMENTAL: SERVICE_IDS.CLEANING,
  CLEANING: SERVICE_IDS.CLEANING,
};

export function serviceForCategory(categoryNormalized: string): ServiceId | null {
  return CATEGORY_TO_SERVICE[categoryNormalized] ?? null;
}

const ACTION_TO_SERVICE: Readonly<Partial<Record<ActionType, ServiceId>>> = {
  NOTIFY_SECURITY: SERVICE_IDS.SECURITY,
  NOTIFY_MAINTENANCE: SERVICE_IDS.FACILITIES,
  NOTIFY_ICT: SERVICE_IDS.IT,
  NOTIFY_TRUSTED_CONTACT: SERVICE_IDS.COMMS,
};

export function serviceForAction(actionType: ActionType): ServiceId | null {
  return ACTION_TO_SERVICE[actionType] ?? null;
}

// Returns the secondary service that a serious incident should also engage.
// For example, smoke in an electrical lab engages both fire and electrical.
export function secondaryServicesForCategory(
  categoryNormalized: string,
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
): readonly ServiceId[] {
  const services: ServiceId[] = [];

  if (severity === "CRITICAL" || severity === "HIGH") {
    if (categoryNormalized === "FIRE" || categoryNormalized === "SMOKE") {
      services.push(SERVICE_IDS.ELECTRICAL);
    }
    if (
      categoryNormalized === "MEDICAL" &&
      severity === "CRITICAL"
    ) {
      services.push(SERVICE_IDS.EMS);
    }
    if (
      categoryNormalized === "ACCESSIBILITY" ||
      categoryNormalized === "LIFT"
    ) {
      services.push(SERVICE_IDS.ACCESS);
    }
  }

  if (severity === "CRITICAL") {
    services.push(SERVICE_IDS.MANAGEMENT);
  }

  return services;
}