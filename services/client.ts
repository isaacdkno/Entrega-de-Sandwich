import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
// ID del proyecto: sviaiblmpronrwedddxn
const SUPABASE_URL = 'https://sviaiblmpronrwedddxn.supabase.co';

// Clave proporcionada por el usuario (JWT Token correcto)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aWFpYmxtcHJvbnJ3ZWRkZHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODg2MDcsImV4cCI6MjA3OTA2NDYwN30.2jbiWhcHICYjRDEm2G5uX53CB7M8ftTYJwopaWvaKvA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isSupabaseConfigured = () => {
    // Verificación simple para asegurar que tenemos credenciales reales
    return SUPABASE_URL.includes('supabase.co') && 
           SUPABASE_ANON_KEY.length > 50 && // Basic length check for JWT
           !SUPABASE_URL.includes('tu-proyecto');
};