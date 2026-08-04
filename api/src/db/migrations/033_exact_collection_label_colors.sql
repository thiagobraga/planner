ALTER TABLE collections ALTER COLUMN color TYPE VARCHAR(64);
ALTER TABLE labels ALTER COLUMN color TYPE VARCHAR(64);

UPDATE collections SET color = CASE color
  WHEN 'berry_red'    THEN '#d56b64'
  WHEN 'red'          THEN '#c98079'
  WHEN 'orange'       THEN '#b97a3a'
  WHEN 'yellow'       THEN '#cbd376'
  WHEN 'olive_green'  THEN '#b7bf4e'
  WHEN 'lime_green'   THEN '#d7db96'
  WHEN 'green'        THEN '#7dbfb2'
  WHEN 'mint_green'   THEN '#a6cfc5'
  WHEN 'teal'         THEN '#7ea2d6'
  WHEN 'sky_blue'     THEN '#6fa0d5'
  WHEN 'light_blue'   THEN '#adb9c1'
  WHEN 'blue'         THEN '#65788a'
  WHEN 'grape'        THEN '#b08b8a'
  WHEN 'violet'       THEN '#c2a29e'
  WHEN 'lavender'     THEN '#d6c7b0'
  WHEN 'magenta'      THEN '#d16d73'
  WHEN 'salmon'       THEN '#cc8b85'
  WHEN 'charcoal'     THEN '#6f7780'
  WHEN 'grey'         THEN '#bababa'
  WHEN 'taupe'        THEN '#ac918f'
  ELSE color
END;

UPDATE labels SET color = CASE color
  WHEN 'berry_red'    THEN '#d56b64'
  WHEN 'red'          THEN '#c98079'
  WHEN 'orange'       THEN '#b97a3a'
  WHEN 'yellow'       THEN '#cbd376'
  WHEN 'olive_green'  THEN '#b7bf4e'
  WHEN 'lime_green'   THEN '#d7db96'
  WHEN 'green'        THEN '#7dbfb2'
  WHEN 'mint_green'   THEN '#a6cfc5'
  WHEN 'teal'         THEN '#7ea2d6'
  WHEN 'sky_blue'     THEN '#6fa0d5'
  WHEN 'light_blue'   THEN '#adb9c1'
  WHEN 'blue'         THEN '#65788a'
  WHEN 'grape'        THEN '#b08b8a'
  WHEN 'violet'       THEN '#c2a29e'
  WHEN 'lavender'     THEN '#d6c7b0'
  WHEN 'magenta'      THEN '#d16d73'
  WHEN 'salmon'       THEN '#cc8b85'
  WHEN 'charcoal'     THEN '#6f7780'
  WHEN 'grey'         THEN '#bababa'
  WHEN 'taupe'        THEN '#ac918f'
  ELSE color
END;

ALTER TABLE collections
  ADD CONSTRAINT collections_color_format
  CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$');

ALTER TABLE labels
  ADD CONSTRAINT labels_color_format
  CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$');
