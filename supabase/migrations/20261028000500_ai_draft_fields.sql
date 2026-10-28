-- "Suggest with AI" (draft a description and skills) shares the same hourly
-- AI limit; this only allows the new label.
alter table public.ai_requests drop constraint ai_requests_feature_check;
alter table public.ai_requests
  add constraint ai_requests_feature_check
  check (feature in ('linkedin_post', 'file_extract', 'draft_fields'));
