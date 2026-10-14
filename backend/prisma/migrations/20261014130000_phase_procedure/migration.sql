CREATE TABLE "PhaseProcedure" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "doneQty" DECIMAL(14,3) NOT NULL,
    "doneOn" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PhaseProcedure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhaseProcedure_projectId_phase_sort_idx" ON "PhaseProcedure"("projectId", "phase", "sort");

ALTER TABLE "PhaseProcedure" ADD CONSTRAINT "PhaseProcedure_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
