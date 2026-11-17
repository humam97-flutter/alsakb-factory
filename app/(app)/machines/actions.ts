"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

export async function saveMachine(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/machines/${id}` : "/machines/new";
  const name = str(form, "name");
  const code = str(form, "code");
  if (!name || !code) fail(back, "اكتب رقم الماكنة واسمها.");
  const row = {
    code,
    name,
    capacity: str(form, "capacity"),
    status: str(form, "status") ?? "running",
    operator_id: str(form, "operator_id"),
    next_service: str(form, "next_service"),
    notes: str(form, "notes"),
  };
  const { error } = id ? await db.from("machines").update(row).eq("id", id) : await db.from("machines").insert(row);
  if (error) fail(back, dbError(error));
  revalidatePath("/machines");
  redirect("/machines");
}

export async function saveMaintenance(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/maintenance/${id}` : "/maintenance/new";
  const machine_id = str(form, "machine_id");
  if (!machine_id) fail(back, "اختر الماكنة.");
  const row = {
    machine_id,
    kind: str(form, "kind") ?? "breakdown",
    state: str(form, "state") ?? "open",
    day: str(form, "day") ?? undefined,
    done_by: str(form, "done_by"),
    cost: numOrNull(form, "cost"),
    description: str(form, "description"),
  };
  const { error } = id ? await db.from("maintenance").update(row).eq("id", id) : await db.from("maintenance").insert(row);
  if (error) fail(back, dbError(error));
  // عطل جديد يجعل الماكنة «عاطلة»، وإنجازه يرجعها «تعمل»
  if (row.kind === "breakdown" && row.state !== "done") {
    await db.from("machines").update({ status: "broken" }).eq("id", machine_id);
  } else if (row.state === "done") {
    await db.from("machines").update({ status: "running" }).eq("id", machine_id).in("status", ["broken", "maintenance"]);
  } else {
    await db.from("machines").update({ status: "maintenance" }).eq("id", machine_id).eq("status", "running");
  }
  revalidatePath("/maintenance");
  revalidatePath("/machines");
  redirect("/maintenance");
}
