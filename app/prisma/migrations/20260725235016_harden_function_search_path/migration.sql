-- Pin an empty search_path on the two functions the Supabase linter flags as
-- having a role-mutable search_path (lint 0011_function_search_path_mutable).
--
-- Both are SECURITY INVOKER and reference only pg_catalog built-ins
-- (setweight/to_tsvector/array_to_string; sqrt/power) plus their own args and
-- the trigger NEW record — no objects in a user schema — so an empty
-- search_path is safe with no change to behaviour. pg_catalog is always
-- implicitly searched, so the 'english' text-search config still resolves.
ALTER FUNCTION public.items_search_vector_update() SET search_path = '';
ALTER FUNCTION public.delta_e_lab(
  double precision, double precision, double precision,
  double precision, double precision, double precision
) SET search_path = '';
