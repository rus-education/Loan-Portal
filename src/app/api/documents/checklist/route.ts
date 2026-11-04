import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const primaryPath = path.join(process.cwd(), "Checklist for Education Loan.pdf");
    const fallbackPath = path.join(process.cwd(), "public", "docs", "Checklist_for_Education_Loan.pdf");

    const resolvedPath = fs.existsSync(primaryPath) ? primaryPath : fallbackPath;

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Checklist PDF document not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(resolvedPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="Checklist for Education Loan.pdf"',
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err) {
    console.error("Failed to serve checklist PDF:", err);
    return NextResponse.json({ error: "Failed to serve checklist document" }, { status: 500 });
  }
}
