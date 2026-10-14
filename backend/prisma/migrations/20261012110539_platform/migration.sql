-- CreateEnum
CREATE TYPE "OrgKind" AS ENUM ('tikinti', 'memar', 'qapi', 'suse', 'pvc', 'fasad', 'dam', 'naves', 'hasar', 'material', 'montaj', 'logistika', 'admin');

-- CreateEnum
CREATE TYPE "TradeKind" AS ENUM ('qapi', 'suse', 'pvc', 'fasad', 'dam', 'naves', 'hasar', 'material');

-- CreateEnum
CREATE TYPE "ProfitMode" AS ENUM ('faiz', 'marja');

-- CreateEnum
CREATE TYPE "OpeningKind" AS ENUM ('sabit', 'doner', 'asqili', 'surusken');

-- CreateEnum
CREATE TYPE "VehicleKind" AS ENUM ('standart', 'suse');

-- CreateEnum
CREATE TYPE "HaulFit" AS ENUM ('uygun', 'tutum', 'olcu');

-- CreateEnum
CREATE TYPE "OrderStage" AS ENUM ('yeni', 'fayl', 'olcu', 'hesab', 'qiymet', 'teklif', 'tesdiq', 'istehsal', 'yoxlama', 'dasima', 'montaj', 'tehvil', 'zemanet');

-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('abune', 'layihe', 'kabinet', 'komissiya', 'modul', 'korporativ');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('gozleyir', 'qeyd');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('aciq', 'bagli');

-- CreateEnum
CREATE TYPE "FileScan" AS ENUM ('temiz', 'redd');

-- CreateEnum
CREATE TYPE "CostKind" AS ENUM ('indirect', 'overhead', 'extra');

-- CreateEnum
CREATE TYPE "FitStatus" AS ENUM ('uygun', 'deyil', 'catismir', 'gozleyir', 'el');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('gozleyir', 'tesdiq', 'geri');

-- CreateEnum
CREATE TYPE "BankLight" AS ENUM ('gozleme', 'tesdiq', 'legv');

-- CreateEnum
CREATE TYPE "GuaranteeKind" AS ENUM ('istirak', 'icra', 'avans');

-- CreateEnum
CREATE TYPE "AmountMode" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "FinancePartnerKind" AS ENUM ('bank', 'faktorinq', 'sigorta', 'pos', 'kart');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "kind" "OrgKind" NOT NULL,
    "name" TEXT NOT NULL,
    "voen" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "director" TEXT NOT NULL DEFAULT '',
    "legalAddress" TEXT NOT NULL DEFAULT '',
    "actualAddress" TEXT NOT NULL DEFAULT '',
    "capacity" TEXT NOT NULL DEFAULT '',
    "warehouse" TEXT NOT NULL DEFAULT '',
    "regions" TEXT NOT NULL DEFAULT '',
    "warranty" TEXT NOT NULL DEFAULT '',
    "reliability" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "seatRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "params" TEXT NOT NULL DEFAULT '',
    "colors" TEXT NOT NULL DEFAULT '',
    "sizes" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2),
    "validUntil" DATE,
    "minQty" DECIMAL(14,3),
    "leadDays" INTEGER,
    "deliveryPrice" DECIMAL(14,2),
    "installPrice" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBreak" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "size" TEXT NOT NULL DEFAULT '',
    "spec" TEXT NOT NULL DEFAULT '',
    "delivery" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PriceBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromPrice" DECIMAL(14,2),
    "toPrice" DECIMAL(14,2),
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trade" "TradeKind" NOT NULL,
    "system" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "kgPerM" DECIMAL(14,4),
    "wastePercent" DECIMAL(8,2),
    "glassDeductMm" DECIMAL(14,2),
    "glassWastePercent" DECIMAL(8,2),
    "panelKgPerM2" DECIMAL(14,4),
    "coverPerM2" DECIMAL(14,4),
    "overlapMm" DECIMAL(14,2),
    "postSpacingM" DECIMAL(14,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "scan" "FileScan" NOT NULL,
    "scanNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedRow" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "qty" TEXT NOT NULL DEFAULT '',
    "width" TEXT NOT NULL DEFAULT '',
    "height" TEXT NOT NULL DEFAULT '',
    "profile" TEXT NOT NULL DEFAULT '',
    "glass" TEXT NOT NULL DEFAULT '',
    "hardware" TEXT NOT NULL DEFAULT '',
    "spec" TEXT NOT NULL DEFAULT '',
    "install" TEXT NOT NULL DEFAULT '',
    "flags" TEXT[],
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExtractedRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalcJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "ruleId" TEXT,
    "haulId" TEXT,
    "trade" "TradeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "widthMm" DECIMAL(14,2),
    "heightMm" DECIMAL(14,2),
    "count" DECIMAL(14,3),
    "sections" INTEGER NOT NULL DEFAULT 1,
    "opening" "OpeningKind" NOT NULL DEFAULT 'doner',
    "color" TEXT NOT NULL DEFAULT '',
    "profileNote" TEXT NOT NULL DEFAULT '',
    "glassKind" TEXT NOT NULL DEFAULT '',
    "glassThickness" TEXT NOT NULL DEFAULT '',
    "hardware" TEXT NOT NULL DEFAULT '',
    "installKind" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "profileUnit" TEXT NOT NULL DEFAULT 'm',
    "profileRate" DECIMAL(14,4),
    "glassRate" DECIMAL(14,4),
    "hardwareRate" DECIMAL(14,4),
    "laborRate" DECIMAL(14,4),
    "installRate" DECIMAL(14,4),
    "packRate" DECIMAL(14,4),
    "transport" DECIMAL(14,2),
    "extra" DECIMAL(14,2),
    "vatPercent" DECIMAL(8,2) NOT NULL DEFAULT 18,
    "profitPercent" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "profitMode" "ProfitMode" NOT NULL DEFAULT 'faiz',
    "glassConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "lengthM" DECIMAL(14,3),
    "weightKg" DECIMAL(14,3),
    "wasteM" DECIMAL(14,3),
    "glassArea" DECIMAL(14,3),
    "cutArea" DECIMAL(14,3),
    "cost" DECIMAL(14,2),
    "profitAmount" DECIMAL(14,2),
    "vatAmount" DECIMAL(14,2),
    "sale" DECIMAL(14,2),
    "gross" DECIMAL(14,2),
    "blocked" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalcJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalcCostLine" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3),
    "rate" DECIMAL(14,4),
    "amount" DECIMAL(14,2),
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CalcCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalcJobProduct" (
    "jobId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CalcJobProduct_pkey" PRIMARY KEY ("jobId","productId")
);

-- CreateTable
CREATE TABLE "JobSchedule" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "produceDays" INTEGER NOT NULL DEFAULT 0,
    "haulDays" INTEGER NOT NULL DEFAULT 0,
    "installDays" INTEGER NOT NULL DEFAULT 0,
    "weatherDays" INTEGER NOT NULL DEFAULT 0,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    "startOn" DATE,
    "endOn" DATE,

    CONSTRAINT "JobSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaulQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromPlace" TEXT NOT NULL DEFAULT '',
    "toPlace" TEXT NOT NULL DEFAULT '',
    "km" DECIMAL(14,2),
    "weightKg" DECIMAL(14,3),
    "volumeM3" DECIMAL(14,3),
    "glassWidthMm" DECIMAL(14,2),
    "glassHeightMm" DECIMAL(14,2),
    "vehicle" "VehicleKind" NOT NULL DEFAULT 'standart',
    "capacityKg" DECIMAL(14,3),
    "maxGlassMm" DECIMAL(14,2),
    "roundTrip" BOOLEAN NOT NULL DEFAULT false,
    "loadCost" DECIMAL(14,2),
    "waitCost" DECIMAL(14,2),
    "extra" DECIMAL(14,2),
    "tariffPerKm" DECIMAL(14,4),
    "speedKmDay" DECIMAL(14,2),
    "days" INTEGER,
    "fit" "HaulFit" NOT NULL DEFAULT 'uygun',
    "cost" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaulQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderFlow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "jobId" TEXT,
    "supplierId" TEXT,
    "carrierId" TEXT,
    "installerId" TEXT,
    "title" TEXT NOT NULL,
    "stage" "OrderStage" NOT NULL DEFAULT 'yeni',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stage" "OrderStage" NOT NULL,
    "person" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "docs" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlan" (
    "id" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCharge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "invoice" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'gozleyir',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'aciq',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherFeed" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WeatherFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rainAt" DECIMAL(8,2),
    "windAt" DECIMAL(8,2),
    "pouring" BOOLEAN NOT NULL DEFAULT false,
    "stops" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SafetyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rainPercent" DECIMAL(8,2) NOT NULL,
    "windMs" DECIMAL(8,2) NOT NULL,
    "pouring" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "stops" TEXT[],
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WeatherDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobWeatherHold" (
    "jobId" TEXT NOT NULL,
    "weatherDayId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "JobWeatherHold_pkey" PRIMARY KEY ("jobId","weatherDayId")
);

-- CreateTable
CREATE TABLE "WeatherProof" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "date" DATE NOT NULL,
    "rain" DECIMAL(8,2),
    "wind" DECIMAL(8,2),
    "pouring" BOOLEAN NOT NULL DEFAULT false,
    "stop" TEXT NOT NULL,
    "officer" TEXT NOT NULL,

    CONSTRAINT "WeatherProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "link" TEXT NOT NULL DEFAULT '',
    "buyer" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "classCode" TEXT NOT NULL DEFAULT '',
    "classText" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(14,2),
    "deadline" TIMESTAMP(3),
    "bidMode" "AmountMode" NOT NULL DEFAULT 'fixed',
    "bidValue" DECIMAL(14,2),
    "sme" BOOLEAN NOT NULL DEFAULT false,
    "discount" DECIMAL(8,2),
    "advance" DECIMAL(8,2),
    "task" TEXT NOT NULL DEFAULT '',
    "contractDraft" TEXT NOT NULL DEFAULT '',
    "qualification" TEXT NOT NULL DEFAULT '',
    "similar" TEXT NOT NULL DEFAULT '',
    "bondDays" INTEGER,
    "performDays" INTEGER,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderCheck" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fit" "FitStatus" NOT NULL DEFAULT 'catismir',

    CONSTRAINT "TenderCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderApproval" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'gozleyir',

    CONSTRAINT "TenderApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqBook" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "profit" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "vat" DECIMAL(8,2) NOT NULL DEFAULT 18,
    "management" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoqBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqSheet" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BoqSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqLine" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "sheet" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "material" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "labor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "laborOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BoqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqCost" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "kind" "CostKind" NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BoqCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqDuty" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "party" TEXT NOT NULL,

    CONSTRAINT "BoqDuty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqStaff" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "count" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BoqStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqGear" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" DECIMAL(14,2) NOT NULL,
    "insurance" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "BoqGear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "bondDay" INTEGER,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTask" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDay" INTEGER,
    "endDay" INTEGER,

    CONSTRAINT "ScheduleTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "inflow" DECIMAL(14,2),
    "advance" DECIMAL(14,2),
    "equity" DECIMAL(14,2),
    "loan" DECIMAL(14,2),
    "days30" DECIMAL(14,2),
    "days60" DECIMAL(14,2),
    "days90" DECIMAL(14,2),

    CONSTRAINT "CashPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePartner" (
    "id" TEXT NOT NULL,
    "kind" "FinancePartnerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '',
    "commission" DECIMAL(8,2),
    "discount" DECIMAL(8,2),
    "light" "BankLight" NOT NULL DEFAULT 'gozleme',
    "proof" TEXT NOT NULL DEFAULT '',
    "proofDate" DATE,
    "api" TEXT NOT NULL DEFAULT 'bagli',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuaranteeCase" (
    "id" TEXT NOT NULL,
    "kind" "GuaranteeKind" NOT NULL,
    "mode" "AmountMode" NOT NULL,
    "amount" DECIMAL(14,2),
    "rate" DECIMAL(8,2),
    "offer" DECIMAL(8,2),
    "partnerId" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "light" "BankLight" NOT NULL DEFAULT 'gozleme',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuaranteeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPassport" (
    "id" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "fit" "FitStatus" NOT NULL DEFAULT 'el',
    "maker" TEXT NOT NULL DEFAULT '',
    "standard" TEXT NOT NULL DEFAULT '',
    "certificate" TEXT NOT NULL DEFAULT '',
    "issuer" TEXT NOT NULL DEFAULT '',
    "validUntil" DATE,
    "batch" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "updatedOn" DATE,
    "legal" TEXT NOT NULL DEFAULT 'Gözləyir',
    "party" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Boş',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoopRequest" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Təhlil olunur',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoopRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_kind_idx" ON "Organization"("kind");

-- CreateIndex
CREATE INDEX "Organization_voen_idx" ON "Organization"("voen");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_accountId_key" ON "OrganizationMember"("accountId");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "CatalogProduct_organizationId_category_idx" ON "CatalogProduct"("organizationId", "category");

-- CreateIndex
CREATE INDEX "PriceBreak_productId_idx" ON "PriceBreak"("productId");

-- CreateIndex
CREATE INDEX "PriceChange_productId_at_idx" ON "PriceChange"("productId", "at");

-- CreateIndex
CREATE INDEX "TradeRule_organizationId_trade_idx" ON "TradeRule"("organizationId", "trade");

-- CreateIndex
CREATE INDEX "ProjectFile_organizationId_idx" ON "ProjectFile"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");

-- CreateIndex
CREATE INDEX "ExtractedRow_fileId_sort_idx" ON "ExtractedRow"("fileId", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "CalcJob_haulId_key" ON "CalcJob"("haulId");

-- CreateIndex
CREATE INDEX "CalcJob_organizationId_trade_idx" ON "CalcJob"("organizationId", "trade");

-- CreateIndex
CREATE INDEX "CalcJob_projectId_idx" ON "CalcJob"("projectId");

-- CreateIndex
CREATE INDEX "CalcCostLine_jobId_sort_idx" ON "CalcCostLine"("jobId", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "JobSchedule_jobId_key" ON "JobSchedule"("jobId");

-- CreateIndex
CREATE INDEX "HaulQuote_organizationId_idx" ON "HaulQuote"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderFlow_jobId_key" ON "OrderFlow"("jobId");

-- CreateIndex
CREATE INDEX "OrderFlow_organizationId_stage_idx" ON "OrderFlow"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "OrderFlow_projectId_idx" ON "OrderFlow"("projectId");

-- CreateIndex
CREATE INDEX "OrderEvent_flowId_date_idx" ON "OrderEvent"("flowId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePlan_kind_key" ON "ServicePlan"("kind");

-- CreateIndex
CREATE INDEX "ServiceCharge_organizationId_idx" ON "ServiceCharge"("organizationId");

-- CreateIndex
CREATE INDEX "Dispute_organizationId_status_idx" ON "Dispute"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyRule_code_key" ON "SafetyRule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherDay_date_key" ON "WeatherDay"("date");

-- CreateIndex
CREATE INDEX "WeatherProof_projectId_date_idx" ON "WeatherProof"("projectId", "date");

-- CreateIndex
CREATE INDEX "TenderCase_projectId_idx" ON "TenderCase"("projectId");

-- CreateIndex
CREATE INDEX "TenderCheck_tenderId_idx" ON "TenderCheck"("tenderId");

-- CreateIndex
CREATE INDEX "TenderApproval_tenderId_idx" ON "TenderApproval"("tenderId");

-- CreateIndex
CREATE INDEX "BoqBook_projectId_idx" ON "BoqBook"("projectId");

-- CreateIndex
CREATE INDEX "BoqSheet_bookId_sort_idx" ON "BoqSheet"("bookId", "sort");

-- CreateIndex
CREATE INDEX "BoqLine_bookId_sort_idx" ON "BoqLine"("bookId", "sort");

-- CreateIndex
CREATE INDEX "BoqCost_bookId_kind_idx" ON "BoqCost"("bookId", "kind");

-- CreateIndex
CREATE INDEX "BoqDuty_bookId_idx" ON "BoqDuty"("bookId");

-- CreateIndex
CREATE INDEX "BoqStaff_bookId_idx" ON "BoqStaff"("bookId");

-- CreateIndex
CREATE INDEX "BoqGear_bookId_idx" ON "BoqGear"("bookId");

-- CreateIndex
CREATE INDEX "WorkSchedule_projectId_idx" ON "WorkSchedule"("projectId");

-- CreateIndex
CREATE INDEX "ScheduleTask_scheduleId_sort_idx" ON "ScheduleTask"("scheduleId", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "CashPlan_projectId_key" ON "CashPlan"("projectId");

-- CreateIndex
CREATE INDEX "GuaranteeCase_partnerId_idx" ON "GuaranteeCase"("partnerId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBreak" ADD CONSTRAINT "PriceBreak_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceChange" ADD CONSTRAINT "PriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRule" ADD CONSTRAINT "TradeRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcJob" ADD CONSTRAINT "CalcJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcJob" ADD CONSTRAINT "CalcJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcJob" ADD CONSTRAINT "CalcJob_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TradeRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcJob" ADD CONSTRAINT "CalcJob_haulId_fkey" FOREIGN KEY ("haulId") REFERENCES "HaulQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcCostLine" ADD CONSTRAINT "CalcCostLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CalcJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcJobProduct" ADD CONSTRAINT "CalcJobProduct_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CalcJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcJobProduct" ADD CONSTRAINT "CalcJobProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSchedule" ADD CONSTRAINT "JobSchedule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CalcJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HaulQuote" ADD CONSTRAINT "HaulQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFlow" ADD CONSTRAINT "OrderFlow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFlow" ADD CONSTRAINT "OrderFlow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFlow" ADD CONSTRAINT "OrderFlow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CalcJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFlow" ADD CONSTRAINT "OrderFlow_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFlow" ADD CONSTRAINT "OrderFlow_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFlow" ADD CONSTRAINT "OrderFlow_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OrderFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobWeatherHold" ADD CONSTRAINT "JobWeatherHold_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CalcJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobWeatherHold" ADD CONSTRAINT "JobWeatherHold_weatherDayId_fkey" FOREIGN KEY ("weatherDayId") REFERENCES "WeatherDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherProof" ADD CONSTRAINT "WeatherProof_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderCase" ADD CONSTRAINT "TenderCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderCheck" ADD CONSTRAINT "TenderCheck_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "TenderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderApproval" ADD CONSTRAINT "TenderApproval_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "TenderCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqBook" ADD CONSTRAINT "BoqBook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqSheet" ADD CONSTRAINT "BoqSheet_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BoqBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqLine" ADD CONSTRAINT "BoqLine_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BoqBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqCost" ADD CONSTRAINT "BoqCost_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BoqBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqDuty" ADD CONSTRAINT "BoqDuty_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BoqBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqStaff" ADD CONSTRAINT "BoqStaff_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BoqBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqGear" ADD CONSTRAINT "BoqGear_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BoqBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPlan" ADD CONSTRAINT "CashPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeCase" ADD CONSTRAINT "GuaranteeCase_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FinancePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WeatherFeed" ("id", "provider", "active", "note")
VALUES ('default', '', false, '');

INSERT INTO "SafetyRule" ("id", "code", "rainAt", "windAt", "pouring", "stops", "active") VALUES
('rule-rain-80', 'yagis-80', 80, NULL, false, 'Hündürmərtəbəli iş, dam, fasad, açıq beton', true),
('rule-wind-12', 'kulek-12', NULL, 12, false, 'Kran, fasad, hündürlükdə iş', true),
('rule-wind-15', 'kulek-15', NULL, 15, false, 'Bütün açıq sahə işləri', true),
('rule-pouring', 'yagis-baslayib', NULL, NULL, true, 'Açıq beton tökmə', true);

INSERT INTO "ServicePlan" ("id", "kind", "name", "amount", "note") VALUES
('plan-abune', 'abune', 'Aylıq abunə', NULL, ''),
('plan-layihe', 'layihe', 'Layihə hesablama haqqı', NULL, ''),
('plan-kabinet', 'kabinet', 'Təchizatçı kabineti', NULL, ''),
('plan-komissiya', 'komissiya', 'Sifariş komissiyası, %', NULL, ''),
('plan-modul', 'modul', 'Hesablama modulu', NULL, ''),
('plan-korporativ', 'korporativ', 'Korporativ tarif', NULL, '');
