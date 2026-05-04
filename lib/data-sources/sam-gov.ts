export interface SamGovOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  fullParentPathName: string;
  postedDate: string;
  type: string;
  baseType: string;
  archiveType: string;
  archiveDate: string | null;
  responseDeadLine: string | null;
  naicsCode: string;
  naicsCodes: string[];
  classificationCode: string;
  active: string;
  award: {
    date: string | null;
    amount: string | null;
    awardee: { name: string; location: { streetAddress: string; city: { name: string }; state: { code: string }; zip: string; country: { code: string } } | null } | null;
    number: string | null;
  } | null;
  pointOfContact: Array<{ type: string; title: string | null; fullName: string; email: string; phone: string | null }>;
  description: string;
  organizationType: string;
  officeAddress: { zipcode: string; city: string; countryCode: string; state: string } | null;
  placeOfPerformance: { streetAddress: string | null; city: { code: string | null; name: string } | null; state: { code: string | null; name: string | null } | null; zip: string | null; country: { code: string; name: string } | null } | null;
  additionalInfoLink: string | null;
  uiLink: string;
  links: Array<{ rel: string; href: string }>;
  resourceLinks: string[] | null;
}

export interface SamGovResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SamGovOpportunity[];
}

export async function fetchSamGovOpportunities(
  page = 0,
  limit = 25
): Promise<SamGovOpportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    console.warn("SAM_GOV_API_KEY not configured — skipping SAM.gov sync");
    return [];
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(limit),
    offset: String(page * limit),
    ptype: "o,p,k,r", // solicitations, pre-solicitations, combined, sources sought
    deptname: "",
    cfda: "",
    active: "Yes",
  });

  try {
    const response = await fetch(
      `https://api.sam.gov/opportunities/v2/search?${params}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!response.ok) {
      console.error(`SAM.gov API error: ${response.status}`);
      return [];
    }
    const data = (await response.json()) as SamGovResponse;
    return data.opportunitiesData ?? [];
  } catch (e) {
    console.error("SAM.gov fetch error:", e);
    return [];
  }
}
