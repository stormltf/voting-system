-- 修复业主表手机号字段长度
-- 执行时间: 2026-01-22
-- 问题: 手机号字段可能包含备注文字，如 "13811511019前业主蔡/陈"，VARCHAR(30) 不够用

ALTER TABLE owners MODIFY COLUMN phone1 VARCHAR(100);
ALTER TABLE owners MODIFY COLUMN phone2 VARCHAR(100);
ALTER TABLE owners MODIFY COLUMN phone3 VARCHAR(100);
