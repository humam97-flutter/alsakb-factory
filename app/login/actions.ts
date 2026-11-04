"use server";

import { redirect } from "next/navigation";
import { phoneToEmail } from "@/lib/auth";
import { fail, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

export async function signIn(form: FormData) {
  const phone = str(form, "phone");
  const password = str(form, "password");
  if (!phone || !password) fail("/login", "اكتب رقم الهاتف وكلمة السر.");
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password });
  if (error) fail("/login", "رقم الهاتف أو كلمة السر غير صحيحة.");
  redirect("/");
}

export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/login");
}
