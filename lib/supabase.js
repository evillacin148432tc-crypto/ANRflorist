import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://jrezzwrafcalevzvgfuj.supabase.co";

const supabaseAnonKey = "sb_publishable_qF6lX64o14o3Xp2tzxGWSw_566qOcH6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
