# -*- coding: utf-8 -*-
"""
17Track尾程单号轨迹获取处理器
API文档：https://api.17track.net/track/v2.4/
"""

import requests
import json
from datetime import datetime


def register_lastmile_tracking(lastmile_numbers):
    """
    注册尾程单号到 17Track
    
    Args:
        lastmile_numbers: 尾程单号列表，最多40个
    
    Returns:
        dict: 包含注册结果的字典
    """
    try:
        if not lastmile_numbers or len(lastmile_numbers) == 0:
            return {
                "success": False,
                "message": "尾程单号列表为空"
            }
        
        if len(lastmile_numbers) > 40:
            return {
                "success": False,
                "message": f"单次请求最多支持40个单号，当前{len(lastmile_numbers)}个"
            }
        
        # 构建请求载荷
        payload = []
        for number in lastmile_numbers:
            if number:  # 过滤空值
                payload.append({
                    "number": str(number).strip(),
                    "carrier": "" # 为空字符串,由接口返回
                })
        
        if not payload:
            return {
                "success": False,
                "message": "没有有效的尾程单号"
            }
        
        # 构建请求头
        url = "https://api.17track.net/track/v2.4/register"
        headers = {
            "content-type": "application/json",
            "17token": "512F5F2EEFB5199E51D5A519A34ED790"
        }
        
        # 发送POST请求
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        # 解析响应JSON
        result = response.json()
        
        # 保存原始报文
        raw_response = json.dumps(result, ensure_ascii=False)
        
        return {
            "success": True,
            "data": result,
            "raw_response": raw_response,
            "message": "注册成功"
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


def fetch_lastmile_tracking(lastmile_numbers):
    """
    从17Track接口获取尾程轨迹信息
    
    Args:
        lastmile_numbers: 尾程单号列表，最多40个
    
    Returns:
        dict: 包含轨迹信息的字典
    """
    try:
        if not lastmile_numbers or len(lastmile_numbers) == 0:
            return {
                "success": False,
                "message": "尾程单号列表为空"
            }
        
        if len(lastmile_numbers) > 40:
            return {
                "success": False,
                "message": f"单次请求最多支持40个单号，当前{len(lastmile_numbers)}个"
            }
        
        # 构建请求载荷
        payload = []
        for number in lastmile_numbers:
            if number:  # 过滤空值
                payload.append({
                    "number": str(number).strip(),
                    "carrier": ""  # 为空字符串,由接口返回
                })
        
        if not payload:
            return {
                "success": False,
                "message": "没有有效的尾程单号"
            }
        
        # 构建请求头
        url = "https://api.17track.net/track/v2.4/gettrackinfo"
        headers = {
            "content-type": "application/json",
            "17token": "512F5F2EEFB5199E51D5A519A34ED790"
        }
        
        # 发送POST请求
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        # 解析响应JSON
        result = response.json()
        
        # 保存原始报文
        raw_response = json.dumps(result, ensure_ascii=False)
        
        return {
            "success": True,
            "data": result,
            "raw_response": raw_response,
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


def batch_fetch_lastmile_tracking(lastmile_list):
    """
    批量获取尾程轨迹信息（先注册，等待1分钟，再查询）
    
    Args:
        lastmile_list: 尾程单号列表，格式：[{"waybill_id": 1, "lastmile_no": "xxx"}, ...]
    
    Returns:
        list: 结果列表，每个元素包含waybill_id和轨迹信息
    """
    import time
    results = []
    
    # 每40个一批
    batch_size = 40
    for i in range(0, len(lastmile_list), batch_size):
        batch = lastmile_list[i:i + batch_size]
        
        # 提取尾程单号
        lastmile_numbers = [item.get('lastmile_no') for item in batch if item.get('lastmile_no')]
        
        if not lastmile_numbers:
            for item in batch:
                results.append({
                    "success": False,
                    "waybill_id": item.get('waybill_id'),
                    "lastmile_no": item.get('lastmile_no', ''),
                    "message": "尾程单号为空"
                })
            continue
        
        # 第一步：注册尾程单号
        register_result = register_lastmile_tracking(lastmile_numbers)
        
        if not register_result.get('success'):
            # 注册失败，整批失败
            for item in batch:
                results.append({
                    "success": False,
                    "waybill_id": item.get('waybill_id'),
                    "lastmile_no": item.get('lastmile_no', ''),
                    "message": f"注册失败: {register_result.get('message', '未知错误')}",
                    "register_response": register_result.get('raw_response', '')
                })
            continue
        
        # 等待1分钟后查询（给17track处理时间）
        time.sleep(60)
        
        # 第二步：查询轨迹
        fetch_result = fetch_lastmile_tracking(lastmile_numbers)
        
        if not fetch_result.get('success'):
            # 查询失败，但保留注册报文
            for item in batch:
                results.append({
                    "success": False,
                    "waybill_id": item.get('waybill_id'),
                    "lastmile_no": item.get('lastmile_no', ''),
                    "message": f"查询失败: {fetch_result.get('message', '未知错误')}",
                    "register_response": register_result.get('raw_response', ''),
                    "tracking_response": fetch_result.get('raw_response', '')
                })
        else:
            # 解析每个单号的结果
            data = fetch_result.get('data', {})
            track_data = data.get('data', {}).get('accepted', []) if isinstance(data, dict) else []
            
            # 创建单号到轨迹的映射
            track_map = {}
            for track in track_data:
                number = track.get('number', '')
                track_map[number] = track
            
            # 为每个运单匹配轨迹
            for item in batch:
                lastmile_no = item.get('lastmile_no', '')
                track_info = track_map.get(lastmile_no, {})
                
                results.append({
                    "success": True,
                    "waybill_id": item.get('waybill_id'),
                    "lastmile_no": lastmile_no,
                    "track_info": track_info,
                    "register_response": register_result.get('raw_response', ''),
                    "tracking_response": fetch_result.get('raw_response', ''),
                    "message": "获取成功"
                })
    
    return results
