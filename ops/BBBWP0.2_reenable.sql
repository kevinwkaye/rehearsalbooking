-- Re-enable BBBWP0.2 after a functional rollback, without dropping any data.
BEGIN;
-- Any colours added by the older UI after rollback are mapped to the palette.
WITH non_palette AS (
 SELECT id,row_number() over (order by created_at,id) AS ordinal FROM public.bands
 WHERE upper(colour)<>ALL(ARRAY['#A30000','#D84797','#FF7700','#00AFB5','#7DDF64'])
)
UPDATE public.bands b SET colour=(ARRAY['#A30000','#D84797','#FF7700','#00AFB5','#7DDF64'])[((n.ordinal-1)%5)+1]
FROM non_palette n WHERE b.id=n.id;
ALTER TABLE public.bands ADD CONSTRAINT bbbwp02_band_colour_allowed
CHECK(upper(colour)=ANY(ARRAY['#A30000','#D84797','#FF7700','#00AFB5','#7DDF64']));
COMMIT;
