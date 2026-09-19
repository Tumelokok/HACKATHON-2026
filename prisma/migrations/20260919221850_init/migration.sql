-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentState" AS ENUM ('CREATED', 'ASSESSING', 'ACTIVE', 'RESPONDING', 'MONITORING', 'ESCALATED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AssessmentSource" AS ENUM ('RULE_ENGINE', 'AGENT', 'HUMAN');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "processingOrder" INTEGER NOT NULL,
    "timestampRaw" TEXT NOT NULL,
    "timestampParsed" TIMESTAMP(3),
    "locationRaw" TEXT NOT NULL,
    "locationNormalized" TEXT NOT NULL,
    "categoryRaw" TEXT NOT NULL,
    "categoryNormalized" TEXT NOT NULL,
    "reportedSeverityRaw" TEXT NOT NULL,
    "reportedSeverityNormalized" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reporterTypeRaw" TEXT NOT NULL,
    "reporterTypeNormalized" TEXT NOT NULL,
    "incidentId" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "severityConfidence" DOUBLE PRECISION NOT NULL,
    "state" "IncidentState" NOT NULL,
    "stateReason" TEXT NOT NULL,
    "correlationConfidence" DOUBLE PRECISION NOT NULL,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolutionReason" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeverityAssessment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "level" "Severity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceReportIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "AssessmentSource" NOT NULL,

    CONSTRAINT "SeverityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateTransition" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fromState" "IncidentState",
    "toState" "IncidentState" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeringReportId" TEXT,
    "triggeringActionId" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conflict" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictReport" (
    "conflictId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,

    CONSTRAINT "ConflictReport_pkey" PRIMARY KEY ("conflictId","reportId")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "executedAt" TIMESTAMP(3),
    "result" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "reportId" TEXT,
    "actionId" TEXT,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportId_key" ON "Report"("reportId");

-- CreateIndex
CREATE INDEX "Report_incidentId_idx" ON "Report"("incidentId");

-- CreateIndex
CREATE INDEX "Report_processingOrder_idx" ON "Report"("processingOrder");

-- CreateIndex
CREATE INDEX "Report_locationNormalized_idx" ON "Report"("locationNormalized");

-- CreateIndex
CREATE INDEX "Report_categoryNormalized_idx" ON "Report"("categoryNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_incidentNumber_key" ON "Incident"("incidentNumber");

-- CreateIndex
CREATE INDEX "Incident_state_idx" ON "Incident"("state");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_requiresHumanReview_idx" ON "Incident"("requiresHumanReview");

-- CreateIndex
CREATE INDEX "Incident_category_idx" ON "Incident"("category");

-- CreateIndex
CREATE INDEX "Incident_location_idx" ON "Incident"("location");

-- CreateIndex
CREATE INDEX "SeverityAssessment_incidentId_idx" ON "SeverityAssessment"("incidentId");

-- CreateIndex
CREATE INDEX "SeverityAssessment_createdAt_idx" ON "SeverityAssessment"("createdAt");

-- CreateIndex
CREATE INDEX "StateTransition_incidentId_idx" ON "StateTransition"("incidentId");

-- CreateIndex
CREATE INDEX "StateTransition_triggeringReportId_idx" ON "StateTransition"("triggeringReportId");

-- CreateIndex
CREATE INDEX "StateTransition_createdAt_idx" ON "StateTransition"("createdAt");

-- CreateIndex
CREATE INDEX "Conflict_incidentId_idx" ON "Conflict"("incidentId");

-- CreateIndex
CREATE INDEX "Conflict_status_idx" ON "Conflict"("status");

-- CreateIndex
CREATE INDEX "Conflict_requiresHumanReview_idx" ON "Conflict"("requiresHumanReview");

-- CreateIndex
CREATE INDEX "ConflictReport_reportId_idx" ON "ConflictReport"("reportId");

-- CreateIndex
CREATE INDEX "Action_incidentId_idx" ON "Action"("incidentId");

-- CreateIndex
CREATE INDEX "Action_incidentId_service_type_idx" ON "Action"("incidentId", "service", "type");

-- CreateIndex
CREATE INDEX "Action_status_idx" ON "Action"("status");

-- CreateIndex
CREATE INDEX "AuditEvent_incidentId_idx" ON "AuditEvent"("incidentId");

-- CreateIndex
CREATE INDEX "AuditEvent_reportId_idx" ON "AuditEvent"("reportId");

-- CreateIndex
CREATE INDEX "AuditEvent_actionId_idx" ON "AuditEvent"("actionId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeverityAssessment" ADD CONSTRAINT "SeverityAssessment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateTransition" ADD CONSTRAINT "StateTransition_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateTransition" ADD CONSTRAINT "StateTransition_triggeringReportId_fkey" FOREIGN KEY ("triggeringReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateTransition" ADD CONSTRAINT "StateTransition_triggeringActionId_fkey" FOREIGN KEY ("triggeringActionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictReport" ADD CONSTRAINT "ConflictReport_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictReport" ADD CONSTRAINT "ConflictReport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
