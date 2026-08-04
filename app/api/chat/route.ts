import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Messaggio non valido" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getClaims();

    const userId = authData?.claims?.sub;

    if (authError || !userId) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }
    const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("company_id")
  .eq("id", userId)
  .single();

if (profileError || !profile?.company_id) {
  return NextResponse.json(
    { error: "Azienda non trovata" },
    { status: 400 }
  );
}

const { data: products, error: productsError } = await supabase
  .from("products")
  .select("name, brand, category, price, stock, description, is_active")
  .eq("company_id", profile.company_id)
  .eq("is_active", true);

if (productsError) {
  console.error("Errore caricamento prodotti:", productsError);
}

const { data: faqs, error: faqsError } = await supabase
  .from("faqs")
  .select("question, answer, is_active")
  .eq("company_id", profile.company_id)
  .eq("is_active", true);

if (faqsError) {
  console.error("Errore caricamento FAQ:", faqsError);
}

const businessContext = `
PRODOTTI DISPONIBILI:
${(products ?? [])
  .map(
    (p) =>
      `- ${p.name} | Brand: ${p.brand ?? "N/D"} | Categoria: ${
        p.category ?? "N/D"
      } | Prezzo: ${p.price ?? "N/D"} | Stock: ${
        p.stock ?? 0
      } | Descrizione: ${p.description ?? "N/D"}`
  )
  .join("\n")}

FAQ AZIENDALI:
${(faqs ?? [])
  .map((f) => `- Domanda: ${f.question}\n  Risposta: ${f.answer}`)
  .join("\n")}
`;

    const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: [
    {
      role: "system",
      content: `
Sei Assistly AI, assistente clienti dell'azienda.

Rispondi sempre in italiano, in modo chiaro, breve e professionale.

Usa esclusivamente le informazioni aziendali fornite qui sotto quando la domanda riguarda prodotti, prezzi, disponibilità o FAQ.

Se un'informazione non è presente nei dati, non inventarla.
Di' semplicemente che l'informazione non è disponibile e che può essere verificata con un operatore.

${businessContext}
      `,
    },
    {
      role: "user",
      content: message,
    },
  ],
});

return NextResponse.json({
  ok: true,
  message: response.output_text,
});
  } catch (error) {
    console.error("Errore API chat:", error);

    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}