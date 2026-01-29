#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
深邮接口推送处理器
"""
import hashlib
import requests
import json
from datetime import datetime


# 深邮接口配置
SZPOST_CONFIG = {
    'partner_code': '13304',
    'sign_key': 'e2bc059f142049c3a16449e97124c9dd',
    'push_url': 'http://120.78.92.57:8100/wbxt-itf/p/channel/importtrail'
}


def generate_signature(body_content, sign_key):
    """
    生成深邮接口签名
    
    Args:
        body_content: 报文JSON字符串
        sign_key: 签名密钥
    
    Returns:
        str: SHA256签名结果
    """
    signature_body = body_content + sign_key
    return hashlib.sha256(signature_body.encode('utf-8')).hexdigest()


def build_push_payload(push_events, tracking_nodes_map):
    """
    构建推送报文payload
    
    Args:
        push_events: 推送事件列表 [{'order_no': '', 'tracking_time': '', 'status_code': '', ...}, ...]
        tracking_nodes_map: 状态码到轨迹节点的映射 {status_code: node_obj}
    
    Returns:
        dict: 推送报文payload
    """
    trail_list = []
    
    for event in push_events:
        order_no = event.get('order_no', '')
        node_status = event.get('status_code', '')
        node_time = event.get('tracking_time', '').replace('T', ' ')  # 替换T为空格
        node_desc = event.get('description', '')
        node_country = event.get('country', '')
        node_address = event.get('city', '')
        
        # 获取轨迹节点信息
        node = tracking_nodes_map.get(node_status)
        
        # 根据状态码填充机场字段
        rec_county_port = ''
        rec_county_port_cd = ''
        send_county_port = ''
        send_county_port_cd = ''
        
        if node_status == 'O_037':
            rec_county_port = 'LosAngels'
            rec_county_port_cd = 'LAX'
        elif node_status == 'O_035':
            send_county_port = 'Shenzhen'
            send_county_port_cd = 'SZX'
        
        trail_item = {
            'orderCode': order_no,
            'nodeStatus': node_status,
            'nodeTime': node_time,
            'nodeDesc': node_desc,
            'nodeCountry': node_country,
            'nodeAddress': node_address,
            'recCountyPort': rec_county_port,
            'recCountyPortCd': rec_county_port_cd,
            'sendCountyPort': send_county_port,
            'sendCountyPortCd': send_county_port_cd
        }
        
        trail_list.append(trail_item)
    
    return {'trailList': trail_list}


def push_tracking_to_szpost(push_events, tracking_nodes_map):
    """
    推送轨迹数据到深邮接口
    
    Args:
        push_events: 推送事件列表
        tracking_nodes_map: 状态码到轨迹节点的映射
    
    Returns:
        dict: 推送结果 {'success': True/False, 'message': '', 'response': {}}
    """
    try:
        # 构建payload
        payload = build_push_payload(push_events, tracking_nodes_map)
        
        # 转换为JSON字符串
        body_content = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
        
        # 生成签名
        datadigest = generate_signature(body_content, SZPOST_CONFIG['sign_key'])
        
        # 发送POST请求（签名和合作商编码放在请求头）
        response = requests.post(
            SZPOST_CONFIG['push_url'],
            data=body_content.encode('utf-8'),
            headers={
                'Content-Type': 'application/json;charset=UTF-8',
                'datadigest': datadigest,
                'partnercode': SZPOST_CONFIG['partner_code']
            },
            timeout=30
        )
        
        response.raise_for_status()
        
        # 解析响应
        result = response.json()
        
        return {
            'success': True,
            'message': '推送成功',
            'response': result
        }
        
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'message': '推送超时',
            'response': None
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'message': f'推送失败: {str(e)}',
            'response': None
        }
    except json.JSONDecodeError:
        return {
            'success': False,
            'message': '响应数据格式错误',
            'response': None
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'推送异常: {str(e)}',
            'response': None
        }


def batch_push_tracking_to_szpost(tracking_list, tracking_nodes_map, batch_size=100):
    """
    批量推送轨迹数据到深邮接口
    
    Args:
        tracking_list: 轨迹信息列表 [{'order_no': '', 'push_events': [...]}, ...]
        tracking_nodes_map: 状态码到轨迹节点的映射
        batch_size: 每批次最大推送数量（默认100）
    
    Returns:
        dict: 批量推送结果
    """
    results = []
    
    # 合并所有推送事件
    all_events = []
    for tracking in tracking_list:
        push_events = tracking.get('push_events', [])
        all_events.extend(push_events)
    
    # 分批推送
    total_batches = (len(all_events) + batch_size - 1) // batch_size
    
    for i in range(0, len(all_events), batch_size):
        batch_events = all_events[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        result = push_tracking_to_szpost(batch_events, tracking_nodes_map)
        result['batch_num'] = batch_num
        result['batch_size'] = len(batch_events)
        results.append(result)
    
    # 统计结果
    success_count = sum(1 for r in results if r.get('success'))
    failed_count = len(results) - success_count
    
    return {
        'success': failed_count == 0,
        'total_batches': total_batches,
        'success_batches': success_count,
        'failed_batches': failed_count,
        'results': results,
        'message': f'推送完成：成功{success_count}批，失败{failed_count}批'
    }
