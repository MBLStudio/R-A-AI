import { createClient, SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Un único punto de acceso a Supabase, con dos comportamientos.

   EN EL SERVIDOR (rutas API, crons):
     conexión directa con la service_role key. Salta RLS.

   EN EL NAVEGADOR:
     va contra /api/db, nuestro proxy autenticado por cookie.
     La anon key ya no puede hacer nada — RLS la bloquea — así
     que aunque alguien la saque del bundle no le sirve de nada.

   Los módulos no notan la diferencia: siguen llamando a
   supabase.from(...) exactamente igual que antes.
   ============================================================ */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let cliente: SupabaseClient | null = null;

function obtener(): SupabaseClient {
  if (cliente) return cliente;

  if (typeof window === "undefined") {
    // Servidor: acceso directo con la clave privada.
    cliente = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    // Navegador: todo pasa por nuestro proxy.
    cliente = createClient(`${window.location.origin}/api/db`, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cliente;
}

/**
 * Se resuelve en el primer uso, no al importar: en el navegador
 * necesitamos que `window` exista para construir la URL del proxy.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const c = obtener() as unknown as Record<string | symbol, unknown>;
    const valor = c[prop];
    return typeof valor === "function" ? valor.bind(c) : valor;
  },
});

export type UserName = "alejandro" | "rut";

export interface Memory {
  id: string;
  user_id: string;
  category: string;
  content: string;
  importance: number;
  created_at: string;
}

export interface SharedMemory {
  id: string;
  category: string;
  content: string;
  importance: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  module: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}
