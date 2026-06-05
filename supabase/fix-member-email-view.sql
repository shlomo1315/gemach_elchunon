-- ============================================================
-- תיקון: המייל של החבר נשמר אך לא מופיע בכרטיס/בכרטסת
-- ------------------------------------------------------------
-- הסיבה: עמודת email נוספה לטבלת members אחרי שנוצר ה-view
-- member_balances. ב-Postgres ה-"m.*" בתוך view מתרחב ומוקפא
-- בזמן יצירת ה-view, ולכן email לא נכלל בו — והקוד (כרטיס החבר
-- וגם רשימת החברים) קורא מ-member_balances. השמירה ל-members
-- תקינה; פשוט לא היה מאיפה להציג את המייל.
-- ------------------------------------------------------------
-- להריץ ב-Supabase SQL Editor. בטוח להרצה חוזרת (idempotent).
-- ============================================================

-- 1) ודא שעמודת המייל קיימת (אם כבר קיימת — לא ישתנה דבר)
alter table members add column if not exists email text;
create index if not exists members_email_idx on members (lower(email));

-- 2) רענן את ה-view כך שיכלול את כל עמודות members, כולל email
drop view if exists member_balances;
create view member_balances as
select
  m.*,
  coalesce(sum(signed_amount(t.amount, t.type)), 0) as balance,
  count(t.id)                                        as txn_count
from members m
left join transactions t on t.member_id = m.id
group by m.id;
