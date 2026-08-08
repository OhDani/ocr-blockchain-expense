-- protect_expense_delete.sql
-- PostgreSQL trigger: chặn xóa expense khi status ≠ 'PENDING'
-- Bảo vệ ở tầng database — ngay cả truy cập trực tiếp Supabase cũng không xóa được

CREATE OR REPLACE FUNCTION prevent_expense_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'PENDING' THEN
        RAISE EXCEPTION 'Không thể xóa chi phí đã xử lý (status: %). Chỉ chi phí PENDING mới được xóa.', OLD.status;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Xóa trigger cũ nếu có
DROP TRIGGER IF EXISTS trg_prevent_expense_delete ON "Expense";

-- Tạo trigger mới
CREATE TRIGGER trg_prevent_expense_delete
    BEFORE DELETE ON "Expense"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_expense_delete();
