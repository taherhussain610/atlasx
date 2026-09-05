CREATE TABLE IF NOT EXISTS atlasx_sandbox_portfolios (
  portfolio_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state_json JSON NOT NULL,
  client_updated_at BIGINT UNSIGNED NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (portfolio_id),
  INDEX idx_atlasx_portfolios_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
