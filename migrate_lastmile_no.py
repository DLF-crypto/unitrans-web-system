"""
数据迁移脚本：从raw_response中提取transferNo并回填到lastmile_no字段
执行方式：python migrate_lastmile_no.py
"""
import json
from app import app, db, TrackingInfo

def migrate_lastmile_numbers():
    """从raw_response提取transferNo并保存到lastmile_no字段"""
    with app.app_context():
        # 查询所有有raw_response但lastmile_no为空的记录
        trackings = TrackingInfo.query.filter(
            TrackingInfo.raw_response.isnot(None),
            TrackingInfo.raw_response != '',
            db.or_(
                TrackingInfo.lastmile_no.is_(None),
                TrackingInfo.lastmile_no == ''
            )
        ).all()
        
        print(f"找到 {len(trackings)} 条需要迁移的记录")
        
        success_count = 0
        skip_count = 0
        
        for tracking in trackings:
            try:
                raw_data = json.loads(tracking.raw_response)
                # 从通邮接口报文中提取transferNo
                if "tracks" in raw_data and raw_data["tracks"]:
                    lastmile_no = raw_data["tracks"][0].get("transferNo", "")
                    if lastmile_no:
                        tracking.lastmile_no = lastmile_no
                        success_count += 1
                        print(f"✓ 订单号: {tracking.order_no}, 尾程单号: {lastmile_no}")
                    else:
                        skip_count += 1
                else:
                    skip_count += 1
            except Exception as e:
                print(f"✗ 订单号: {tracking.order_no}, 错误: {str(e)}")
                skip_count += 1
        
        # 提交所有更改
        db.session.commit()
        
        print("\n" + "="*50)
        print(f"迁移完成！")
        print(f"成功提取: {success_count} 条")
        print(f"跳过: {skip_count} 条")
        print("="*50)

if __name__ == "__main__":
    migrate_lastmile_numbers()
