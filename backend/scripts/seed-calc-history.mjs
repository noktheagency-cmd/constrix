import { PrismaClient } from "@prisma/client"
import { seedCalcHistory } from "../prisma/calc-history.mjs"

const prisma = new PrismaClient()
const written = await seedCalcHistory(prisma)
console.log(JSON.stringify({ written }))
await prisma.$disconnect()
