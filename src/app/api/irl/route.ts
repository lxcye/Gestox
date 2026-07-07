import { NextResponse } from "next/server";

// INSEE BDM — Série 001515333 : IRL (Indice de Référence des Loyers)
const INSEE_URL =
  "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/001515333?format=jsondata&lastNObservations=30";

export interface IrlEntry {
  period: string;   // "2025-Q2"
  value: number;    // 146.68
  dateJO: string;   // date de publication estimée au JO
}

// Dates de publication au JO approximatives par trimestre
// T1 (jan-mar) → avril, T2 (avr-jun) → juillet, T3 (jul-sep) → octobre, T4 (oct-déc) → janvier suivant
function estimerDateJO(period: string): string {
  const [year, q] = period.split("-Q");
  const annee = parseInt(year);
  const trimestre = parseInt(q);
  const map: Record<number, string> = {
    1: `15/04/${annee}`,
    2: `15/07/${annee}`,
    3: `15/10/${annee}`,
    4: `15/01/${annee + 1}`,
  };
  return map[trimestre] ?? "";
}

export async function GET() {
  try {
    const res = await fetch(INSEE_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Erreur INSEE HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Parse SDMX-JSON
    const obsSection = data?.structure?.dimensions?.observation;
    if (!obsSection) {
      return NextResponse.json(
        { error: "Format SDMX inattendu (dimensions manquantes)" },
        { status: 502 },
      );
    }

    const timeDim = obsSection.find(
      (d: { id: string }) => d.id === "TIME_PERIOD",
    );
    if (!timeDim) {
      return NextResponse.json(
        { error: "Dimension TIME_PERIOD introuvable" },
        { status: 502 },
      );
    }

    const timeValues: { id: string }[] = timeDim.values;
    const observations: Record<string, number[]> =
      data?.dataSets?.[0]?.observations ?? {};

    const series: IrlEntry[] = [];

    for (const [key, vals] of Object.entries(observations)) {
      // key : "0:N" pour une série unique
      const parts = key.split(":");
      const timeIdx = parseInt(parts[parts.length - 1]);
      const period = timeValues[timeIdx]?.id;
      const value = vals[0];
      if (period && typeof value === "number" && !isNaN(value)) {
        // Vérifier que c'est un trimestre (ex: 2025-Q2)
        if (/^\d{4}-Q[1-4]$/.test(period)) {
          series.push({
            period,
            value: Math.round(value * 100) / 100,
            dateJO: estimerDateJO(period),
          });
        }
      }
    }

    series.sort((a, b) => b.period.localeCompare(a.period));

    return NextResponse.json({ series });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
