-- Rename `groups` table to `pkl_groups` to avoid MySQL 8.0+ reserved word conflict.
-- MySQL RENAME TABLE automatically updates foreign key references.
RENAME TABLE `groups` TO `pkl_groups`;
