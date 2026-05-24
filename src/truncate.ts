import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function truncateTables() {
  console.log('Truncando tabelas...')
  
  try {
    // Truncate in correct order due to foreign key constraints
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE predictions CASCADE' })
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE matches CASCADE' })
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE teams CASCADE' })
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE profiles CASCADE' })
    
    console.log('Tabelas truncadas com sucesso!')
    process.exit(0)
  } catch (error) {
    console.error('Erro ao truncar tabelas:', error)
    process.exit(1)
  }
}

truncateTables()
