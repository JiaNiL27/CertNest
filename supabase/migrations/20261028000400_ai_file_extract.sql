-- M7: "Fill from file" shares the hourly AI limit with post drafts. The
-- limit counts every feature together; this only allows the new label.
alter table public.ai_requests drop constraint ai_requests_feature_check;
alter table public.ai_requests
  add constraint ai_requests_feature_check check (feature in ('linkedin_post', 'file_extract'));
