ALTER TABLE "Account" ADD COLUMN "activeOrgId" TEXT;

DROP INDEX "OrganizationMember_accountId_key";

CREATE UNIQUE INDEX "OrganizationMember_organizationId_accountId_key" ON "OrganizationMember"("organizationId", "accountId");

CREATE INDEX "OrganizationMember_accountId_idx" ON "OrganizationMember"("accountId");
