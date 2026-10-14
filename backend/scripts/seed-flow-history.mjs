import { PrismaClient } from "@prisma/client"
import { seedFlowHistory } from "../prisma/flow-history.mjs"

const prisma = new PrismaClient()
const written = await seedFlowHistory(prisma)
console.log(JSON.stringify({ written }))
await prisma.$disconnect()
