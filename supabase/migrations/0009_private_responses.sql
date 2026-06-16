-- 0009_private_responses.sql — raw TNA answers are the employee's own, for their eyes only.
--
-- Restrict tna_response SELECT to the OWNER. Managers/admins see only the CALCULATED results
-- (competency_result / progress_snapshot, whose read policies are unchanged) and the server-side
-- assessment preview — never the individual "Can I…?" yes/no answers. The validate + preview
-- routes read responses with the secret key, so the roll-up is unaffected. Idempotent.

drop policy if exists "response read scoped" on public.tna_response;
create policy "response read scoped" on public.tna_response for select to authenticated
  using (exists (select 1 from public.tna_assessment a
                 where a.id = tna_assessment_id
                   and public.cycle_owner(a.dev_cycle_id) = auth.uid()));
