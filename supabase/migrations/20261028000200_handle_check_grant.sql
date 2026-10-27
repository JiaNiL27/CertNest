-- The handle format check runs with the updating user's privileges, so
-- signed-in users need to be able to call this one pure function.
-- (The private schema is not exposed through the API; nothing else in it is
-- granted.)
grant usage on schema private to authenticated;
grant execute on function private.handle_is_valid(text) to authenticated;
