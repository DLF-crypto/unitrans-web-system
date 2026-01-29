"""
轨迹处理器管理模块
根据不同的供应商接口调用对应的处理器
"""

import importlib
import json


# 接口名称与处理器模块的映射
TRACKING_HANDLERS = {
    "华岳轨迹接口": "tracking_handler.tracking_huayue_handler",
    "通邮轨迹接口": "tracking_handler.tracking_tongyou_handler",
    # 未来添加其他供应商：
    # "其他供应商名称": "tracking_handler.tracking_other_handler",
}


def get_tracking_handler(interface_name):
    """
    根据接口名称获取对应的处理器模块
    
    Args:
        interface_name: 接口名称
        
    Returns:
        module or None: 处理器模块，如果找不到则返回None
    """
    handler_module_name = TRACKING_HANDLERS.get(interface_name)
    
    if not handler_module_name:
        return None
    
    try:
        # 动态导入模块
        handler_module = importlib.import_module(handler_module_name)
        return handler_module
    except ImportError as e:
        print(f"导入轨迹处理器模块失败: {interface_name} -> {handler_module_name}, 错误: {e}")
        return None


def fetch_tracking_by_interface(transfer_no, order_no, interface_config, status_mapping, response_key_params=None):
    """
    根据接口配置获取轨迹信息
    
    Args:
        transfer_no: 转单号
        order_no: 订单号
        interface_config: 接口配置字典
        status_mapping: 状态映射列表
        response_key_params: 关键参数配置
        
    Returns:
        dict: 轨迹信息结果
    """
    interface_name = interface_config.get('interface_name', '')
    
    # 获取对应的处理器
    handler = get_tracking_handler(interface_name)
    
    if not handler:
        return {
            "success": False,
            "message": f"不支持的接口类型: {interface_name}"
        }
    
    # 检查处理器是否有fetch_tracking方法
    if not hasattr(handler, 'fetch_tracking'):
        return {
            "success": False,
            "message": f"处理器缺少fetch_tracking方法: {interface_name}"
        }
    
    # 调用处理器获取轨迹
    try:
        # 尝试传入response_key_params参数
        result = handler.fetch_tracking(transfer_no, interface_config, status_mapping, response_key_params)
        return result
    except TypeError:
        # 如果处理器不支持response_key_params参数，则使用旧的签名
        try:
            result = handler.fetch_tracking(transfer_no, interface_config, status_mapping)
            return result
        except Exception as e:
            return {
                "success": False,
                "message": f"获取轨迹失败: {str(e)}"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"获取轨迹失败: {str(e)}"
        }


def batch_fetch_tracking_by_interface(waybill_list, interface_config, status_mapping, response_key_params=None):
    """
    批量获取轨迹信息
    
    Args:
        waybill_list: 运单列表
        interface_config: 接口配置字典
        status_mapping: 状态映射列表
        response_key_params: 关键参数配置
        
    Returns:
        list: 轨迹信息结果列表
    """
    interface_name = interface_config.get('interface_name', '')
    
    # 获取对应的处理器
    handler = get_tracking_handler(interface_name)
    
    if not handler:
        # 所有运单返回失败
        return [{
            "waybill_id": w.get('waybill_id'),
            "success": False,
            "message": f"不支持的接口类型: {interface_name}"
        } for w in waybill_list]
    
    # 检查处理器是否有batch_fetch_tracking方法
    if hasattr(handler, 'batch_fetch_tracking'):
        # 使用批量方法
        try:
            return handler.batch_fetch_tracking(waybill_list, interface_config, status_mapping, response_key_params)
        except TypeError:
            # 如果不支持response_key_params，尝试旧签名
            try:
                return handler.batch_fetch_tracking(waybill_list, interface_config, status_mapping)
            except Exception as e:
                return [{
                    "waybill_id": w.get('waybill_id'),
                    "success": False,
                    "message": f"批量获取失败: {str(e)}"
                } for w in waybill_list]
        except Exception as e:
            return [{
                "waybill_id": w.get('waybill_id'),
                "success": False,
                "message": f"批量获取失败: {str(e)}"
            } for w in waybill_list]
    elif hasattr(handler, 'fetch_tracking'):
        # 逐个调用单个方法
        results = []
        for waybill in waybill_list:
            transfer_no = waybill.get('transfer_no')
            waybill_id = waybill.get('waybill_id')
            
            if not transfer_no:
                results.append({
                    "waybill_id": waybill_id,
                    "success": False,
                    "message": "转单号为空"
                })
                continue
            
            try:
                result = handler.fetch_tracking(transfer_no, interface_config, status_mapping, response_key_params)
                result['waybill_id'] = waybill_id
                result['order_no'] = waybill.get('order_no')
                result['transfer_no'] = transfer_no
                results.append(result)
            except TypeError:
                # 不支持response_key_params，尝试旧签名
                try:
                    result = handler.fetch_tracking(transfer_no, interface_config, status_mapping)
                    result['waybill_id'] = waybill_id
                    result['order_no'] = waybill.get('order_no')
                    result['transfer_no'] = transfer_no
                    results.append(result)
                except Exception as e:
                    results.append({
                        "waybill_id": waybill_id,
                        "success": False,
                        "message": f"获取失败: {str(e)}"
                    })
            except Exception as e:
                results.append({
                    "waybill_id": waybill_id,
                    "success": False,
                    "message": f"获取失败: {str(e)}"
                })
        
        return results
    else:
        return [{
            "waybill_id": w.get('waybill_id'),
            "success": False,
            "message": f"处理器缺少fetch_tracking方法: {interface_name}"
        } for w in waybill_list]
