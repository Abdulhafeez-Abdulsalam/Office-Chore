import { NextResponse, type NextRequest } from "next/server";
import { isoDate } from "@/lib/validation";
import { getCalendarEvents } from "@/server/queries";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 100;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = isoDate.safeParse(params.get("from"));
  const to = isoDate.safeParse(params.get("to"));
  const today = isoDate.safeParse(params.get("today"));
  if (!from.success || !to.success || !today.success || from.data >= to.data) {
    return NextResponse.json(
      { error: "from, to and today must be YYYY-MM-DD dates" },
      { status: 400 },
    );
  }
  if (Date.parse(to.data) - Date.parse(from.data) > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json(
      { error: `Range is limited to ${MAX_RANGE_DAYS} days` },
      { status: 400 },
    );
  }
  const only = params.get("only");
  const events = await getCalendarEvents({
    from: from.data,
    to: to.data,
    today: today.data,
    only: only === null ? undefined : only.split(",").filter(Boolean),
  });
  return NextResponse.json(events);
}
