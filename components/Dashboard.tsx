'use client';
import LogoutButton from "./LogoutButton";
import ReservationsPanel from "./booking/ReservationsPanel";
import TablesPanel from "./booking/TablesPanel";
import { createClient } from "@/lib/supabase/client";
import {useEffect,useState} from 'react';
type Page =
  | 'dashboard'
  | 'conversazioni'
  | 'prodotti'
  | 'faq'
  | 'prenotazioni'
  | 'tavoli'
  | 'assistente'
  | 'impostazioni';
type Product = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
  description: string | null;
  is_active: boolean;
  image_url: string | null;
};
type Faq = {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
};
type Availability = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
};
const starterProducts=['Mystery Box Virale','Takis Selection','Latiao Selection'];
const starterFaq=[['Chi gestisce la spedizione?','TikTok Shop e il corriere.'],['Posso scegliere gli snack?','Faremo il possibile se l’ordine non è ancora stato preparato.']];
export default function Dashboard({
  companyName,
  userName,
}: {
  companyName: string;
  userName: string;
}) {
 const [page,setPage]=useState<Page>('dashboard'); const [products, setProducts] = useState<Product[]>([]); const [name,setName]=useState('');const [sku, setSku] = useState('');
const [brand, setBrand] = useState('');
const [category, setCategory] = useState('');
const [price, setPrice] = useState('');
const [stock, setStock] = useState('');
const [description, setDescription] = useState('');
const [editingProductId, setEditingProductId] = useState<string | null>(null);
const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
const [testMessage, setTestMessage] = useState("");
const [testResponse, setTestResponse] = useState("");
const [availability, setAvailability] = useState<Availability[]>([]);
const [selectedDay, setSelectedDay] = useState<number>(1);
const [selectedStartTime, setSelectedStartTime] = useState("19:00");
const [selectedEndTime, setSelectedEndTime] = useState("23:00");
const [selectedSlotMinutes, setSelectedSlotMinutes] = useState(30);
const [bookingDate, setBookingDate] = useState("");
const [bookingTime, setBookingTime] = useState("");
const [bookingGuests, setBookingGuests] = useState(2);
const [bookingName, setBookingName] = useState("");
const [bookingPhone, setBookingPhone] = useState("");
const [bookingNotes, setBookingNotes] = useState("");
const [faqs, setFaqs] = useState<Faq[]>([]); const [q,setQ]=useState(''); const [a,setA]=useState('');
 const [prompt,setPrompt]=useState('Sei l’assistente ufficiale di Indy Candy Shop. Rispondi sempre in italiano con tono cordiale, professionale ed empatico. Non inventare informazioni. Ricorda che le spedizioni sono gestite da TikTok Shop e dal corriere. Concludi sempre con: Per qualsiasi necessità o dubbio, restiamo a disposizione 😊');
 useEffect(() => {
    async function loadAvailability() {
  const supabase = createClient();

  const { data: availabilityData, error: availabilityError } = await supabase
    .from("reservation_availability")
    .select("id, day_of_week, start_time, end_time, slot_minutes, is_active")
    .order("day_of_week", { ascending: true });

  if (availabilityError) {
    console.error("Errore caricamento disponibilità:", availabilityError);
    return;
  }

  setAvailability(availabilityData ?? []);
}
  async function loadProducts() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, brand, category, price, stock, description, is_active, image_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento prodotti:", error);
      return;
    }

    setProducts(data ?? []);
  }

  async function loadFaqs() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("faqs")
    .select("id, question, answer, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore caricamento FAQ:", error);
    return;
  }

  setFaqs(data ?? []);
}

  loadProducts();
  loadFaqs();
  loadAvailability();
}, []);
 useEffect(() => {
  const pr = localStorage.getItem("assistly-prompt");

  if (pr) setPrompt(pr);
}, []);

 async function addProduct() {
    
  if (!name.trim()) return;

  const supabase = createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .single();

  if (profileError || !profile?.company_id) {
    console.error("Impossibile trovare l'azienda dell'utente");
    return;
  }

const { data: newProduct, error } = await supabase
  .from("products")
  .insert({
  company_id: profile.company_id,
  name: name.trim(),
  sku: sku.trim() || null,
  brand: brand.trim() || null,
  category: category.trim() || null,
  price: price ? Number(price.replace(",", ".")) : null,
  stock: stock ? Number(stock) : 0,
  description: description.trim() || null,
  is_active: true,

  })
  .select("id, name, sku, brand, category, price, stock, description, is_active, image_url")
  .single();

if (error || !newProduct) {
  console.error("Errore salvataggio prodotto:", error);
  return;
}

setProducts((prev) => [newProduct, ...prev]);

setName("");
setSku("");
setBrand("");
setCategory("");
setPrice("");
setStock("");
setDescription("");
}async function updateProduct() {
  if (!editingProductId || !name.trim()) return;

  const supabase = createClient();

  const { data: updatedProduct, error } = await supabase
    .from("products")
    .update({
      name: name.trim(),
      sku: sku.trim() || null,
      brand: brand.trim() || null,
      category: category.trim() || null,
      price: price ? Number(price.replace(",", ".")) : null,
      stock: stock ? Number(stock) : 0,
      description: description.trim() || null,
    })
    .eq("id", editingProductId)
    .select("id, name, sku, brand, category, price, stock, description, is_active, image_url")
    .single();

  if (error || !updatedProduct) {
    console.error("Errore modifica prodotto:", error);
    return;
  }

  setProducts((prev) =>
    prev.map((p) => (p.id === editingProductId ? updatedProduct : p))
  );

  setEditingProductId(null);
  setName("");
  setSku("");
  setBrand("");
  setCategory("");
  setPrice("");
  setStock("");
  setDescription("");
}
async function toggleProductStatus(product: Product) {
  const supabase = createClient();

  const { data: updatedProduct, error } = await supabase
    .from("products")
    .update({
      is_active: !product.is_active,
    })
    .eq("id", product.id)
    .select("id, name, sku, brand, category, price, stock, description, is_active, image_url")
    .single();

  if (error || !updatedProduct) {
    console.error("Errore aggiornamento stato prodotto:", error);
    return;
  }

  setProducts((prev) =>
    prev.map((p) => (p.id === product.id ? updatedProduct : p))
  );
}
async function deleteProduct(product: Product) {
  const confirmDelete = window.confirm(
    `Vuoi eliminare definitivamente "${product.name}"?`
  );

  if (!confirmDelete) return;

  const supabase = createClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", product.id);

  if (error) {
    console.error("Errore eliminazione prodotto:", error);
 
    return;
  }

  setProducts((prev) => prev.filter((p) => p.id !== product.id));
}
async function testAssistant() {
  if (!testMessage.trim()) return;

  setTestResponse("Sto pensando...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: testMessage,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setTestResponse(data.error || "Errore durante il test");
      return;
    }

    setTestResponse(data.message || "API collegata correttamente");
  } catch (error) {
    console.error("Errore test Assistly:", error);
    setTestResponse("Errore di connessione");
  }
}
 async function addFaq() {
  if (!q.trim() || !a.trim()) return;

  const supabase = createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .single();

  if (profileError || !profile?.company_id) {
    console.error("Impossibile trovare l'azienda dell'utente");
    return;
  }

  const { data: newFaq, error } = await supabase
    .from("faqs")
    .insert({
      company_id: profile.company_id,
      question: q.trim(),
      answer: a.trim(),
      is_active: true,
    })
    .select("id, question, answer, is_active")
    .single();

  if (error || !newFaq) {
    console.error("Errore salvataggio FAQ:", error);
    return;
  }

  setFaqs((prev) => [newFaq, ...prev]);
  setQ("");
  setA("");
}
async function updateFaq() {
  if (!editingFaqId || !q.trim() || !a.trim()) return;

  const supabase = createClient();

  const { data: updatedFaq, error } = await supabase
    .from("faqs")
    .update({
      question: q.trim(),
      answer: a.trim(),
    })
    .eq("id", editingFaqId)
    .select("id, question, answer, is_active")
    .single();

  if (error || !updatedFaq) {
    console.error("Errore modifica FAQ:", error);
    return;
  }

  setFaqs((prev) =>
    prev.map((f) => (f.id === editingFaqId ? updatedFaq : f))
  );

  setEditingFaqId(null);
  setQ("");
  setA("");
}
async function toggleFaqStatus(faq: Faq) {
  const supabase = createClient();

  const { data: updatedFaq, error } = await supabase
    .from("faqs")
    .update({
      is_active: !faq.is_active,
    })
    .eq("id", faq.id)
    .select("id, question, answer, is_active")
    .single();

  if (error || !updatedFaq) {
    console.error("Errore aggiornamento stato FAQ:", error);
    return;
  }

  setFaqs((prev) =>
    prev.map((f) => (f.id === faq.id ? updatedFaq : f))
  );
}
async function deleteFaq(faq: Faq) {
  const conferma = window.confirm(
    `Vuoi eliminare la FAQ "${faq.question}"?`
  );

  if (!conferma) return;

  const supabase = createClient();

  const { error } = await supabase
    .from("faqs")
    .delete()
    .eq("id", faq.id);

  if (error) {
    console.error("Errore eliminazione FAQ:", error);
    return;
  }

  setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
}

 function generateSlots(
  startTime: string,
  endTime: string,
  slotMinutes: number
): string[] {
  const slots: string[] = [];

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  let current = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  while (current < end) {
    const hours = Math.floor(current / 60)
      .toString()
      .padStart(2, "0");

    const minutes = (current % 60)
      .toString()
      .padStart(2, "0");

    slots.push(`${hours}:${minutes}`);
    current += slotMinutes;
  }

  return slots;
}
async function saveAvailability() {
  const supabase = createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .single();

  if (profileError || !profile?.company_id) {
    console.error("Impossibile trovare l'azienda dell'utente");
    return;
  }

  const { data: newAvailability, error } = await supabase
    .from("reservation_availability")
    .insert({
      company_id: profile.company_id,
      day_of_week: selectedDay,
      start_time: selectedStartTime,
      end_time: selectedEndTime,
      slot_minutes: selectedSlotMinutes,
      is_active: true,
    })
    .select("id, day_of_week, start_time, end_time, slot_minutes, is_active")
    .single();

  if (error || !newAvailability) {
    console.error("Errore salvataggio disponibilità:", error);
    return;
  }

  setAvailability((prev) =>
    [...prev, newAvailability].sort(
      (a, b) => a.day_of_week - b.day_of_week
    )
  );
}

 return <div className="app"><aside><div className="brand">Assistly <span>AI</span><small>Indy Candy Shop</small></div>{(['dashboard','conversazioni','prodotti','faq','prenotazioni','assistente','impostazioni'] as Page[]).map(x=><button key={x} className={page===x?'active':''} onClick={()=>setPage(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}<div className="online">● Assistente operativo</div><LogoutButton /></aside><main><header><div><p>CLIENTE PILOTA</p><h1>{page[0].toUpperCase()+page.slice(1)}</h1></div><b>{companyName}</b></header>
 {page==='dashboard'&&<><div className="metrics"><Card label="Conversazioni oggi" value="28"/><Card label="Risposte AI" value="23"/><Card label="Passaggi operatore" value="5"/><Card label="Tempo risparmiato" value="2h 10m"/></div><section><h2>Ultime conversazioni</h2><Row title="Cliente TikTok Shop" text="Pacco consegnato ma non ricevuto" tag="Operatore"/><Row title="Cliente WhatsApp" text="Richiesta Takis nella box" tag="Risolta AI"/><Row title="Cliente TikTok Shop" text="Prodotto arrivato aperto" tag="Foto richiesta"/></section></>}
 {page==='conversazioni'&&<section><h2>Conversazioni clienti</h2><Row title="Martina" text="Il pacco risulta consegnato ma non è arrivato" tag="Alta priorità"/><Row title="Luca" text="Potete inserire più snack piccanti?" tag="AI attiva"/><Row title="Sara" text="Una confezione è arrivata aperta" tag="Operatore"/></section>}
 {page==='prodotti'&&<section>
  <h2>Prodotti</h2>

  <div className="grid">
    <label>
      Nome prodotto
      <input
        value={name}
        onChange={e=>setName(e.target.value)}
        placeholder="Es. Takis Fuego 92g"
      />
    </label>

    <label>
      SKU
      <input
        value={sku}
        onChange={e=>setSku(e.target.value)}
        placeholder="Es. TAKIS-FUEGO-92"
      />
    </label>

    <label>
      Brand
      <input
        value={brand}
        onChange={e=>setBrand(e.target.value)}
        placeholder="Es. Takis"
      />
    </label>

    <label>
      Categoria
      <input
        value={category}
        onChange={e=>setCategory(e.target.value)}
        placeholder="Es. Snack"
      />
    </label>

    <label>
      Prezzo
      <input
        value={price}
        onChange={e=>setPrice(e.target.value)}
        placeholder="Es. 2,49"
      />
    </label>

    <label>
      Stock
      <input
        type="number"
        value={stock}
        onChange={e=>setStock(e.target.value)}
        placeholder="Es. 25"
      />
    </label>
  </div>

  <label>
    Descrizione
    <textarea
      value={description}
      onChange={e=>setDescription(e.target.value)}
      placeholder="Descrizione del prodotto"
    />
  </label>

  <button
  className="primary"
  onClick={editingProductId ? updateProduct : addProduct}
>
  {editingProductId ? "Salva modifiche" : "Aggiungi prodotto"}
</button>

  {products.map((p)=>(
    <div className="item" key={p.id}>
      <div>
        <b>{p.name}</b>
        <p>
          {p.brand ?? "—"} · {p.category ?? "—"} · € {p.price ?? "—"} · Stock {p.stock ?? 0}
        </p>
      </div>
      <span>{p.is_active ? "Disponibile" : "Non disponibile"}</span>
      <button
  type="button"
  onClick={() => toggleProductStatus(p)}
>
  {p.is_active ? "Disattiva" : "Attiva"}
</button><button
  type="button"
  onClick={() => deleteProduct(p)}
>
  Elimina
</button>
      <button
  type="button"
  onClick={() => {
  setEditingProductId(p.id);
  setName(p.name);
  setSku(p.sku ?? "");
  setBrand(p.brand ?? "");
  setCategory(p.category ?? "");
  setPrice(p.price?.toString() ?? "");
  setStock(p.stock?.toString() ?? "");
  setDescription(p.description ?? "");
}}
>
  Modifica
</button>
    </div>
  ))}
</section>}


 {page==='faq'&&<div className="cols"><section><h2>FAQ</h2>{faqs.map((f) =>
  <div className="faq" key={f.id}>
    <b>{f.question}</b>
    <p>{f.answer}</p>
    <button
  type="button"
  onClick={() => {
    setEditingFaqId(f.id);
    setQ(f.question);
    setA(f.answer);
  }}
>

  Modifica
</button>

<button
  type="button"
  onClick={() => toggleFaqStatus(f)}
>
  {f.is_active ? "Disattiva" : "Attiva"}
</button>

<button
  type="button"
  onClick={() => deleteFaq(f)}
>
  Elimina
</button>
  </div>
)}</section><section><h2>Aggiungi FAQ</h2><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Domanda"/><textarea value={a} onChange={e=>setA(e.target.value)} placeholder="Risposta"/><button
  className="primary"
  onClick={editingFaqId ? updateFaq : addFaq}
>
  {editingFaqId ? "Salva modifiche" : "Salva FAQ"}
</button></section></div>}
{page === "prenotazioni" && <ReservationsPanel />}
{page === "tavoli" && <TablesPanel />}
 {page==='assistente'&&<section>
  <h2>Configurazione Assistente AI</h2>

  <div className="status">
    Indy Candy Assistant <span>Online</span>
  </div>

  <label>Istruzioni principali</label>
  <textarea
    className="prompt"
    value={prompt}
    onChange={e=>setPrompt(e.target.value)}
  />

  <button
    className="primary"
    onClick={()=>{
      localStorage.setItem('assistly-prompt',prompt);
      alert('Istruzioni salvate');
    }}
  >
    Salva istruzioni
  </button>

  <hr />

  <h3>Test Assistente</h3>
      type="button"
    

  <input
    value={testMessage}
    onChange={e=>setTestMessage(e.target.value)}
    placeholder="Scrivi: Ciao Assistly"
  />

  <button
    className="primary"
    onClick={testAssistant}
  >
    Test Assistente
  </button>

  {testResponse && (
    <div className="status">
      Risposta: {testResponse}
    </div>
  )}
</section>}
 {page==='impostazioni'&&<section><h2>Impostazioni azienda</h2><div className="grid"><label>Nome azienda<input defaultValue="Indy Candy Shop"/></label><label>Sede<input defaultValue="Provincia di Napoli"/></label><label>Canale principale<input defaultValue="TikTok Shop"/></label><label>WhatsApp<input defaultValue="Da collegare"/></label></div><div className="roadmap"><b>Prossime integrazioni</b><p>Database cloud, login, OpenAI, WhatsApp Business e multi-azienda.</p></div></section>}
 </main></div>}
function Card({label,value}:{label:string,value:string}){return <div className="card"><span>{label}</span><strong>{value}</strong></div>}
function Row({title,text,tag}:{title:string,text:string,tag:string}){return <div className="row"><div><b>{title}</b><p>{text}</p></div><span>{tag}</span></div>}
