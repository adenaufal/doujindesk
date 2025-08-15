import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Event {
  id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  venue: string
  max_circles: number
  circle_application_deadline: string
  status: 'planning' | 'registration_open' | 'registration_closed' | 'ongoing' | 'completed'
  created_at: string
  updated_at: string
}

export interface Circle {
  id: string
  event_id: string
  circle_code: string
  circle_name: string
  circle_name_furigana?: string
  pen_name: string
  pen_name_furigana?: string
  email: string
  phone?: string
  address?: string
  postal_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  co_rep_name?: string
  co_rep_email?: string
  co_rep_phone?: string
  circle_cut_file_url?: string
  sample_works_images?: string[]
  website?: string
  twitter?: string
  instagram?: string
  pixiv?: string
  space_preference?: 'circle_space_1' | 'circle_space_2' | 'circle_space_4' | 'circle_booth_a' | 'circle_booth_b'
  space_size?: string
  additional_table?: boolean
  additional_chair?: boolean
  additional_power?: boolean
  fandom?: string
  genre?: string
  rating?: 'all_ages' | 'r15' | 'r18'
  description?: string
  works_description?: string
  exhibitor_passes?: number
  product_types?: string[]
  previous_participation?: boolean
  sells_commission?: boolean
  marketplace_link?: string
  total_amount?: number
  payment_status?: 'pending' | 'paid' | 'refunded' | 'cancelled'
  application_status?: 'pending' | 'under_review' | 'accepted' | 'rejected' | 'waitlisted'
  booth_number?: string
  special_requests?: string
  notes?: string
  created_at: string
  updated_at: string
  user_id?: string
}