import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Supabase 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다. .env 파일을 확인하세요.')
}

export const supabase = createClient(url, anonKey)

export const FOUNDER_EMAIL = (import.meta.env.VITE_FOUNDER_EMAIL as string) || ''
