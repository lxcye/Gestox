"use client";

import type { Bail } from "@/lib/types";

const TYPES_BIEN = ["Studio", "T1", "T2", "T3", "T4", "T5+", "Maison", "Autre"];

interface Props { bail: Bail; onSave: (b: Bail) => void; }

export default function TabLogement({ bail, onSave }: Props) {
  function upL(field: string, value: string | number) {
    onSave({ ...bail, logement: { ...bail.logement, [field]: value } });
  }

  return (
    <div className="space-y-4">
      <Field label="Adresse" value={bail.logement.adresse} onChange={v => upL("adresse", v)} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Code postal" value={bail.logement.code_postal} onChange={v => upL("code_postal", v)} />
        <Field label="Ville" value={bail.logement.ville} onChange={v => upL("ville", v)} />
        <Field label="Pays" value={bail.logement.pays} onChange={v => upL("pays", v)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Type de bien" value={bail.logement.type_bien} onChange={v => upL("type_bien", v)} options={TYPES_BIEN} />
        <Field label="Meublé / Vide" value={bail.logement.meuble} onChange={v => upL("meuble", v)} options={["Meublé", "Vide"]} />
        <Field label="Surface (m²)" value={bail.logement.surface_m2} onChange={v => upL("surface_m2", parseFloat(v) || 0)} type="number" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Étage" value={bail.logement.etage} onChange={v => upL("etage", v)} placeholder="Ex: 3ème" />
        <Field label="Numéro de lot" value={bail.logement.numero_lot} onChange={v => upL("numero_lot", v)} placeholder="Copropriété" />
      </div>
      <Field label="Annexes" value={bail.logement.annexes} onChange={v => upL("annexes", v)} placeholder="Parking, cave, balcon..." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Quote-part de copropriété" value={bail.logement.quote_part ?? ""} onChange={v => upL("quote_part", v)} placeholder="Ex: 152/1000" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; options?: string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2">
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border rounded-lg px-3 py-2" />
      )}
    </div>
  );
}
