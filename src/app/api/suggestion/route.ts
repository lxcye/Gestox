import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const { sujet, message, userEmail } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message vide" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "non_configure" }, { status: 503 });
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: "Gestox Suggestions <onboarding@resend.dev>",
      to: "lucieob29@gmail.com",
      subject: `[Gestox] Suggestion : ${sujet || "Sans sujet"}`,
      text: [
        `Nouvelle suggestion reçue via Gestox`,
        ``,
        `De : ${userEmail || "Utilisateur anonyme"}`,
        `Sujet : ${sujet || "Non précisé"}`,
        ``,
        `Message :`,
        message,
      ].join("\n"),
    });

    if (error) {
      console.error("[suggestion] Resend error:", error);
      return NextResponse.json({ error: "Erreur d'envoi" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[suggestion] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
