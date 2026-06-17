import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = (page - 1) * limit;

  const status = searchParams.get("status") ?? "active";
  const funderType = searchParams.get("funder_type");
  const fundingType = searchParams.get("funding_type");
  const focusAreas = searchParams.get("focus_areas")?.split(",").filter(Boolean);
  const amountMin = searchParams.get("amount_min");
  const amountMax = searchParams.get("amount_max");
  const deadlineFrom = searchParams.get("deadline_from");
  const deadlineTo = searchParams.get("deadline_to");
  const geoScope = searchParams.get("geographic_scope");
  const states = searchParams.get("states")?.split(",").filter(Boolean);
  const sort = searchParams.get("sort") ?? "newest";
  const search = searchParams.get("search");

  let query = supabase.from("opportunities").select("*", { count: "exact" });

  if (status === "closing_soon") {
    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    query = query
      .eq("status", "active")
      .lte("deadline", in14Days.toISOString().split("T")[0])
      .gte("deadline", new Date().toISOString().split("T")[0]);
  } else if (status !== "all") {
    query = query.eq("status", status === "active" ? "active" : status);
  }

  if (funderType) query = query.eq("funder_type", funderType);
  if (fundingType) query = query.eq("funding_type", fundingType);
  if (focusAreas?.length) query = query.overlaps("focus_areas", focusAreas);
  if (amountMin) query = query.gte("amount_max", parseInt(amountMin));
  if (amountMax) query = query.lte("amount_min", parseInt(amountMax));
  if (deadlineFrom) query = query.gte("deadline", deadlineFrom);
  if (deadlineTo) query = query.lte("deadline", deadlineTo);
  if (geoScope) query = query.eq("geographic_scope", geoScope);
  if (states?.length) query = query.overlaps("geographic_states", states);
  if (search) query = query.textSearch("title", search, { type: "websearch" });

  switch (sort) {
    case "trending": query = query.order("trending_score", { ascending: false }); break;
    case "deadline": query = query.order("deadline", { ascending: true, nullsFirst: false }); break;
    case "amount_desc": query = query.order("amount_max", { ascending: false, nullsFirst: false }); break;
    case "recent":
      // Most recently posted by the funder; fall back to ingest time.
      query = query
        .order("posted_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
    default: query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, has_more: (count ?? 0) > offset + limit },
    filters_applied: { status, funder_type: funderType, funding_type: fundingType, focus_areas: focusAreas, sort, search },
  });
}
