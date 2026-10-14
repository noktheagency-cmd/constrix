-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('aktiv', 'gozleyir', 'dayandi', 'bitib');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('baslangic', 'pesekar', 'korporativ');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('aciq', 'cavablandi', 'bagli');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('gozleyir', 'verildi', 'secildi', 'imtina');

-- CreateEnum
CREATE TYPE "TalentState" AS ENUM ('layihede', 'elcatan', 'axtarir', 'elcatmaz', 'tesdiq');

-- CreateEnum
CREATE TYPE "ProofSource" AS ENUM ('isegoturen', 'muqavile', 'arayis', 'diplom', 'sertifikat', 'el');

-- CreateEnum
CREATE TYPE "AppKind" AS ENUM ('qarant', 'kredit', 'faktorinq', 'emekhaqqi', 'sigorta', 'pos', 'lizinq');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('qaralama', 'teqdim', 'yoxlanir', 'elave', 'qiymet', 'ilkin', 'tesdiq_gozleyir', 'tesdiq', 'imtina', 'resmi', 'bagli');

-- CreateEnum
CREATE TYPE "OfficialTopic" AS ENUM ('qeydiyyat', 'voen', 'vergi_borcu', 'satinalma', 'muflis', 'selahiyyet');

-- CreateEnum
CREATE TYPE "OfficialState" AS ENUM ('gonderilmeyib', 'gonderilib', 'gozlenir', 'alindi', 'elave', 'texniki');

-- CreateEnum
CREATE TYPE "NoticeKind" AS ENUM ('tender', 'sertifikat', 'teminat', 'teklif', 'sened', 'abune', 'hava', 'odeme');

-- CreateEnum
CREATE TYPE "ChainKind" AS ENUM ('smeta', 'sifaris', 'anbar', 'elave');

-- CreateEnum
CREATE TYPE "StepState" AS ENUM ('gozleyir', 'tesdiq', 'geri');

-- CreateEnum
CREATE TYPE "CostMethod" AS ENUM ('orta', 'fifo');

-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('saat', 'novbe', 'gun', 'ay', 'hecm');

-- CreateEnum
CREATE TYPE "FinanceLine" AS ENUM ('dovriyye', 'layihe', 'muqavile', 'material', 'qisa', 'avadanliq', 'lizinq', 'techizat', 'debitor', 'qarant', 'faktorinq', 'emekhaqqi', 'pos', 'sigorta');

-- AlterTable
ALTER TABLE "BoqBook" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "profitMode" "ProfitMode" NOT NULL DEFAULT 'faiz';

-- AlterTable
ALTER TABLE "CashPlan" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "CoopRequest" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "FinancePartner" ADD COLUMN     "contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "productsNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "GuaranteeCase" ADD COLUMN     "buyer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "days" INTEGER,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "LegalTemplate" ADD COLUMN     "body" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "MaterialPassport" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "protocol" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "bankDetails" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "directions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "equipmentPark" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "permits" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "staffCount" INTEGER,
ADD COLUMN     "turnoverNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleTask" ADD COLUMN     "actualEnd" INTEGER,
ADD COLUMN     "dependsOn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TenderCase" ADD COLUMN     "number" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "WorkSchedule" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "name" TEXT NOT NULL,
    "smetaLimit" INTEGER,
    "userLimit" INTEGER,
    "features" TEXT NOT NULL,
    "amount" DECIMAL(14,2),

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'gozleyir',
    "startedOn" DATE,
    "endsOn" DATE,
    "warned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrgSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "NoticeKind" NOT NULL,
    "text" TEXT NOT NULL,
    "dueOn" DATE,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceInquiry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "title" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'aciq',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryLine" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "InquiryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBid" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,4),
    "qty" DECIMAL(14,3),
    "leadDays" INTEGER,
    "delivery" DECIMAL(14,2),
    "payment" TEXT NOT NULL DEFAULT '',
    "validUntil" DATE,
    "quality" TEXT NOT NULL DEFAULT '',
    "status" "BidStatus" NOT NULL DEFAULT 'gozleyir',
    "score" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborTariff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "profession" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "daily" DECIMAL(14,2),
    "monthly" DECIMAL(14,2),
    "perUnit" DECIMAL(14,4),
    "unit" TEXT NOT NULL DEFAULT 'eded',
    "complexity" TEXT NOT NULL DEFAULT '',
    "experience" TEXT NOT NULL DEFAULT '',
    "updatedOn" DATE NOT NULL,

    CONSTRAINT "LaborTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineTariff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "rateUnit" "RateUnit" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "fuel" DECIMAL(14,2),
    "operator" BOOLEAN NOT NULL DEFAULT false,
    "delivery" DECIMAL(14,2),
    "minDays" INTEGER,
    "updatedOn" DATE NOT NULL,

    CONSTRAINT "MachineTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "StandardMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "education" TEXT NOT NULL DEFAULT '',
    "skills" TEXT NOT NULL DEFAULT '',
    "regions" TEXT NOT NULL DEFAULT '',
    "startOn" DATE,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "state" "TalentState" NOT NULL DEFAULT 'tesdiq',
    "expectPay" DECIMAL(14,2),
    "shareConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProof" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "source" "ProofSource" NOT NULL,
    "title" TEXT NOT NULL,
    "years" DECIMAL(8,2),
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TalentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "minYears" DECIMAL(8,2),
    "region" TEXT NOT NULL DEFAULT '',
    "startOn" DATE,
    "certificate" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalChain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ChainKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "person" TEXT NOT NULL DEFAULT '',
    "state" "StepState" NOT NULL DEFAULT 'gozleyir',
    "at" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceProduct" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "line" "FinanceLine" NOT NULL,
    "name" TEXT NOT NULL,
    "terms" TEXT NOT NULL DEFAULT '',
    "commission" DECIMAL(8,2),
    "rate" DECIMAL(8,2),
    "termDays" INTEGER,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDiscount" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(8,2),
    "amount" DECIMAL(14,2),
    "startsOn" DATE,
    "endsOn" DATE,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "terms" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MemberDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceApplication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT,
    "productId" TEXT,
    "kind" "AppKind" NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'qaralama',
    "amount" DECIMAL(14,2),
    "purpose" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AppStatus" NOT NULL,
    "person" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT,
    "purpose" TEXT NOT NULL,
    "categories" TEXT NOT NULL,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "ShareConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialInquiry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "topic" "OfficialTopic" NOT NULL,
    "state" "OfficialState" NOT NULL DEFAULT 'gonderilmeyib',
    "channel" TEXT NOT NULL DEFAULT 'sened',
    "source" TEXT NOT NULL DEFAULT '',
    "resultNote" TEXT NOT NULL DEFAULT '',
    "document" TEXT NOT NULL DEFAULT '',
    "asOf" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectAct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "material" TEXT NOT NULL,
    "qty" DECIMAL(14,3),
    "reason" TEXT NOT NULL,
    "visual" TEXT NOT NULL DEFAULT '',
    "certificate" TEXT NOT NULL DEFAULT '',
    "person" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefectAct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "on" DATE NOT NULL,
    "person" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "takenOn" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOffer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "place" TEXT NOT NULL DEFAULT '',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "rateUnit" "RateUnit" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "operator" BOOLEAN NOT NULL DEFAULT false,
    "fuelNote" TEXT NOT NULL DEFAULT '',
    "delivery" DECIMAL(14,2),
    "inspection" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "materialId" TEXT,
    "locationId" TEXT,
    "code" TEXT NOT NULL,
    "batch" TEXT NOT NULL DEFAULT '',
    "qty" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "expiresOn" DATE,
    "qr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoopFinding" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoopFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehousePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "method" "CostMethod" NOT NULL DEFAULT 'orta',

    CONSTRAINT "WarehousePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Package_tier_key" ON "Package"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSubscription_organizationId_key" ON "OrgSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "Notice_organizationId_read_idx" ON "Notice"("organizationId", "read");

-- CreateIndex
CREATE INDEX "PriceInquiry_organizationId_idx" ON "PriceInquiry"("organizationId");

-- CreateIndex
CREATE INDEX "PriceInquiry_supplierId_idx" ON "PriceInquiry"("supplierId");

-- CreateIndex
CREATE INDEX "InquiryLine_inquiryId_idx" ON "InquiryLine"("inquiryId");

-- CreateIndex
CREATE INDEX "SupplierBid_inquiryId_idx" ON "SupplierBid"("inquiryId");

-- CreateIndex
CREATE INDEX "SupplierBid_organizationId_idx" ON "SupplierBid"("organizationId");

-- CreateIndex
CREATE INDEX "LaborTariff_organizationId_profession_idx" ON "LaborTariff"("organizationId", "profession");

-- CreateIndex
CREATE INDEX "MachineTariff_organizationId_category_idx" ON "MachineTariff"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "StandardMaterial_code_key" ON "StandardMaterial"("code");

-- CreateIndex
CREATE INDEX "Talent_profession_state_idx" ON "Talent"("profession", "state");

-- CreateIndex
CREATE INDEX "Talent_organizationId_idx" ON "Talent"("organizationId");

-- CreateIndex
CREATE INDEX "TalentProof_talentId_idx" ON "TalentProof"("talentId");

-- CreateIndex
CREATE INDEX "JobOpening_organizationId_profession_idx" ON "JobOpening"("organizationId", "profession");

-- CreateIndex
CREATE INDEX "ApprovalChain_organizationId_idx" ON "ApprovalChain"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalStep_chainId_sort_idx" ON "ApprovalStep"("chainId", "sort");

-- CreateIndex
CREATE INDEX "FinanceProduct_partnerId_line_idx" ON "FinanceProduct"("partnerId", "line");

-- CreateIndex
CREATE INDEX "MemberDiscount_productId_idx" ON "MemberDiscount"("productId");

-- CreateIndex
CREATE INDEX "FinanceApplication_organizationId_status_idx" ON "FinanceApplication"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_at_idx" ON "ApplicationEvent"("applicationId", "at");

-- CreateIndex
CREATE INDEX "ShareConsent_organizationId_idx" ON "ShareConsent"("organizationId");

-- CreateIndex
CREATE INDEX "OfficialInquiry_organizationId_topic_idx" ON "OfficialInquiry"("organizationId", "topic");

-- CreateIndex
CREATE INDEX "DefectAct_organizationId_idx" ON "DefectAct"("organizationId");

-- CreateIndex
CREATE INDEX "SiteIncident_organizationId_idx" ON "SiteIncident"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectPhoto_organizationId_projectId_idx" ON "ProjectPhoto"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "TaxRule_code_effectiveOn_idx" ON "TaxRule"("code", "effectiveOn");

-- CreateIndex
CREATE INDEX "RentalOffer_organizationId_category_idx" ON "RentalOffer"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "StockLot_qr_key" ON "StockLot"("qr");

-- CreateIndex
CREATE INDEX "StockLot_organizationId_code_idx" ON "StockLot"("organizationId", "code");

-- CreateIndex
CREATE INDEX "CoopFinding_requestId_idx" ON "CoopFinding"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehousePolicy_organizationId_key" ON "WarehousePolicy"("organizationId");

-- CreateIndex
CREATE INDEX "BoqBook_organizationId_idx" ON "BoqBook"("organizationId");

-- CreateIndex
CREATE INDEX "CashPlan_organizationId_idx" ON "CashPlan"("organizationId");

-- CreateIndex
CREATE INDEX "CoopRequest_organizationId_idx" ON "CoopRequest"("organizationId");

-- CreateIndex
CREATE INDEX "GuaranteeCase_organizationId_idx" ON "GuaranteeCase"("organizationId");

-- CreateIndex
CREATE INDEX "LegalTemplate_organizationId_idx" ON "LegalTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "MaterialPassport_organizationId_idx" ON "MaterialPassport"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "TenderCase_organizationId_idx" ON "TenderCase"("organizationId");

-- CreateIndex
CREATE INDEX "WorkSchedule_organizationId_idx" ON "WorkSchedule"("organizationId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderCase" ADD CONSTRAINT "TenderCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqBook" ADD CONSTRAINT "BoqBook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPlan" ADD CONSTRAINT "CashPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeCase" ADD CONSTRAINT "GuaranteeCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPassport" ADD CONSTRAINT "MaterialPassport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTemplate" ADD CONSTRAINT "LegalTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopRequest" ADD CONSTRAINT "CoopRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSubscription" ADD CONSTRAINT "OrgSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSubscription" ADD CONSTRAINT "OrgSubscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiry" ADD CONSTRAINT "PriceInquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiry" ADD CONSTRAINT "PriceInquiry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryLine" ADD CONSTRAINT "InquiryLine_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "PriceInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBid" ADD CONSTRAINT "SupplierBid_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "PriceInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBid" ADD CONSTRAINT "SupplierBid_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborTariff" ADD CONSTRAINT "LaborTariff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTariff" ADD CONSTRAINT "MachineTariff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProof" ADD CONSTRAINT "TalentProof_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalChain" ADD CONSTRAINT "ApprovalChain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "ApprovalChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProduct" ADD CONSTRAINT "FinanceProduct_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDiscount" ADD CONSTRAINT "MemberDiscount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinanceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApplication" ADD CONSTRAINT "FinanceApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApplication" ADD CONSTRAINT "FinanceApplication_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApplication" ADD CONSTRAINT "FinanceApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinanceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FinanceApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareConsent" ADD CONSTRAINT "ShareConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareConsent" ADD CONSTRAINT "ShareConsent_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialInquiry" ADD CONSTRAINT "OfficialInquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectAct" ADD CONSTRAINT "DefectAct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectAct" ADD CONSTRAINT "DefectAct_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteIncident" ADD CONSTRAINT "SiteIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteIncident" ADD CONSTRAINT "SiteIncident_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhoto" ADD CONSTRAINT "ProjectPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhoto" ADD CONSTRAINT "ProjectPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOffer" ADD CONSTRAINT "RentalOffer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopFinding" ADD CONSTRAINT "CoopFinding_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoopRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehousePolicy" ADD CONSTRAINT "WarehousePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Package" ("id", "tier", "name", "smetaLimit", "userLimit", "features", "amount") VALUES
('pkg-baslangic', 'baslangic', 'Başlanğıc', 20, 3, 'Kabinet, məhdud smeta, əsas qiymətlər, sadə layihə uçotu', NULL),
('pkg-pesekar', 'pesekar', 'Peşəkar', 200, 15, 'Smeta, tender, layihə, anbar, satınalma, maliyyə, kadr', NULL),
('pkg-korporativ', 'korporativ', 'Korporativ', NULL, NULL, 'Limitsiz istifadəçi və layihə, geniş hesabat, fərdi dəstək', NULL);

INSERT INTO "TaxRule" ("id", "code", "name", "rate", "effectiveOn", "note") VALUES
('tax-edv', 'edv', 'ƏDV', 18, DATE '2001-01-01', 'Başlanğıc dərəcə. Mühasib təsdiq edir, rəsmi təqdimat inteqrasiyası bağlıdır.');

INSERT INTO "StandardMaterial" ("id", "code", "name", "category", "unit", "spec") VALUES
('std-sement', 'MAT-SEMENT', 'Sement', 'Sement', 'ton', ''),
('std-beton', 'MAT-BETON', 'Beton', 'Beton', 'm3', ''),
('std-armatur', 'MAT-ARMATUR', 'Armatur', 'Armatur', 'ton', ''),
('std-metal', 'MAT-METAL', 'Metal konstruksiya', 'Metal konstruksiyalar', 'ton', ''),
('std-kerpic', 'MAT-KERPIC', 'Kərpic və blok', 'Kərpic və blok', 'eded', ''),
('std-inert', 'MAT-INERT', 'Qum və çınqıl', 'İnert materiallar', 'm3', ''),
('std-su', 'MAT-SU', 'Su izolyasiyası', 'Su izolyasiyası', 'm2', ''),
('std-istilik', 'MAT-ISTILIK', 'İstilik izolyasiyası', 'İstilik izolyasiyası', 'm2', ''),
('std-dam', 'MAT-DAM', 'Dam örtüyü', 'Dam örtükləri', 'm2', ''),
('std-fasad', 'MAT-FASAD', 'Fasad sistemi', 'Fasad sistemləri', 'm2', ''),
('std-boya', 'MAT-BOYA', 'Boya', 'Boya və kimyəvi materiallar', 'kq', ''),
('std-elektrik', 'MAT-ELEKTRIK', 'Elektrik avadanlığı', 'Elektrik avadanlıqları', 'eded', ''),
('std-boru', 'MAT-BORU', 'Boru və santexnika', 'Boru və santexnika', 'm', ''),
('std-qapi', 'MAT-QAPI', 'Qapı və pəncərə', 'Qapı və pəncərələr', 'eded', ''),
('std-alum', 'MAT-ALUM', 'Alüminium sistem', 'Alüminium sistemləri', 'm', ''),
('std-dose', 'MAT-DOSE', 'Döşəmə', 'Döşəmə materialları', 'm2', ''),
('std-agac', 'MAT-AGAC', 'Ağac', 'Ağac və taxta', 'm3', ''),
('std-alet', 'MAT-ALET', 'Alət', 'Tikinti alətləri', 'eded', ''),
('std-fmv', 'MAT-FMV', 'Fərdi mühafizə', 'Fərdi mühafizə vasitələri', 'eded', '');
