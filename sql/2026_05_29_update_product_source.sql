-- Migration: update product.source from 'dummyjson' to 'external'
-- NOTE: Run on dev/staging first. A backup of affected rows is created below.

-- Backup affected rows
CREATE TABLE IF NOT EXISTS products_backup_dummyjson AS TABLE products WITH NO DATA;

INSERT INTO products_backup_dummyjson
SELECT * FROM products WHERE source = 'dummyjson';

-- Update rows
UPDATE products SET source = 'external' WHERE source = 'dummyjson';

-- End migration
