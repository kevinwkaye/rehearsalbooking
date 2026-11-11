import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const configured=Boolean(url&&key&&!url.includes('your-project'));
export const db=createClient(url||'https://example.supabase.co',key||'missing-key',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
  const {data,error}=await db.rpc(name,args);if(error)throw error;return data as T;
}
export function readableError(err:unknown){const text=err instanceof Error?err.message:String(err);
 if(/bands_name_unique/i.test(text))return 'That band name is already registered.';
 if(/unique|already booked|BOOKED|duplicate key|23505/i.test(text))return 'Sorry, this date has just been booked. Please choose another day.';
 if(/database error saving new user/i.test(text))return 'Could not register this band. The band name may already be taken. Please check with the administrator.';
 if(/not authorised|not authorized|forbidden|PERMISSION/i.test(text))return 'You do not have permission to do that.';
 if(/past date/i.test(text))return 'Please choose today or a future date.';
 if(/invalid login credentials/i.test(text))return 'Incorrect password. Ask the administrator for help.';
 return text||'Something went wrong. Please try again.';
}
