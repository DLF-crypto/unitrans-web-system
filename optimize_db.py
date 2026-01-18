from app import app, db
from sqlalchemy import text

def apply_optimizations():
    with app.app_context():
        print("Applying Database Optimizations...")
        statements = [
            "ALTER TABLE waybills ADD INDEX IF NOT EXISTS idx_order_time (order_time)",
            "ALTER TABLE waybills ADD INDEX IF NOT EXISTS idx_unit_cust (unit_customer_id)",
            "ALTER TABLE waybills ADD INDEX IF NOT EXISTS idx_first_cust (first_leg_customer_id)",
            "ALTER TABLE waybills ADD INDEX IF NOT EXISTS idx_last_cust (last_leg_customer_id)",
            "ALTER TABLE waybills ADD INDEX IF NOT EXISTS idx_diff_cust (differential_customer_id)"
        ]
        for sql in statements:
            try:
                db.session.execute(text(sql))
                print(f"Executed: {sql}")
            except Exception as e:
                # 可能是因为 MySQL 版本不支持 IF NOT EXISTS 或者索引已存在
                print(f"Skipped or Error: {sql} -> {e}")
        
        db.session.commit()
        print("Optimizations completed.")

if __name__ == "__main__":
    apply_optimizations()
