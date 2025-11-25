import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Database Types
export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  edited_at?: string;
  created_at: string;
  profiles?: Profile;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profiles?: Profile;
}

export interface ReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
  profiles?: Profile;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
  profiles?: Profile;
}