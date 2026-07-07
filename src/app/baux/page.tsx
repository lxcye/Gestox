"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bail } from "@/lib/types";
import { getBaux, deleteBail } from "@/lib/store";

function fmtDateShort(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupByLogement(baux: Bail[]): Map<string, Bail[]> {
  const map = new Map<string, Bail[]>();
  for (const b of baux) {
    const key = `${b.logement.adresse}||${b.logement.code_postal}||${b.logement.ville}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return map;
}

// Palette : [headerGradient, barVif, barPale, badgeBg, badgeText, yearColor]
interface PaletteEntry { header: string; barVif: string; barPale: string; badgeBg: string }

const PALETTE: PaletteEntry[] = [
  { header: "from-blue-600 to-blue-500",    barVif: "from-blue-500 to-blue-400",    barPale: "bg-blue-100 text-blue-600",     badgeBg: "bg-blue-500/20 text-blue-100"   },
  { header: "from-violet-600 to-violet-500",barVif: "from-violet-500 to-violet-400",barPale: "bg-violet-100 text-violet-600",  badgeBg: "bg-violet-500/20 text-violet-100"},
  { header: "from-emerald-600 to-teal-500", barVif: "from-emerald-500 to-teal-400", barPale: "bg-emerald-100 text-emerald-700",badgeBg: "bg-emerald-500/20 text-emerald-100"},
  { header: "from-orange-500 to-amber-500", barVif: "from-orange-500 to-amber-400", barPale: "bg-orange-100 text-orange-700",  badgeBg: "bg-orange-500/20 text-orange-100"},
  { header: "from-rose-600 to-rose-500",    barVif: "from-rose-500 to-rose-400",    barPale: "bg-rose-100 text-rose-600",     badgeBg: "bg-rose-500/20 text-rose-100"   },
  { header: "from-teal-600 to-cyan-500",    barVif: "from-teal-500 to-cyan-400",    barPale: "bg-teal-100 text-teal-700",     badgeBg: "bg-teal-500/20 text-teal-100"   },
];

// ── Composant logement ─────────────────────────────────────────────────────────

function LogementCard({
  bails, colorIdx, onDelete,
}: {
  bails: Bail[]; colorIdx: number; onDelete: (id: string) => void;
}) {
  const { header, barVif, barPale, badgeBg } = PALETTE[colorIdx % PALETTE.length];
  const sample = bails[0];
  const today  = Date.now();

  const sorted = [...bails].sort((a, b) => a.contrat.date_debut.localeCompare(b.contrat.date_debut));
  const activeBail = sorted.find(b => b.locataire.en_place);
  const incidentsOuverts = sorted.reduce((acc, b) => acc + b.incidents.filter(i => !i.resolu).length, 0);

  // Plage temporelle
  const msStart = Math.min(...sorted.map(b => new Date(b.contrat.date_debut + "T12:00:00").getTime()));
  const msEnd   = Math.max(today, ...sorted.map(b => {
    const s = b.locataire.date_sortie;
    return b.locataire.en_place ? today : (s ? new Date(s + "T12:00:00").getTime() : today);
  }));
  const span = msEnd - msStart || 1;

  const yearStart = new Date(msStart).getFullYear();
  const yearEnd   = new Date(msEnd).getFullYear();
  const years     = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearStart + i);

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">

      {/* ── Bannière header ── */}
      <div className={`bg-gradient-to-r ${header} px-6 py-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-white text-lg font-bold leading-tight">
              {sample.logement.adresse}
            </h2>
            <p className="text-white/70 text-xs mt-0.5">
              {sample.logement.code_postal} {sample.logement.ville}
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {sample.logement.type_bien && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>
                  {sample.logement.type_bien}
                </span>
              )}
              {sample.logement.surface_m2 > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>
                  {sample.logement.surface_m2} m²
                </span>
              )}
              {incidentsOuverts > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  ⚠ {incidentsOuverts} incident{incidentsOuverts > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeBail ? (
              <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
                Occupé · {activeBail.locataire.prenom} {activeBail.locataire.nom.toUpperCase()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                Vacant
              </span>
            )}
            <Link href="/baux/nouveau"
              className="text-xs text-white/70 hover:text-white underline underline-offset-2">
              + Bail
            </Link>
          </div>
        </div>
      </div>

      {/* ── Corps blanc ── */}
      <div className="bg-white px-6 py-5">

        {/* Axe temporel */}
        <div className="relative h-5 mb-4">
          <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200" />
          {years.map(y => {
            const left = ((new Date(y, 0, 1).getTime() - msStart) / span) * 100;
            if (left < 0 || left > 97) return null;
            return (
              <div key={y} className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${left}%` }}>
                <div className="w-px h-2.5 bg-gray-300 mt-1" />
                <span className="text-[10px] font-medium mt-0.5 text-gray-400">{y}</span>
              </div>
            );
          })}
          {(() => {
            const left = ((today - msStart) / span) * 100;
            return left >= 0 && left <= 100 ? (
              <div className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${left}%` }}>
                <div className="w-px h-2.5 bg-blue-400 mt-1" />
                <span className="text-[10px] font-semibold text-blue-500 mt-0.5">auj.</span>
              </div>
            ) : null;
          })()}
        </div>

        {/* Barres de bail */}
        <div className="space-y-4">
          {sorted.map(bail => {
            const en_place = bail.locataire.en_place;
            const debut    = new Date(bail.contrat.date_debut + "T12:00:00").getTime();
            const sortie   = bail.locataire.date_sortie;
            const fin      = en_place ? today : (sortie ? new Date(sortie + "T12:00:00").getTime() : today);

            const left  = Math.max(0, ((debut - msStart) / span) * 100);
            const width = Math.min(Math.max(1.5, ((fin - debut) / span) * 100), 100 - left);

            const dateEntree = bail.locataire.date_entree || bail.contrat.date_debut;

            return (
              <div key={bail.id} className="space-y-1.5">
                {/* Barre */}
                <div className="relative h-8 bg-gray-100 rounded-xl overflow-hidden">
                  <div
                    className={`absolute top-0 h-full rounded-xl flex items-center px-3 overflow-hidden
                      ${en_place
                        ? `bg-gradient-to-r ${barVif} shadow-sm`
                        : barPale
                      }`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: "3px" }}
                  >
                    {width > 6 && (
                      <span className={`text-xs font-bold truncate ${en_place ? "text-white" : ""}`}>
                        {bail.locataire.prenom} {bail.locataire.nom.toUpperCase()}
                        {en_place && <span className="ml-1.5 opacity-80">→</span>}
                      </span>
                    )}
                  </div>
                </div>

                {/* Métadonnées + boutons */}
                <div className="flex items-center justify-between gap-2 px-0.5 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${en_place ? "text-gray-900" : "text-gray-500"}`}>
                      {bail.locataire.prenom} {bail.locataire.nom.toUpperCase()}
                    </span>

                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                      ${en_place ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {en_place ? "En place" : "Sorti"}
                    </span>

                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                      {bail.contrat.type_bail}
                    </span>

                    <span className="text-xs text-gray-400">
                      {fmtDateShort(dateEntree)} → {en_place ? "présent" : fmtDateShort(sortie ?? "")}
                    </span>

                    <span className="text-xs font-medium text-gray-500">
                      {bail.finances.loyer_total.toFixed(0)} €/mois
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/baux/${bail.id}`}
                      className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors">
                      Voir
                    </Link>
                    {bail.finances.locataire_id && (
                      <Link href={`/locataires/${bail.finances.locataire_id}/registre`}
                        className="text-xs font-medium bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition-colors">
                        Paiements
                      </Link>
                    )}
                    <button onClick={() => onDelete(bail.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-1 text-lg leading-none">
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BauxPage() {
  const [baux, setBaux] = useState<Bail[]>([]);

  useEffect(() => {
    setBaux(getBaux().sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }, []);

  function handleDelete(id: string) {
    if (confirm("Supprimer ce bail définitivement ?")) {
      deleteBail(id);
      setBaux(getBaux().sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    }
  }

  const grouped = groupByLogement(baux);
  const groups  = [...grouped.values()];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registre des baux</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {baux.length} bail{baux.length > 1 ? "s" : ""} · {grouped.size} logement{grouped.size > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/baux/nouveau"
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 font-medium text-sm">
          + Nouveau bail
        </Link>
      </div>

      {baux.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">🏠</p>
          <p className="font-semibold text-gray-700 mb-1">Aucun bail enregistré</p>
          <p className="text-sm mb-4">Créez votre premier bail pour commencer.</p>
          <Link href="/baux/nouveau"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 inline-block font-medium text-sm">
            + Créer le premier bail
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((bails, idx) => (
            <LogementCard key={bails[0].id} bails={bails} colorIdx={idx} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
