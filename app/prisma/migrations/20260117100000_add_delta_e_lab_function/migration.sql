-- Create delta_e_lab function for perceptual color matching
-- This function calculates CIE76 deltaE between two LAB colors
-- Used for hex-based color search with pre-computed LAB values

CREATE OR REPLACE FUNCTION delta_e_lab(
  l1 DOUBLE PRECISION, a1 DOUBLE PRECISION, b1 DOUBLE PRECISION,
  l2 DOUBLE PRECISION, a2 DOUBLE PRECISION, b2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
BEGIN
  RETURN SQRT(
    POWER(l1 - l2, 2) +
    POWER(a1 - a2, 2) +
    POWER(b1 - b2, 2)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Add GIN index on colors JSONB for faster array element extraction
-- This helps with jsonb_array_elements() performance
CREATE INDEX IF NOT EXISTS item_image_details_colors_gin_idx
ON item_image_details USING GIN (colors);
