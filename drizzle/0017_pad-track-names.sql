UPDATE `tracks`
SET `name` = printf('%03d', CAST(`name` AS INTEGER))
WHERE `name` GLOB '[0-9]' OR `name` GLOB '[0-9][0-9]';
