import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si faltan las variables, mostrar un aviso claro en vez de una pantalla en blanco
if (!url || !anon) {
  document.getElementById('root').innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;max-width:560px;margin:auto">' +
    '<h2>Falta configurar Supabase</h2>' +
    '<p>Cargá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno ' +
    'de Netlify y volvé a publicar el sitio (Clear cache and deploy).</p></div>'
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anon)
