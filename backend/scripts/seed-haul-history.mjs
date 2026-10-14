import { PrismaClient } from "@prisma/client"
import { seedHaulHistory } from "../prisma/haul-history.mjs"

const prisma = new PrismaClient()
const written = await seedHaulHistory(prisma)
console.log(JSON.stringify({ written }))
await prisma.$disconnect()
