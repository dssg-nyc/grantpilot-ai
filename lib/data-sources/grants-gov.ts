export interface GrantsGovOpp {
  id: string;
  number: string;
  title: string;
  agency: string;
  agencyCode: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  docType: string;
  cfdaList: string[];
  // detail fields (populated by fetchDetails)
  description?: string;
  synopsis?: string;
  awardFloor?: string;
  awardCeiling?: string;
  eligibilities?: string[];
}

export async function fetchGrantsGovOpportunities(page = 0, pageSize = 25): Promise<GrantsGovOpp[]> {
  const response = await fetch("https://apply07.grants.gov/grantsws/rest/opportunities/search/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      oppStatuses: "forecasted|posted",
      rows: pageSize,
      startRecordNum: page * pageSize,
      sortBy: "openDate|desc",
    }),
  });
  const data = await response.json();
  return data.oppHits ?? [];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchGrantDetails(oppId: string): Promise<Partial<GrantsGovOpp>> {
  try {
    const response = await fetch(
      "https://apply07.grants.gov/grantsws/rest/opportunity/details",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `oppId=${oppId}`,
      }
    );
    if (!response.ok) return {};
    const d = await response.json();

    // Description lives in either forecast or synopsis sub-object
    const fc = d.forecast ?? {};
    const syn = d.synopsis ?? {};
    const rawDesc = fc.forecastDesc ?? syn.synopsisDesc ?? syn.description ?? "";
    const description = rawDesc ? stripHtml(rawDesc) : "";

    // Amounts
    const awardFloor = fc.awardFloor ?? syn.awardFloor ?? "";
    const awardCeiling = fc.awardCeiling ?? syn.awardCeiling ?? fc.estimatedFunding ?? "";

    // Eligibility — array of {id, description}
    const applicantTypes: string[] = (fc.applicantTypes ?? syn.applicantTypes ?? []).map(
      (t: { id: string }) => t.id
    );

    return { description, awardFloor, awardCeiling, eligibilities: applicantTypes };
  } catch {
    return {};
  }
}
