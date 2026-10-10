-- Seed standard application users with Argon2id password hash for 'Password@123' and 'Admin@123'
BEGIN;

SELECT set_config('app.user_id', (SELECT user_id::text FROM app_user WHERE username = 'system'), false);

-- 1. Insert/Update Users
INSERT INTO app_user (username, password_hash, is_active) VALUES
  ('admin',              '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('owner',              '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('accounts',           '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('production_manager', '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('operator',           '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('quality_checker',    '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('gate_store',         '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('dispatch',           '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('sales',              '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true),
  ('staff_readonly',     '$argon2id$v=19$m=65536,t=3,p=4$AImRnh/xSOFbhpxehsI2oQ$aRKhSFiCiEKgsdxoP4GEUOeRgCLQpJAWY759CVxSvXE', true)
ON CONFLICT (lower(username)) DO UPDATE
SET password_hash = EXCLUDED.password_hash, is_active = true;

-- 2. Link Roles
INSERT INTO user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM app_user u
CROSS JOIN role r
WHERE u.username = r.role_name
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Grant admin and owner all roles
INSERT INTO user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM app_user u
CROSS JOIN role r
WHERE u.username IN ('admin', 'owner')
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
