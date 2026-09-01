import { NextResponse } from "next/server";
import { db } from "@/db";
import { fnoInstruments } from "@/db/schema";
import { FNO_STOCKS } from "@/lib/fno-stocks";
import { count } from "drizzle-orm";

// Get all F&O instruments
export async function GET() {
  try {
    // Check if we have instruments in DB
    const result = await db.select({ total: count() }).from(fnoInstruments);
    const total = result[0]?.total || 0;

    if (total === 0) {
      // Seed from hardcoded list
      for (const stock of FNO_STOCKS) {
        await db
          .insert(fnoInstruments)
          .values({
            instrumentKey: stock.instrumentKey,
            tradingSymbol: stock.symbol,
            name: stock.name,
            exchange: "NSE",
            segment: "NSE_EQ",
            isActive: true,
          })
          .onConflictDoNothing();
      }
    }

    const instruments = await db.select().from(fnoInstruments);

    return NextResponse.json({
      instruments,
      total: instruments.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
