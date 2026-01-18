"""运单导入处理模块"""
from datetime import datetime
import pandas as pd
from decimal import Decimal
import json


def calculate_waybill_fees(wb, products_map, customer_quotes_idx, supplier_quotes_idx):
    """计算单条运单的所有费用 (优化版，使用索引字典)"""
    product = products_map.get(wb.product_id)
    if not product:
        return None, ["未找到对应的产品"]

    fee_types = product.fee_types.split(",") if product.fee_types else []
    
    # 费用变量初始化
    unit_fee = Decimal(0)
    first_leg_fee = Decimal(0)
    last_leg_fee = Decimal(0)
    differential_fee = Decimal(0)
    dedicated_line_fee = Decimal(0)
    supplier_cost = Decimal(0)
    
    row_errors = []
    
    # 1. 单号收费
    if "单号收费" in fee_types and wb.unit_customer_id:
        quote = find_customer_quote(customer_quotes_idx, wb.unit_customer_id, "单号报价", None, wb.order_time)
        if not quote:
            row_errors.append(f"客户在{wb.order_time.strftime('%Y-%m-%d')}没有生效的单号报价")
        else:
            unit_fee = Decimal(str(quote.unit_fee)) if quote.unit_fee else Decimal(0)

    # 2. 头程收费
    if "头程收费" in fee_types and wb.first_leg_customer_id:
        quote = find_customer_quote(customer_quotes_idx, wb.first_leg_customer_id, "头程报价", wb.product_id, wb.order_time)
        if not quote:
            row_errors.append(f"客户产品在{wb.order_time.strftime('%Y-%m-%d')}没有生效的头程报价")
        else:
            air_freight = Decimal(str(quote.air_freight)) if quote.air_freight else Decimal(0)
            first_leg_fee = air_freight * Decimal(str(wb.weight))

    # 3. 尾程收费
    if "尾程收费" in fee_types and wb.last_leg_customer_id:
        quote = find_customer_quote(customer_quotes_idx, wb.last_leg_customer_id, "尾程报价", wb.product_id, wb.order_time)
        if not quote:
            row_errors.append(f"客户产品在{wb.order_time.strftime('%Y-%m-%d')}没有生效的尾程报价")
        else:
            express_fee = Decimal(str(quote.express_fee)) if quote.express_fee else Decimal(0)
            registration_fee = Decimal(str(quote.registration_fee)) if quote.registration_fee else Decimal(0)
            last_leg_fee = (express_fee * Decimal(str(wb.weight))) + registration_fee

    # 4. 供应商成本与差价收费
    s_quote = None
    if "差价收费" in fee_types and wb.supplier_id:
        s_quote = find_supplier_quote(supplier_quotes_idx, wb.supplier_id, wb.product_id, wb.order_time)
        if not s_quote:
            row_errors.append(f"供应商产品在{wb.order_time.strftime('%Y-%m-%d')}没有生效的报价")
        else:
            min_w = Decimal(str(s_quote.min_weight)) if s_quote.min_weight else Decimal(0)
            calc_weight = max(Decimal(str(wb.weight)), min_w)
            
            price_tiers = getattr(s_quote, 'parsed_tiers', [])
            if not price_tiers and s_quote.price_tiers:
                try: price_tiers = json.loads(s_quote.price_tiers)
                except: price_tiers = []
            
            matched_tier = None
            for tier in price_tiers:
                t_start = Decimal(str(tier.get('start', 0)))
                t_end = Decimal(str(tier.get('end', 999999)))
                if t_start < calc_weight <= t_end:
                    matched_tier = tier
                    break
            
            if matched_tier:
                t_express = Decimal(str(matched_tier.get('express', 0)))
                t_reg = Decimal(str(matched_tier.get('reg', 0)))
                supplier_cost = t_express * calc_weight + t_reg
            elif s_quote.express_fee is not None:
                supplier_cost = (Decimal(str(s_quote.express_fee)) * calc_weight) + (Decimal(str(s_quote.registration_fee or 0)))
            else:
                row_errors.append(f"重量{calc_weight}kg未匹配到供应商价格阶梯")

    # 5. 差价收费计算
    if "差价收费" in fee_types:
        # 查找专线处理费
        if wb.differential_customer_id:
            d_quote = find_customer_quote(customer_quotes_idx, wb.differential_customer_id, "专线处理费", wb.product_id, wb.order_time)
            if d_quote:
                w_fee = Decimal(str(d_quote.dedicated_line_weight_fee or 0))
                p_fee = Decimal(str(d_quote.dedicated_line_piece_fee or 0))
                dedicated_line_fee = (w_fee * Decimal(str(wb.weight))) + p_fee
        
        differential_fee = (supplier_cost - first_leg_fee - last_leg_fee) + dedicated_line_fee

    return {
        "unit_fee": unit_fee,
        "first_leg_fee": first_leg_fee,
        "last_leg_fee": last_leg_fee,
        "differential_fee": differential_fee,
        "dedicated_line_fee": dedicated_line_fee,
        "supplier_cost": supplier_cost
    }, row_errors


def validate_and_process_waybill_import(file_path, db, models):
    """
    验证并处理运单导入Excel文件
    
    Args:
        file_path: Excel文件路径
        db: 数据库对象
        models: 包含所有模型类的字典
    
    Returns:
        tuple: (success, message/data, error_details)
    """
    try:
        # 读取Excel文件
        df = pd.read_excel(file_path, dtype=str)
        
        # 验证表头
        required_columns = ["订单号", "转单号", "重量(kg)", "下单时间", "产品", 
                           "单号客户", "头程客户", "尾程客户", "差价客户", "供应商"]
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return False, f"缺少必需列：{', '.join(missing_columns)}", None
        
        # 移除示例行（如果存在）
        df = df[df["订单号"] != "ORD20260115001"]
        
        # 验证数据不为空
        if len(df) == 0:
            return False, "Excel文件中没有有效数据", None
        
        if len(df) > 200000:
            return False, f"数据量过大，最多支持200000条，当前{len(df)}条", None
        
        # 预加载所有基础数据（优化性能）
        products_dict = {p.name: p for p in models['Product'].query.all()}
        products_dict_by_id = {p.id: p for p in products_dict.values()}
        customers_dict = {c.short_name: c for c in models['Customer'].query.all()}
        suppliers_dict = {s.short_name: s for s in models['Supplier'].query.all()}
        
        # 预加载所有报价数据并建立索引字典（大幅提升查询性能）
        customer_quotes = models['CustomerQuote'].query.all()
        customer_quotes_idx = {}
        for q in customer_quotes:
            key = (q.customer_id, q.quote_type)
            if key not in customer_quotes_idx:
                customer_quotes_idx[key] = []
            customer_quotes_idx[key].append(q)

        supplier_quotes = models['SupplierQuote'].query.all()
        supplier_quotes_idx = {}
        for q in supplier_quotes:
            # 预解析阶梯报价 JSON，避免在循环中重复解析
            if q.price_tiers and isinstance(q.price_tiers, str):
                try: q.parsed_tiers = json.loads(q.price_tiers)
                except: q.parsed_tiers = []
            else:
                q.parsed_tiers = []
                
            key = (q.supplier_id, q.product_id)
            if key not in supplier_quotes_idx:
                supplier_quotes_idx[key] = []
            supplier_quotes_idx[key].append(q)
        
        # 验证和处理数据
        waybills_to_insert = []
        errors = []
        existing_order_nos = set()
        existing_transfer_nos = set()
        
        # 检查数据库中已存在的订单号和转单号
        existing_waybills = models['Waybill'].query.with_entities(
            models['Waybill'].order_no, 
            models['Waybill'].transfer_no
        ).all()
        
        db_order_nos = {w.order_no for w in existing_waybills}
        db_transfer_nos = {w.transfer_no for w in existing_waybills if w.transfer_no}
        
        # 将 DataFrame 转换为字典列表处理，比 iterrows 更快
        records = df.to_dict('records')
        for idx, row in enumerate(records):
            row_num = idx + 2  # Excel行号
            row_errors = []
            
            try:
                # 1. 验证订单号
                order_no = str(row["订单号"]).strip() if pd.notna(row["订单号"]) else ""
                if not order_no:
                    row_errors.append("订单号不能为空")
                elif order_no in db_order_nos:
                    row_errors.append(f"订单号'{order_no}'在数据库中已存在")
                elif order_no in existing_order_nos:
                    row_errors.append(f"订单号'{order_no}'在Excel中重复")
                else:
                    existing_order_nos.add(order_no)
                
                # 2. 验证转单号
                transfer_no = str(row["转单号"]).strip() if pd.notna(row["转单号"]) else None
                if transfer_no:
                    if transfer_no in db_transfer_nos:
                        row_errors.append(f"转单号'{transfer_no}'在数据库中已存在")
                    elif transfer_no in existing_transfer_nos:
                        row_errors.append(f"转单号'{transfer_no}'在Excel中重复")
                    else:
                        existing_transfer_nos.add(transfer_no)
                
                # 3. 验证重量
                try:
                    weight_str = str(row["重量(kg)"]).strip() if pd.notna(row["重量(kg)"]) else ""
                    if not weight_str:
                        row_errors.append("重量不能为空")
                    else:
                        weight = Decimal(weight_str)
                        if weight <= 0:
                            row_errors.append("重量必须大于0")
                        elif weight > 9999999.999:
                            row_errors.append("重量超出范围")
                except:
                    row_errors.append(f"重量格式错误：{row['重量(kg)']}")
                    weight = None
                
                # 4. 验证下单时间
                order_time_str = str(row["下单时间"]).strip() if pd.notna(row["下单时间"]) else ""
                if not order_time_str:
                    row_errors.append("下单时间不能为空")
                else:
                    try:
                        # 尝试多种时间格式
                        order_time = None
                        formats = [
                            "%Y-%m-%d %H:%M:%S",
                            "%Y-%-m-%-d %H:%M:%S",
                            "%Y/%m/%d %H:%M:%S",
                            "%Y/%-m/%-d %H:%M:%S"
                        ]
                        for fmt in formats:
                            try:
                                order_time = datetime.strptime(order_time_str, fmt)
                                break
                            except:
                                continue
                        
                        if order_time is None:
                            # 如果标准格式都不行，尝试手动解析
                            try:
                                parts = order_time_str.replace('/', '-').split()
                                date_part = parts[0]
                                time_part = parts[1] if len(parts) > 1 else "00:00:00"
                                date_nums = date_part.split('-')
                                time_nums = time_part.split(':')
                                order_time = datetime(
                                    int(date_nums[0]), 
                                    int(date_nums[1]), 
                                    int(date_nums[2]),
                                    int(time_nums[0]),
                                    int(time_nums[1]),
                                    int(time_nums[2])
                                )
                            except:
                                pass
                        
                        if order_time is None:
                            row_errors.append(f"下单时间格式错误，应为'2026-1-5 12:15:00'格式")
                    except Exception as e:
                        row_errors.append(f"下单时间格式错误：{str(e)}")
                        order_time = None
                
                # 5. 验证产品
                product_name = str(row["产品"]).strip() if pd.notna(row["产品"]) else ""
                if not product_name:
                    row_errors.append("产品不能为空")
                    product = None
                elif product_name not in products_dict:
                    row_errors.append(f"产品'{product_name}'不存在")
                    product = None
                else:
                    product = products_dict[product_name]
                
                # 6-9. 验证四个客户字段
                unit_customer_name = str(row["单号客户"]).strip() if pd.notna(row["单号客户"]) else ""
                first_leg_customer_name = str(row["头程客户"]).strip() if pd.notna(row["头程客户"]) else ""
                last_leg_customer_name = str(row["尾程客户"]).strip() if pd.notna(row["尾程客户"]) else ""
                differential_customer_name = str(row["差价客户"]).strip() if pd.notna(row["差价客户"]) else ""
                
                unit_customer = None
                first_leg_customer = None
                last_leg_customer = None
                differential_customer = None
                
                # 根据产品收费类型验证客户
                if product:
                    fee_types = product.fee_types.split(",")
                    
                    # 单号客户
                    if "单号收费" in fee_types:
                        if not unit_customer_name:
                            row_errors.append("产品包含单号收费，单号客户必填")
                        elif unit_customer_name not in customers_dict:
                            row_errors.append(f"单号客户'{unit_customer_name}'不存在")
                        else:
                            unit_customer = customers_dict[unit_customer_name]
                            if "单号客户" not in unit_customer.customer_types:
                                row_errors.append(f"客户'{unit_customer_name}'不是单号客户")
                    else:
                        # 产品不包含单号收费，但填写了单号客户
                        if unit_customer_name:
                            row_errors.append(f"产品'{product.name}'不包含单号收费，不应填写单号客户")
                    
                    # 头程客户
                    if "头程收费" in fee_types:
                        if not first_leg_customer_name:
                            row_errors.append("产品包含头程收费，头程客户必填")
                        elif first_leg_customer_name not in customers_dict:
                            row_errors.append(f"头程客户'{first_leg_customer_name}'不存在")
                        else:
                            first_leg_customer = customers_dict[first_leg_customer_name]
                            if "头程客户" not in first_leg_customer.customer_types:
                                row_errors.append(f"客户'{first_leg_customer_name}'不是头程客户")
                    else:
                        # 产品不包含头程收费，但填写了头程客户
                        if first_leg_customer_name:
                            row_errors.append(f"产品'{product.name}'不包含头程收费，不应填写头程客户")
                    
                    # 尾程客户
                    if "尾程收费" in fee_types:
                        if not last_leg_customer_name:
                            row_errors.append("产品包含尾程收费，尾程客户必填")
                        elif last_leg_customer_name not in customers_dict:
                            row_errors.append(f"尾程客户'{last_leg_customer_name}'不存在")
                        else:
                            last_leg_customer = customers_dict[last_leg_customer_name]
                            if "尾程客户" not in last_leg_customer.customer_types:
                                row_errors.append(f"客户'{last_leg_customer_name}'不是尾程客户")
                    else:
                        # 产品不包含尾程收费，但填写了尾程客户
                        if last_leg_customer_name:
                            row_errors.append(f"产品'{product.name}'不包含尾程收费，不应填写尾程客户")
                    
                    # 差价客户
                    if "差价收费" in fee_types:
                        if differential_customer_name:
                            if differential_customer_name not in customers_dict:
                                row_errors.append(f"差价客户'{differential_customer_name}'不存在")
                            else:
                                differential_customer = customers_dict[differential_customer_name]
                                if "差价客户" not in differential_customer.customer_types:
                                    row_errors.append(f"客户'{differential_customer_name}'不是差价客户")
                    else:
                        # 产品不包含差价收费，但填写了差价客户
                        if differential_customer_name:
                            row_errors.append(f"产品'{product.name}'不包含差价收费，不应填写差价客户")
                
                # 10. 验证供应商
                supplier_name = str(row["供应商"]).strip() if pd.notna(row["供应商"]) else ""
                supplier = None
                
                if product and "差价收费" in product.fee_types.split(","):
                    if not supplier_name:
                        row_errors.append("产品包含差价收费，供应商必填")
                    elif supplier_name not in suppliers_dict:
                        row_errors.append(f"供应商'{supplier_name}'不存在")
                    else:
                        supplier = suppliers_dict[supplier_name]
                else:
                    # 产品不包含差价收费，但填写了供应商
                    if supplier_name:
                        row_errors.append(f"产品'{product.name}'不包含差价收费，不应填写供应商")
                
                # 如果有错误，记录并继续下一行
                if row_errors:
                    errors.append({"row": row_num, "errors": row_errors})
                    continue
                
                # 验证客户报价
                unit_fee = Decimal(0)
                first_leg_fee = Decimal(0)
                last_leg_fee = Decimal(0)
                differential_fee = Decimal(0)
                supplier_cost = Decimal(0)
                s_quote = None
                
                if product and order_time:
                    fee_types = product.fee_types.split(",")
                    
                    # 获取费用
                    fees, fee_errors = calculate_waybill_fees(
                        type('obj', (object,), {
                            'product_id': product.id,
                            'unit_customer_id': unit_customer.id if unit_customer else None,
                            'first_leg_customer_id': first_leg_customer.id if first_leg_customer else None,
                            'last_leg_customer_id': last_leg_customer.id if last_leg_customer else None,
                            'differential_customer_id': differential_customer.id if differential_customer else None,
                            'supplier_id': supplier.id if supplier else None,
                            'weight': weight,
                            'order_time': order_time
                        }),
                        products_dict_by_id,
                        customer_quotes_idx,
                        supplier_quotes_idx
                    )
                    
                    if fee_errors:
                        row_errors.extend(fee_errors)
                    
                    if fees:
                        unit_fee = fees["unit_fee"]
                        first_leg_fee = fees["first_leg_fee"]
                        last_leg_fee = fees["last_leg_fee"]
                        differential_fee = fees["differential_fee"]
                        dedicated_line_fee = fees["dedicated_line_fee"]
                        supplier_cost = fees["supplier_cost"]
                
                # 如果报价验证有错误
                if row_errors:
                    errors.append({"row": row_num, "errors": row_errors})
                    continue

                # 构建待插入的运单数据
                waybill_data = {
                    "order_no": order_no,
                    "transfer_no": transfer_no,
                    "weight": weight,
                    "order_time": order_time,
                    "product_id": product.id if product else None,
                    "unit_customer_id": unit_customer.id if unit_customer else None,
                    "first_leg_customer_id": first_leg_customer.id if first_leg_customer else None,
                    "last_leg_customer_id": last_leg_customer.id if last_leg_customer else None,
                    "differential_customer_id": differential_customer.id if differential_customer else None,
                    "supplier_id": supplier.id if supplier else None,
                    "unit_fee": unit_fee,
                    "first_leg_fee": first_leg_fee,
                    "last_leg_fee": last_leg_fee,
                    "differential_fee": differential_fee,
                    "dedicated_line_fee": dedicated_line_fee,
                    "supplier_cost": supplier_cost,
                    "other_fee": Decimal(0),
                    "remark": None
                }
                
                waybills_to_insert.append(waybill_data)
                
            except Exception as e:
                row_errors.append(f"处理异常：{str(e)}")
                errors.append({"row": row_num, "errors": row_errors})
        
        # 如果有任何错误，返回错误信息
        if errors:
            return False, f"发现{len(errors)}行数据错误", errors
        
        # 批量插入数据（使用事务和批量映射插入以提升性能）
        try:
            if waybills_to_insert:
                # 使用 bulk_insert_mappings 替代循环 add，大幅提升20万条数据的插入速度
                db.session.bulk_insert_mappings(models['Waybill'], waybills_to_insert)
            
            db.session.commit()
            return True, f"成功导入{len(waybills_to_insert)}条运单数据", None
            
        except Exception as e:
            db.session.rollback()
            return False, f"数据库插入失败：{str(e)}", None
    
    except Exception as e:
        return False, f"文件处理失败：{str(e)}", None


def find_customer_quote(quotes_idx, customer_id, quote_type, product_id, order_time):
    """查找生效的客户报价 (优化版)"""
    relevant_quotes = quotes_idx.get((customer_id, quote_type), [])
    for quote in relevant_quotes:
        if quote.valid_from <= order_time <= quote.valid_to:
            # 检查产品ID维度（如果报价包含产品）
            if quote.quote_type in ["头程报价", "尾程报价", "专线处理费"]:
                if not quote.product_ids:
                    continue
                p_list = quote.product_ids.split(",")
                if str(product_id) not in p_list:
                    continue
            return quote
    return None


def find_supplier_quote(quotes_idx, supplier_id, product_id, order_time):
    """查找生效的供应商报价 (优化版)"""
    relevant_quotes = quotes_idx.get((supplier_id, product_id), [])
    for quote in relevant_quotes:
        if quote.valid_from <= order_time <= quote.valid_to:
            return quote
    return None
