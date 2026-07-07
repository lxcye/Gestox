// Sync layer: localStorage (local cache) <-> Supabase (cloud)
// - pushAll() : envoie tout le localStorage vers Supabase
// - pullAll() : charge depuis Supabase dans localStorage
// - markDirty() : déclenche un push automatique après 3 s

import { getSupabase } from "./supabase";

const LS_KEYS: Record<string, string> = {
  parametres:        "gestox_parametres",
  locataires:        "gestox_locataires",
  baux:              "gestox_baux",
  edls:              "gestox_etats_des_lieux",
  quittances:        "gestox_quittances",
  paiements:         "gestox_paiements",
  config_logements:  "gestox_config_logements",
  cautions:          "gestox_cautions",
  attestations_dg:   "gestox_attestations_dg",
  logement_templates:"gestox_logement_templates",
  learned_caract:    "gestox_learned_caract",
};

let _userId: string | null = null;
let _timer: ReturnType<typeof setTimeout> | null = null;
let _dirty = false;

export function setSyncUserId(id: string) {
  _userId = id;
}

export function markDirty() {
  _dirty = true;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    if (_dirty) pushAll().catch(console.error);
  }, 3000);
}

function collectAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [col, lsKey] of Object.entries(LS_KEYS)) {
    try {
      const raw = localStorage.getItem(lsKey);
      out[col] = raw ? JSON.parse(raw) : (col === "parametres" ? {} : []);
    } catch {
      out[col] = col === "parametres" ? {} : [];
    }
  }
  return out;
}

function applyAll(row: Record<string, unknown>) {
  for (const [col, lsKey] of Object.entries(LS_KEYS)) {
    if (row[col] !== undefined && row[col] !== null) {
      localStorage.setItem(lsKey, JSON.stringify(row[col]));
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

export async function pushAll(): Promise<void> {
  if (!_userId || typeof window === "undefined") return;
  const sb = getSupabase() as unknown as AnyClient;
  const payload = { user_id: _userId, ...collectAll(), updated_at: new Date().toISOString() };
  const { error } = await sb.from("user_data").upsert(payload, { onConflict: "user_id" });
  if (error) console.error("[sync] pushAll error:", error.message);
  else _dirty = false;
}

export async function pullAll(): Promise<void> {
  if (!_userId || typeof window === "undefined") return;
  const sb = getSupabase() as unknown as AnyClient;
  const { data, error } = await sb
    .from("user_data")
    .select("*")
    .eq("user_id", _userId)
    .single();
  if (error && error.code !== "PGRST116") {
    console.error("[sync] pullAll error:", error.message);
    return;
  }
  if (data) {
    applyAll(data as Record<string, unknown>);
  } else {
    // First login on this account: push local data to Supabase
    await pushAll();
  }
}
