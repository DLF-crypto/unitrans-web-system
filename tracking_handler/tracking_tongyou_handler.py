# -*- coding: utf-8 -*-
"""
通邮供应商轨迹获取处理器
API文档：http://track.szty56.com:9494/api/track/getTrackInformation
"""

import requests
import json
from datetime import datetime


def fetch_tracking(transfer_no, interface_config, status_mapping, response_key_params=None):
    """
    从通邮接口获取轨迹信息
    
    Args:
        transfer_no: 转单号
        interface_config: 接口配置字典，包含request_url和auth_params
        status_mapping: 状态映射列表，格式：[{"supplier_status":"5","supplier_description":"","system_status_code":"xxx"},...]
        response_key_params: 关键参数配置，格式：{"status_key":"status","description_key":"record","city_key":"city","country_key":"country"}
    
    Returns:
        dict: 包含轨迹信息的字典
    """
    try:
        # 解析验证参数
        auth_params = json.loads(interface_config.get('auth_params', '{}'))
        token = auth_params.get('token', '')
        
        if not token:
            return {
                "success": False,
                "message": "缺少token验证信息"
            }
        
        # 获取基础URL
        base_url = interface_config.get('request_url', '').rstrip('=')
        if not base_url:
            return {
                "success": False,
                "message": "缺少请求地址配置"
            }
        
        # 构建请求URL
        url = f"{base_url}={transfer_no}"
        
        # 构建请求头
        headers = {
            'Accept': 'application/json;charset=utf-8',
            'Content-Type': 'application/json;charset=utf-8',
            'token': token
        }
        
        # 发送POST请求（根据错误提示，接口不支持GET）
        response = requests.post(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # 解析响应JSON
        result = response.json()
        
        # 保存原始报文
        raw_response = json.dumps(result, ensure_ascii=False)
        
        # 检查响应是否成功
        if not result.get('success'):
            error_info = result.get('error', {})
            return {
                "success": False,
                "message": f"接口返回失败: {error_info.get('errorInfo', '未知错误')}",
                "raw_response": raw_response
            }
        
        # 获取轨迹列表
        tracks = result.get('tracks', [])
        if not tracks:
            return {
                "success": True,
                "tracking_description": "",
                "status_code": "",
                "tracking_time": None,
                "raw_response": raw_response,
                "message": "暂无轨迹信息"
            }
        
        # 取第一个轨迹（通常只有一个）
        track = tracks[0]
        
        # 获取轨迹详细信息列表
        track_info_list = track.get('trackInfo', [])
        if not track_info_list:
            return {
                "success": True,
                "tracking_description": "",
                "status_code": "",
                "tracking_time": None,
                "raw_response": raw_response,
                "message": "暂无轨迹节点信息"
            }
        
        # 按时间排序，取最新的一条轨迹
        track_info_list.sort(key=lambda x: x.get('changeDate', 0), reverse=True)
        latest_track = track_info_list[0]
        
        # 解析关键参数配置，确定字段名
        key_params = response_key_params or {}
        status_key = key_params.get('status_key', 'status')
        description_key = key_params.get('description_key', 'record')
        
        # 提取字段（使用配置的字段名）
        supplier_status_code = str(latest_track.get(status_key, ''))  # 状态码
        supplier_description = latest_track.get(description_key, '')  # 轨迹描述
        change_date_timestamp = latest_track.get('changeDate')  # 时间戳（毫秒）
        
        # 转换时间戳为datetime对象
        tracking_time = None
        if change_date_timestamp:
            try:
                # 毫秒时间戳转换为秒
                tracking_time = datetime.fromtimestamp(change_date_timestamp / 1000.0)
            except:
                tracking_time = None
        
        # 通过映射表查找系统状态码
        # 优先匹配轨迹描述，如果描述匹配不到则使用状态码匹配
        system_status_code = ''
        matched = False
        
        # 第一步：尝试优先匹配描述（包含匹配）
        if supplier_description:
            for mapping in status_mapping:
                mapping_description = mapping.get('supplier_description', '').strip()
                if mapping_description and mapping_description in supplier_description.strip():
                    system_status_code = mapping.get('system_status_code', '')
                    matched = True
                    break
        
        # 第二步：如果描述没有匹配到，使用状态码匹配
        if not matched:
            for mapping in status_mapping:
                if mapping.get('supplier_status') == supplier_status_code:
                    system_status_code = mapping.get('system_status_code', '')
                    break
        
        return {
            "success": True,
            "tracking_description": supplier_description or '',
            "status_code": system_status_code,
            "tracking_time": tracking_time,
            "raw_status": supplier_status_code,  # 保留原始状态用于调试
            "raw_response": raw_response,  # 原始报文
            "message": "获取成功"
        }
        
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "message": "请求超时"
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "message": f"请求失败: {str(e)}"
        }
    except json.JSONDecodeError:
        return {
            "success": False,
            "message": "响应数据格式错误"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"处理失败: {str(e)}"
        }


def batch_fetch_tracking(waybill_list, interface_config, status_mapping, response_key_params=None):
    """
    批量获取轨迹信息
    
    Args:
        waybill_list: 运单列表，格式：[{"waybill_id":1,"order_no":"xxx","transfer_no":"xxx"},...]
        interface_config: 接口配置字典
        status_mapping: 状态映射列表
        response_key_params: 关键参数配置
    
    Returns:
        list: 结果列表
    """
    results = []
    
    for waybill in waybill_list:
        transfer_no = waybill.get('transfer_no', '')
        
        if not transfer_no:
            results.append({
                "success": False,
                "waybill_id": waybill.get('waybill_id'),
                "order_no": waybill.get('order_no'),
                "transfer_no": transfer_no,
                "message": "转单号为空"
            })
            continue
        
        # 获取单个轨迹
        result = fetch_tracking(transfer_no, interface_config, status_mapping, response_key_params)
        
        # 添加运单信息
        result['waybill_id'] = waybill.get('waybill_id')
        result['order_no'] = waybill.get('order_no')
        result['transfer_no'] = transfer_no
        
        results.append(result)
    
    return results
