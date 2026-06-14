import { supabase } from "./supabase";
import type { Transaction } from "@/types";

export async function archiveTransactions(
  txns: (Transaction & { members?: { name: string } | null })[],
  fallbackMemberName?: string | null
) {
  if (txns.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  const rows = txns.map(t => ({
    original_id: t.id,
    member_id: t.member_id,
    member_name: t.members?.name ?? fallbackMemberName ?? null,
    amount: t.amount,
    type: t.type,
    method: t.method ?? null,
    greg_date: t.greg_date ?? null,
    heb_date: t.heb_date ?? null,
    notes: t.notes ?? null,
    category: t.category ?? null,
    original_created_at: t.created_at ?? null,
    deleted_by: user?.email ?? null,
  }));
  await supabase.from("deleted_transactions").insert(rows);
}
