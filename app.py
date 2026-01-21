from datetime import datetime, timedelta
from sqlalchemy import func, extract
import pandas as pd
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import os
load_dotenv()
import json

from flask import Flask, render_template, redirect, url_for, request, jsonify, session, send_file, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from celery import Celery

from waybill_import_handler import (
    validate_and_process_waybill_import,
    calculate_waybill_fees
)
from invoice_handler import generate_customer_invoices, generate_supplier_invoices

app = Flask(__name__)
app.secret_key = "dev-change-this-secret"  # 用于会话管理，后续可根据需要修改

# Celery 配置
app.config['CELERY_BROKER_URL'] = 'redis://127.0.0.1:6379/0'
app.config['CELERY_RESULT_BACKEND'] = 'redis://127.0.0.1:6379/0'

def make_celery(app):
    celery = Celery(
        app.import_name,
        backend=app.config['CELERY_RESULT_BACKEND'],
        broker=app.config['CELERY_BROKER_URL']
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery

celery = make_celery(app)

# 上传文件配置
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB最大文件大小

# 账单存储配置
INVOICE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'customer invoices')
if not os.path.exists(INVOICE_FOLDER):
    os.makedirs(INVOICE_FOLDER)
app.config['INVOICE_FOLDER'] = INVOICE_FOLDER

SUPPLIER_INVOICE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'supplier invoices')
if not os.path.exists(SUPPLIER_INVOICE_FOLDER):
    os.makedirs(SUPPLIER_INVOICE_FOLDER)
app.config['SUPPLIER_INVOICE_FOLDER'] = SUPPLIER_INVOICE_FOLDER

import os

# 数据库配置 - 使用环境变量
DB_USER = os.environ.get('DB_USER', 'root')  # 本地使用 root
DB_PASSWORD = os.environ.get('DB_PASSWORD', '123456')  # 本地使用 123456
DB_HOST = os.environ.get('DB_HOST', '127.0.0.1')
DB_PORT = os.environ.get('DB_PORT', '3308')  # 本地使用 3308
DB_NAME = os.environ.get('DB_NAME', 'unitransDB')

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class TaskRecord(db.Model):
    __tablename__ = "task_records"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(64), unique=True, nullable=False)  # Celery 任务 ID
    task_name = db.Column(db.String(128), nullable=False)
    status = db.Column(db.String(32), default="PENDING")  # PENDING, PROCESSING, SUCCESS, FAILURE
    result_msg = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    permissions = db.relationship(
        "RolePagePermission",
        backref="role",
        cascade="all, delete-orphan",
        lazy="joined",
    )


import json

class RolePagePermission(db.Model):
    __tablename__ = "role_page_permissions"

    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    page_key = db.Column(db.String(64), nullable=False)
    can_view = db.Column(db.Boolean, default=False, nullable=False)  # 可查看（控制菜单显示）
    can_create = db.Column(db.Boolean, default=False, nullable=False)
    can_update = db.Column(db.Boolean, default=False, nullable=False)
    can_delete = db.Column(db.Boolean, default=False, nullable=False)
    # 存储字段级权限的JSON数据
    field_permissions = db.Column(db.Text, nullable=True)  # JSON格式存储字段权限


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    role = db.relationship("Role", backref="users", lazy="joined")


class Country(db.Model):
    __tablename__ = "countries"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    code = db.Column(db.String(2), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(300))  # 产品描述，允许为空
    # 收费类别：用逗号分隔，如："单号收费,头程收费"
    fee_types = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(128), nullable=False)  # 客户全称
    short_name = db.Column(db.String(64), nullable=False)  # 客户简称
    # 客户类别：用逗号分隔，如："单号客户,头程客户"
    customer_types = db.Column(db.String(255), nullable=False)
    contact_person = db.Column(db.String(64))  # 联系人
    email = db.Column(db.String(128))  # 邮箱
    remark = db.Column(db.String(500))  # 备注
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Supplier(db.Model):
    __tablename__ = "suppliers"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(128), nullable=False)  # 供应商全称
    short_name = db.Column(db.String(64), nullable=False)  # 供应商简称
    contact_person = db.Column(db.String(64))  # 联系人
    email = db.Column(db.String(128))  # 邮箱
    remark = db.Column(db.String(500))  # 备注
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class CustomerQuote(db.Model):
    __tablename__ = "customer_quotes"

    id = db.Column(db.Integer, primary_key=True)
    quote_name = db.Column(db.String(128), unique=True, nullable=False)  # 报价名称
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)  # 客户ID
    quote_type = db.Column(db.String(32), nullable=False)  # 报价类别：单号报价/头程报价/尾程报价
    product_ids = db.Column(db.String(255), nullable=True)  # 产品ID集合（逗号分隔）
    
    # 报价明细（根据类型不同，使用不同字段）
    unit_fee = db.Column(db.Numeric(10, 2))  # 单号费（元/单）
    air_freight = db.Column(db.Numeric(10, 2))  # 空运费（元/kg）
    express_fee = db.Column(db.Numeric(10, 2))  # 快递费（元/kg）
    registration_fee = db.Column(db.Numeric(10, 2))  # 挂号费（元/单）
    
    # 专线处理费
    dedicated_line_weight_fee = db.Column(db.Numeric(10, 2))  # 重量收费（元/kg）
    dedicated_line_piece_fee = db.Column(db.Numeric(10, 2))  # 单件收费（元/件）
    
    # 有效期
    valid_from = db.Column(db.DateTime, nullable=False)  # 开始时间
    valid_to = db.Column(db.DateTime, nullable=False)  # 结束时间
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # 关联客户和产品
    customer = db.relationship("Customer", backref="quotes", lazy="joined")


class SupplierQuote(db.Model):
    __tablename__ = "supplier_quotes"

    id = db.Column(db.Integer, primary_key=True)
    quote_name = db.Column(db.String(128), unique=True, nullable=False)  # 报价名称
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=False)  # 供应商ID
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)  # 产品ID
    
    # 新阶梯报价逻辑：旧的 express_fee/registration_fee 保留但不主要使用，或者作为默认值
    express_fee = db.Column(db.Numeric(10, 2), nullable=True)  # 快递费（元/kg）
    registration_fee = db.Column(db.Numeric(10, 2), nullable=True)  # 挂号费（元/单）
    
    # 阶梯报价扩展字段
    min_weight = db.Column(db.Numeric(10, 3), default=0)  # 最低计费重量
    price_tiers = db.Column(db.Text)  # 价格阶梯，JSON 字符串存储：[{"start": 0, "end": 0.1, "express": 86, "reg": 19}, ...]
    
    # 有效期
    valid_from = db.Column(db.DateTime, nullable=False)  # 开始时间
    valid_to = db.Column(db.DateTime, nullable=False)  # 结束时间
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # 关联供应商和产品
    supplier = db.relationship("Supplier", backref="quotes", lazy="joined")
    product = db.relationship("Product", backref="supplier_quotes", lazy="joined")


class Waybill(db.Model):
    __tablename__ = "waybills"

    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(64), unique=True, nullable=False)  # 订单号
    transfer_no = db.Column(db.String(64))  # 转单号
    weight = db.Column(db.Numeric(10, 3), default=0)  # 重量（kg，保疙3位小数）
    order_time = db.Column(db.DateTime, nullable=False, index=True)  # 下单时间
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), index=True)  # 产品ID
    
    # 客户信息
    unit_customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), index=True)  # 单号客户ID
    first_leg_customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), index=True)  # 头程客户ID
    last_leg_customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), index=True)  # 尾程客户ID
    differential_customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), index=True)  # 差价客户ID
    
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"))  # 供应商ID
    
    # 费用信息
    unit_fee = db.Column(db.Numeric(10, 2), default=0)  # 单号收费
    first_leg_fee = db.Column(db.Numeric(10, 2), default=0)  # 头程收费
    last_leg_fee = db.Column(db.Numeric(10, 2), default=0)  # 尾程收费
    differential_fee = db.Column(db.Numeric(10, 2), default=0)  # 差价收费
    dedicated_line_fee = db.Column(db.Numeric(10, 2), default=0)  # 专线处理费
    supplier_cost = db.Column(db.Numeric(10, 2), default=0)  # 供应商成本
    other_fee = db.Column(db.Numeric(10, 2), default=0)  # 其他费用
    
    remark = db.Column(db.Text)  # 备注
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # 关联关系
    product = db.relationship("Product", backref="waybills", lazy="joined")
    unit_customer = db.relationship("Customer", foreign_keys=[unit_customer_id], backref="unit_waybills", lazy="joined")
    first_leg_customer = db.relationship("Customer", foreign_keys=[first_leg_customer_id], backref="first_leg_waybills", lazy="joined")
    last_leg_customer = db.relationship("Customer", foreign_keys=[last_leg_customer_id], backref="last_leg_waybills", lazy="joined")
    differential_customer = db.relationship("Customer", foreign_keys=[differential_customer_id], backref="differential_waybills", lazy="joined")
    supplier = db.relationship("Supplier", backref="waybills", lazy="joined")


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    fee_type = db.Column(db.String(64), nullable=False)  # 单号收费, 头程收费, 尾程收费, 差价收费
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Numeric(10, 2), default=0)
    file_name = db.Column(db.String(255))
    is_paid = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    customer = db.relationship("Customer", backref="invoices", lazy="joined")


class SupplierInvoice(db.Model):
    __tablename__ = "supplier_invoices"

    id = db.Column(db.Integer, primary_key=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Numeric(10, 2), default=0)
    file_name = db.Column(db.String(255))
    is_paid = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    supplier = db.relationship("Supplier", backref="invoices", lazy="joined")

class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(20), nullable=False)  # 'customer' or 'supplier'
    target_id = db.Column(db.Integer, nullable=False)
    payment_type = db.Column(db.String(10), nullable=False)  # '收款' or '付款'
    payment_date = db.Column(db.DateTime, nullable=False)
    amount = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    receipt_path = db.Column(db.String(255))  # 水单图片路径
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'))  # 关联应收账单
    supplier_invoice_id = db.Column(db.Integer, db.ForeignKey('supplier_invoices.id'))  # 关联应付账单
    remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    @property
    def target_name(self):
        if self.target_type == 'customer':
            c = Customer.query.get(self.target_id)
            return c.full_name if c else "未知客户"
        else:
            s = Supplier.query.get(self.target_id)
            return s.full_name if s else "未知供应商"


# 简单的内存用户与角色模型（后续可迁移到数据库）
USERS = {
    "admin": {
        "password": "123456",
        "role": "系统管理员",
        "permissions": "ALL",  # 默认拥有所有页面的权限
    }
}


# ==================== Celery 异步任务 ====================

@celery.task(bind=True, name='app.async_generate_customer_invoices')
def async_generate_customer_invoices(self, year, month):
    """异步生成客户账单任务"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"========== 开始执行任务: {self.request.id} ==========")
    
    with app.app_context():
        try:
            logger.info("步骤 1: 查询任务记录")
            task_record = TaskRecord.query.filter_by(task_id=self.request.id).first()
            if task_record:
                logger.info("步骤 2: 更新任务状态为 PROCESSING")
                task_record.status = "PROCESSING"
                db.session.commit()
            else:
                logger.warning("未找到任务记录")
            
            logger.info(f"步骤 3: 开始生成账单 {year}-{month}")
            invoice_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'customer invoices')
            logger.info(f"账单目录: {invoice_folder}")
            
            count = generate_customer_invoices(int(year), int(month), db, {
                'Waybill': Waybill,
                'Product': Product,
                'Customer': Customer,
                'Invoice': Invoice,
                'CustomerQuote': CustomerQuote
            }, invoice_folder)
            
            logger.info(f"步骤 4: 账单生成完成，数量: {count}")
            
            if task_record:
                task_record.status = "SUCCESS"
                task_record.result_msg = f"成功生成了 {count} 份账单"
                db.session.commit()
                logger.info("步骤 5: 任务状态已更新为 SUCCESS")
            
            logger.info("========== 任务执行成功 ==========")
            return {"success": True, "count": count}
            
        except Exception as e:
            logger.error(f"========== 任务执行失败: {str(e)} ==========")
            logger.exception("详细错误信息:")
            if task_record:
                task_record.status = "FAILURE"
                task_record.result_msg = str(e)
                db.session.commit()
            raise e

@celery.task(bind=True, name='app.async_generate_supplier_invoices')
def async_generate_supplier_invoices(self, year, month):
    """异步生成供应商账单任务"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"========== 开始执行供应商账单任务: {self.request.id} ==========")
    
    with app.app_context():
        try:
            task_record = TaskRecord.query.filter_by(task_id=self.request.id).first()
            if task_record:
                task_record.status = "PROCESSING"
                db.session.commit()

            supplier_invoice_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'supplier invoices')
            logger.info(f"供应商账单目录: {supplier_invoice_folder}")
            
            count = generate_supplier_invoices(int(year), int(month), db, {
                'Waybill': Waybill,
                'Supplier': Supplier,
                'SupplierInvoice': SupplierInvoice,
                'SupplierQuote': SupplierQuote,
                'Product': Product
            }, supplier_invoice_folder)
            
            if task_record:
                task_record.status = "SUCCESS"
                task_record.result_msg = f"成功生成了 {count} 份供应商账单"
                db.session.commit()
            
            logger.info("========== 供应商账单任务执行成功 ==========")
            return {"success": True, "count": count}
        except Exception as e:
            logger.error(f"========== 供应商账单任务失败: {str(e)} ==========")
            logger.exception("详细错误:")
            if task_record:
                task_record.status = "FAILURE"
                task_record.result_msg = str(e)
                db.session.commit()
            raise e


@app.route('/pictures/<path:filename>')
def serve_pictures(filename):
    """根据路径获取图片文件"""
    return send_from_directory(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pictures'), filename)


@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    """根据路径获取上传的文件（如水单图片）"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route("/")
def index():
    """根路径：如果已登录，进入主界面；否则跳转到登录页"""
    if "user" in session:
        return redirect(url_for("app_main"))
    return redirect(url_for("login"))


@app.route("/login")
def login():
    """登录页（只返回前端登录界面，逻辑在 /api/login 中处理）"""
    if "user" in session:
        return redirect(url_for("app_main"))
    return render_template("login.html")


@app.post("/api/login")
def api_login():
    """处理登录请求：支持默认账号 admin 和数据库用户"""
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    # 先检查是否是默认管理员账号
    if username in USERS:
        user = USERS[username]
        if user["password"] == password:
            session["user"] = {
                "username": username,
                "role": user["role"],
                "permissions": user["permissions"],
            }
            return jsonify({"success": True, "redirect": url_for("app_main")})
    
    # 再检查数据库中的用户
    db_user = User.query.filter_by(username=username).first()
    if db_user and db_user.password == password:
        session["user"] = {
            "username": username,
            "role": db_user.role.name if db_user.role else "普通用户",
            "permissions": "ROLE_BASED",  # 基于角色的权限
        }
        return jsonify({"success": True, "redirect": url_for("app_main")})
    
    # 登录失败
    return jsonify({"success": False, "message": "用户名或密码错误"}), 400


@app.post("/api/logout")
def api_logout():
    """退出登录"""
    session.clear()
    return jsonify({"success": True})


@app.get("/api/user-permissions")
def api_get_user_permissions():
    """获取当前用户的页面权限"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401
    
    # 如果是 admin 管理员，返回所有权限
    if current_user.get("permissions") == "ALL":
        return jsonify({
            "success": True,
            "permissions": "ALL",
            "pages": []
        })
    
    # 获取数据库用户的角色权限
    db_user = User.query.filter_by(username=current_user["username"]).first()
    if not db_user or not db_user.role:
        return jsonify({
            "success": True,
            "permissions": "NONE",
            "pages": []
        })
    
    # 返回角色的权限列表
    permissions_data = []
    for perm in db_user.role.permissions:
        permission_item = {
            "page_key": perm.page_key,
            "can_view": perm.can_view,
            "can_create": perm.can_create,
            "can_update": perm.can_update,
            "can_delete": perm.can_delete,
        }
        
        # 添加字段权限（如果存在）
        if perm.field_permissions:
            try:
                permission_item["field_permissions"] = json.loads(perm.field_permissions)
            except:
                permission_item["field_permissions"] = {}
        else:
            permission_item["field_permissions"] = {}
        
        permissions_data.append(permission_item)
    
    return jsonify({
        "success": True,
        "permissions": "ROLE_BASED",
        "pages": permissions_data
    })


@app.post("/api/change-password")
def api_change_password():
    """修改密码"""
    # 检查登录状态
    user = session.get("user")
    if not user:
        return jsonify({"success": False, "message": "未登录"}), 401
    
    data = request.get_json() or {}
    old_password = (data.get("oldPassword") or "").strip()
    new_password = (data.get("newPassword") or "").strip()
    
    # 验证新密码格式
    if len(new_password) < 6:
        return jsonify({
            "success": False,
            "message": "密码长度至少6位",
            "field": "newPassword"
        }), 400
    
    username = user["username"]
    
    # 检查是否是内存中的默认管理员
    if username in USERS:
        # 验证旧密码
        if USERS[username]["password"] != old_password:
            return jsonify({
                "success": False,
                "message": "当前密码错误",
                "field": "oldPassword"
            }), 400
        
        # 更新内存中的密码（注意：重启后会恢复）
        USERS[username]["password"] = new_password
        return jsonify({"success": True, "message": "密码修改成功"})
    
    # 检查数据库用户
    db_user = User.query.filter_by(username=username).first()
    if not db_user:
        return jsonify({
            "success": False,
            "message": "用户不存在"
        }), 404
    
    # 验证旧密码
    if db_user.password != old_password:
        return jsonify({
            "success": False,
            "message": "当前密码错误",
            "field": "oldPassword"
        }), 400
    
    # 更新数据库中的密码
    db_user.password = new_password
    db.session.commit()
    
    return jsonify({"success": True, "message": "密码修改成功"})


@app.post("/api/roles")
def api_create_role():
    """创建角色，并保存页面级增删改查权限与创建时间"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    permissions_data = data.get("permissions") or []

    if not name:
        return jsonify({"success": False, "message": "角色名称不能为空"}), 400

    # 简单：只有系统管理员可以创建角色（后续可按权限表做更精细控制）
    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建角色"}), 403

    if Role.query.filter_by(name=name).first():
        return jsonify({"success": False, "message": "角色名称已存在"}), 400

    role = Role(name=name, description=description)

    for item in permissions_data:
        page_key = (item.get("pageKey") or "").strip()
        if not page_key:
            continue
        can_view = bool(item.get("canView"))
        can_create = bool(item.get("canCreate"))
        can_update = bool(item.get("canUpdate"))
        can_delete = bool(item.get("canDelete"))
        
        # 获取字段权限
        field_permissions = item.get("field_permissions")
        field_permissions_json = None
        if field_permissions:
            field_permissions_json = json.dumps(field_permissions)
        
        # 如果四个权限全为 False，且没有字段权限，就不保存该页面的记录
        if not (can_view or can_create or can_update or can_delete) and not field_permissions_json:
            continue

        role.permissions.append(
            RolePagePermission(
                page_key=page_key,
                can_view=can_view,
                can_create=can_create,
                can_update=can_update,
                can_delete=can_delete,
                field_permissions=field_permissions_json
            )
        )

    db.session.add(role)
    db.session.commit()

    return jsonify({"success": True, "id": role.id})


@app.get("/api/roles")
def api_get_roles():
    """获取角色列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = Role.query.order_by(Role.id.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        roles = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        roles = query.all()
        pagination_data = None

    roles_data = []
    for role in roles:
        roles_data.append({
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "created_at": role.created_at.isoformat() if role.created_at else None,
            "permissions": [
                {
                    "page_key": p.page_key,
                    "can_view": p.can_view,
                    "can_create": p.can_create,
                    "can_update": p.can_update,
                    "can_delete": p.can_delete,
                    # 添加字段权限（如果存在）
                    "field_permissions": json.loads(p.field_permissions) if p.field_permissions else {}
                }
                for p in role.permissions
            ],
        })

    return jsonify({
        "success": True, 
        "roles": roles_data,
        "pagination": pagination_data
    })


@app.put("/api/roles/<int:role_id>")
def api_update_role(role_id):
    """更新角色"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑角色"}), 403

    role = Role.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "角色不存在"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    permissions_data = data.get("permissions") or []

    if not name:
        return jsonify({"success": False, "message": "角色名称不能为空"}), 400

    # 检查名称是否与其他角色重复
    existing = Role.query.filter_by(name=name).first()
    if existing and existing.id != role_id:
        return jsonify({"success": False, "message": "角色名称已存在"}), 400

    role.name = name
    role.description = description

    # 删除旧权限
    RolePagePermission.query.filter_by(role_id=role_id).delete()

    # 添加新权限
    for item in permissions_data:
        page_key = (item.get("pageKey") or "").strip()
        if not page_key:
            continue
        can_view = bool(item.get("canView"))
        can_create = bool(item.get("canCreate"))
        can_update = bool(item.get("canUpdate"))
        can_delete = bool(item.get("canDelete"))
        
        # 获取字段权限
        field_permissions = item.get("field_permissions")
        field_permissions_json = None
        if field_permissions:
            field_permissions_json = json.dumps(field_permissions)
        
        if not (can_view or can_create or can_update or can_delete) and not field_permissions_json:
            continue

        role.permissions.append(
            RolePagePermission(
                page_key=page_key,
                can_view=can_view,
                can_create=can_create,
                can_update=can_update,
                can_delete=can_delete,
                field_permissions=field_permissions_json
            )
        )

    db.session.commit()
    return jsonify({"success": True})


@app.delete("/api/roles/<int:role_id>")
def api_delete_role(role_id):
    """删除角色"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除角色"}), 403

    role = Role.query.get(role_id)
    if not role:
        return jsonify({"success": False, "message": "角色不存在"}), 404

    db.session.delete(role)
    db.session.commit()
    return jsonify({"success": True})


# ==================== 用户管理 API ====================

@app.get("/api/users")
def api_get_users():
    """获取用户列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = User.query.order_by(User.id.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        users = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        users = query.all()
        pagination_data = None

    users_data = []
    for user in users:
        users_data.append({
            "id": user.id,
            "username": user.username,
            "role_id": user.role_id,
            "role_name": user.role.name if user.role else "",
            "created_at": user.created_at.isoformat() if user.created_at else None,
        })

    return jsonify({
        "success": True, 
        "users": users_data,
        "pagination": pagination_data
    })


@app.post("/api/users")
def api_create_user():
    """创建用户，默认密码 654321"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建用户"}), 403

    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    role_id = data.get("role_id")

    if not username:
        return jsonify({"success": False, "message": "用户名不能为空", "field": "username"}), 400

    if not role_id:
        return jsonify({"success": False, "message": "请选择角色", "field": "role_id"}), 400

    # 检查用户名是否已存在
    if User.query.filter_by(username=username).first():
        return jsonify({"success": False, "message": "用户名已存在", "field": "username"}), 400

    # 检查角色是否存在
    if not Role.query.get(role_id):
        return jsonify({"success": False, "message": "角色不存在", "field": "role_id"}), 400

    # 创建用户，默认密码 654321
    user = User(username=username, password="654321", role_id=role_id)
    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True, "id": user.id})


@app.put("/api/users/<int:user_id>")
def api_update_user(user_id):
    """编辑用户（仅修改角色）"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑用户"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "用户不存在"}), 404

    data = request.get_json() or {}
    role_id = data.get("role_id")

    if not role_id:
        return jsonify({"success": False, "message": "请选择角色", "field": "role_id"}), 400

    # 检查角色是否存在
    if not Role.query.get(role_id):
        return jsonify({"success": False, "message": "角色不存在", "field": "role_id"}), 400

    user.role_id = role_id
    db.session.commit()

    return jsonify({"success": True})


@app.delete("/api/users/<int:user_id>")
def api_delete_user(user_id):
    """删除用户"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除用户"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "用户不存在"}), 404

    db.session.delete(user)
    db.session.commit()

    return jsonify({"success": True})


@app.post("/api/users/<int:user_id>/reset-password")
def api_reset_user_password(user_id):
    """重置用户密码为 654321"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限重置密码"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "用户不存在"}), 404

    user.password = "654321"
    db.session.commit()

    return jsonify({"success": True})


# ==================== 目的国管理 API ====================

@app.get("/api/countries")
def api_get_countries():
    """获取目的国列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = Country.query.order_by(Country.id.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        countries = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        countries = query.all()
        pagination_data = None

    countries_data = []
    for country in countries:
        countries_data.append({
            "id": country.id,
            "name": country.name,
            "code": country.code,
            "created_at": country.created_at.isoformat() if country.created_at else None,
        })

    return jsonify({
        "success": True, 
        "countries": countries_data,
        "pagination": pagination_data
    })


@app.post("/api/countries")
def api_create_country():
    """创建目的国"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建目的国"}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip().upper()

    if not name:
        return jsonify({"success": False, "message": "国家名称不能为空", "field": "name"}), 400

    if not code:
        return jsonify({"success": False, "message": "国家二字代码不能为空", "field": "code"}), 400

    if len(code) != 2:
        return jsonify({"success": False, "message": "国家代码必须是2个字符", "field": "code"}), 400

    # 检查代码是否已存在
    if Country.query.filter_by(code=code).first():
        return jsonify({"success": False, "message": "国家代码已存在", "field": "code"}), 400

    country = Country(name=name, code=code)
    db.session.add(country)
    db.session.commit()

    return jsonify({"success": True, "id": country.id})


@app.put("/api/countries/<int:country_id>")
def api_update_country(country_id):
    """更新目的国"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑目的国"}), 403

    country = Country.query.get(country_id)
    if not country:
        return jsonify({"success": False, "message": "目的国不存在"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip().upper()

    if not name:
        return jsonify({"success": False, "message": "国家名称不能为空", "field": "name"}), 400

    if not code:
        return jsonify({"success": False, "message": "国家二字代码不能为空", "field": "code"}), 400

    if len(code) != 2:
        return jsonify({"success": False, "message": "国家代码必须是2个字符", "field": "code"}), 400

    # 检查代码是否与其他国家重复
    existing = Country.query.filter_by(code=code).first()
    if existing and existing.id != country_id:
        return jsonify({"success": False, "message": "国家代码已存在", "field": "code"}), 400

    country.name = name
    country.code = code
    db.session.commit()

    return jsonify({"success": True})


@app.delete("/api/countries/<int:country_id>")
def api_delete_country(country_id):
    """删除目的国"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除目的国"}), 403

    country = Country.query.get(country_id)
    if not country:
        return jsonify({"success": False, "message": "目的国不存在"}), 404

    db.session.delete(country)
    db.session.commit()

    return jsonify({"success": True})


@app.post("/api/countries/import")
def api_import_countries():
    """导入目的国数据（支持 xls, xlsx, csv）"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限导入数据"}), 403

    if "file" not in request.files:
        return jsonify({"success": False, "message": "请选择文件"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"success": False, "message": "请选择文件"}), 400

    # 检查文件格式
    filename = file.filename.lower()
    if not (filename.endswith(".xls") or filename.endswith(".xlsx") or filename.endswith(".csv")):
        return jsonify({"success": False, "message": "仅支持 xls, xlsx, csv 格式"}), 400

    try:
        # 读取文件内容
        file_content = file.read()
        
        # 根据文件类型解析
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_content))
        else:
            df = pd.read_excel(io.BytesIO(file_content))

        # 检查表头
        required_columns = ["国家", "国家二字代码"]
        if not all(col in df.columns for col in required_columns):
            return jsonify({
                "success": False,
                "message": f"文件表头必须包含：{', '.join(required_columns)}"
            }), 400

        # 统计数据
        success_count = 0
        skip_count = 0
        error_rows = []

        # 逐行处理
        for index, row in df.iterrows():
            name = str(row["国家"]).strip() if pd.notna(row["国家"]) else ""
            code = str(row["国家二字代码"]).strip().upper() if pd.notna(row["国家二字代码"]) else ""

            # 验证数据
            if not name or not code:
                error_rows.append(f"第{index + 2}行：国家名称或代码为空")
                continue

            if len(code) != 2:
                error_rows.append(f"第{index + 2}行：代码 '{code}' 不是2个字符")
                continue

            # 检查是否已存在
            existing = Country.query.filter_by(code=code).first()
            if existing:
                skip_count += 1
                continue

            # 创建新记录
            country = Country(name=name, code=code)
            db.session.add(country)
            success_count += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，跳过 {skip_count} 条",
            "success_count": success_count,
            "skip_count": skip_count,
            "errors": error_rows[:10]  # 最多返回前10条错误
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"文件解析失败：{str(e)}"
        }), 400


# ==================== 产品管理 API ====================

@app.get("/api/products")
def api_get_products():
    """获取产品列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = Product.query.order_by(Product.id.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        products = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        products = query.all()
        pagination_data = None

    products_data = []
    for product in products:
        products_data.append({
            "id": product.id,
            "name": product.name,
            "description": product.description or "",
            "fee_types": product.fee_types.split(",") if product.fee_types else [],
            "created_at": product.created_at.isoformat() if product.created_at else None,
        })

    return jsonify({
        "success": True, 
        "products": products_data,
        "pagination": pagination_data
    })


@app.post("/api/products")
def api_create_product():
    """创建产品"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建产品"}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    fee_types = data.get("fee_types") or []

    if not name:
        return jsonify({"success": False, "message": "产品名称不能为空", "field": "name"}), 400

    if not fee_types or len(fee_types) == 0:
        return jsonify({"success": False, "message": "请至少选择一种收费类别", "field": "fee_types"}), 400

    # 验证描述长度
    if description and len(description) > 100:
        return jsonify({"success": False, "message": "产品描述最多100字", "field": "description"}), 400

    # 将数组转为逗号分隔的字符串
    fee_types_str = ",".join(fee_types)

    product = Product(name=name, description=description, fee_types=fee_types_str)
    db.session.add(product)
    db.session.commit()

    return jsonify({"success": True, "id": product.id})


@app.put("/api/products/<int:product_id>")
def api_update_product(product_id):
    """更新产品"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑产品"}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"success": False, "message": "产品不存在"}), 404

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    fee_types = data.get("fee_types") or []

    if not name:
        return jsonify({"success": False, "message": "产品名称不能为空", "field": "name"}), 400

    if not fee_types or len(fee_types) == 0:
        return jsonify({"success": False, "message": "请至少选择一种收费类别", "field": "fee_types"}), 400

    # 验证描述长度
    if description and len(description) > 100:
        return jsonify({"success": False, "message": "产品描述最多100字", "field": "description"}), 400

    product.name = name
    product.description = description
    product.fee_types = ",".join(fee_types)
    db.session.commit()

    return jsonify({"success": True})


@app.delete("/api/products/<int:product_id>")
def api_delete_product(product_id):
    """删除产品"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除产品"}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"success": False, "message": "产品不存在"}), 404

    db.session.delete(product)
    db.session.commit()

    return jsonify({"success": True})


# ==================== 客户管理 API ====================

@app.get("/api/customers")
def api_get_customers():
    """获取客户列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = Customer.query.order_by(Customer.id.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        customers = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        customers = query.all()
        pagination_data = None

    customers_data = []
    for customer in customers:
        customers_data.append({
            "id": customer.id,
            "full_name": customer.full_name,
            "short_name": customer.short_name,
            "customer_types": customer.customer_types.split(",") if customer.customer_types else [],
            "contact_person": customer.contact_person or "",
            "email": customer.email or "",
            "remark": customer.remark or "",
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
        })

    return jsonify({
        "success": True, 
        "customers": customers_data,
        "pagination": pagination_data
    })


@app.post("/api/customers")
def api_create_customer():
    """创建客户"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建客户"}), 403

    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    short_name = (data.get("short_name") or "").strip()
    customer_types = data.get("customer_types") or []
    contact_person = (data.get("contact_person") or "").strip()
    email = (data.get("email") or "").strip()
    remark = (data.get("remark") or "").strip()

    # 验证必填字段
    if not full_name:
        return jsonify({"success": False, "message": "客户全称不能为空", "field": "full_name"}), 400

    if not short_name:
        return jsonify({"success": False, "message": "客户简称不能为空", "field": "short_name"}), 400

    if not customer_types or len(customer_types) == 0:
        return jsonify({"success": False, "message": "请至少选择一种客户类别", "field": "customer_types"}), 400

    # 验证邮箱格式（如果填写了）
    if email:
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "message": "邮箱格式不正确", "field": "email"}), 400

    # 将数组转为逗号分隔的字符串
    customer_types_str = ",".join(customer_types)

    customer = Customer(
        full_name=full_name,
        short_name=short_name,
        customer_types=customer_types_str,
        contact_person=contact_person,
        email=email,
        remark=remark
    )
    db.session.add(customer)
    db.session.commit()

    return jsonify({"success": True, "id": customer.id})


@app.put("/api/customers/<int:customer_id>")
def api_update_customer(customer_id):
    """更新客户"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑客户"}), 403

    customer = Customer.query.get(customer_id)
    if not customer:
        return jsonify({"success": False, "message": "客户不存在"}), 404

    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    short_name = (data.get("short_name") or "").strip()
    customer_types = data.get("customer_types") or []
    contact_person = (data.get("contact_person") or "").strip()
    email = (data.get("email") or "").strip()
    remark = (data.get("remark") or "").strip()

    # 验证必填字段
    if not full_name:
        return jsonify({"success": False, "message": "客户全称不能为空", "field": "full_name"}), 400

    if not short_name:
        return jsonify({"success": False, "message": "客户简称不能为空", "field": "short_name"}), 400

    if not customer_types or len(customer_types) == 0:
        return jsonify({"success": False, "message": "请至少选择一种客户类别", "field": "customer_types"}), 400

    # 验证邮箱格式
    if email:
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "message": "邮箱格式不正确", "field": "email"}), 400

    customer.full_name = full_name
    customer.short_name = short_name
    customer.customer_types = ",".join(customer_types)
    customer.contact_person = contact_person
    customer.email = email
    customer.remark = remark
    db.session.commit()

    return jsonify({"success": True})


@app.delete("/api/customers/<int:customer_id>")
def api_delete_customer(customer_id):
    """删除客户"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除客户"}), 403

    customer = Customer.query.get(customer_id)
    if not customer:
        return jsonify({"success": False, "message": "客户不存在"}), 404

    db.session.delete(customer)
    db.session.commit()

    return jsonify({"success": True})


# ==================== 供应商管理 API ====================

@app.get("/api/suppliers")
def api_get_suppliers():
    """获取供应商列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = Supplier.query.order_by(Supplier.id.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        suppliers = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        suppliers = query.all()
        pagination_data = None

    suppliers_data = []
    for supplier in suppliers:
        suppliers_data.append({
            "id": supplier.id,
            "full_name": supplier.full_name,
            "short_name": supplier.short_name,
            "contact_person": supplier.contact_person or "",
            "email": supplier.email or "",
            "remark": supplier.remark or "",
            "created_at": supplier.created_at.isoformat() if supplier.created_at else None,
        })

    return jsonify({
        "success": True, 
        "suppliers": suppliers_data,
        "pagination": pagination_data
    })


@app.post("/api/suppliers")
def api_create_supplier():
    """创建供应商"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建供应商"}), 403

    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    short_name = (data.get("short_name") or "").strip()
    contact_person = (data.get("contact_person") or "").strip()
    email = (data.get("email") or "").strip()
    remark = (data.get("remark") or "").strip()

    # 验证必填字段
    if not full_name:
        return jsonify({"success": False, "message": "供应商全称不能为空", "field": "full_name"}), 400

    if not short_name:
        return jsonify({"success": False, "message": "供应商简称不能为空", "field": "short_name"}), 400

    # 验证邮箱格式（如果填写了）
    if email:
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "message": "邮箱格式不正确", "field": "email"}), 400

    supplier = Supplier(
        full_name=full_name,
        short_name=short_name,
        contact_person=contact_person,
        email=email,
        remark=remark
    )
    db.session.add(supplier)
    db.session.commit()

    return jsonify({"success": True, "id": supplier.id})


@app.put("/api/suppliers/<int:supplier_id>")
def api_update_supplier(supplier_id):
    """更新供应商"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑供应商"}), 403

    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify({"success": False, "message": "供应商不存在"}), 404

    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    short_name = (data.get("short_name") or "").strip()
    contact_person = (data.get("contact_person") or "").strip()
    email = (data.get("email") or "").strip()
    remark = (data.get("remark") or "").strip()

    # 验证必填字段
    if not full_name:
        return jsonify({"success": False, "message": "供应商全称不能为空", "field": "full_name"}), 400

    if not short_name:
        return jsonify({"success": False, "message": "供应商简称不能为空", "field": "short_name"}), 400

    # 验证邮箱格式
    if email:
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "message": "邮箱格式不正确", "field": "email"}), 400

    supplier.full_name = full_name
    supplier.short_name = short_name
    supplier.contact_person = contact_person
    supplier.email = email
    supplier.remark = remark
    db.session.commit()

    return jsonify({"success": True})


@app.delete("/api/suppliers/<int:supplier_id>")
def api_delete_supplier(supplier_id):
    """删除供应商"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除供应商"}), 403

    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify({"success": False, "message": "供应商不存在"}), 404

    db.session.delete(supplier)
    db.session.commit()

    return jsonify({"success": True})


# ==================== 客户报价管理 API ====================

@app.get("/api/customer-quotes")
def api_get_customer_quotes():
    """获取客户报价列表（支持搜索）"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    # 获取搜索参数
    customer_id = request.args.get("customer_id", type=int)
    quote_type = request.args.get("quote_type", "")
    valid_date = request.args.get("valid_date", "")  # YYYY-MM-DD
    status = request.args.get("status", "")  # 生效中/已失效
    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    # 构建查询
    query = CustomerQuote.query
    now = datetime.now()

    if customer_id:
        query = query.filter(CustomerQuote.customer_id == customer_id)
    
    if quote_type:
        query = query.filter(CustomerQuote.quote_type == quote_type)
    
    if valid_date:
        try:
            search_date = datetime.strptime(valid_date, "%Y-%m-%d")
            # 查找在该日期有效的报价
            query = query.filter(
                CustomerQuote.valid_from <= search_date,
                CustomerQuote.valid_to >= search_date
            )
        except:
            pass

    if status == "生效中":
        query = query.filter(CustomerQuote.valid_from <= now, CustomerQuote.valid_to >= now)
    elif status == "已失效":
        query = query.filter((CustomerQuote.valid_from > now) | (CustomerQuote.valid_to < now))

    # 按有效期起始时间降序排列（最近的在最上面）
    query = query.order_by(CustomerQuote.valid_from.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        quotes = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        quotes = query.all()
        pagination_data = None
    
    quotes_data = []
    now = datetime.now()
    for quote in quotes:
        is_effective = quote.valid_from <= now <= quote.valid_to
        quote_data = {
            "id": quote.id,
            "quote_name": quote.quote_name,
            "customer_id": quote.customer_id,
            "customer_name": quote.customer.full_name if quote.customer else "",
            "customer_short_name": quote.customer.short_name if quote.customer else "",
            "quote_type": quote.quote_type,
            "valid_from": quote.valid_from.isoformat() if quote.valid_from else None,
            "valid_to": quote.valid_to.isoformat() if quote.valid_to else None,
            "is_effective": is_effective,
            "status": "生效中" if is_effective else "已失效",
            "created_at": quote.created_at.isoformat() if quote.created_at else None,
        }
        
        # 根据类型添加报价明细
        if quote.quote_type == "单号报价":
            quote_data["unit_fee"] = float(quote.unit_fee) if quote.unit_fee else 0
        elif quote.quote_type == "头程报价":
            quote_data["air_freight"] = float(quote.air_freight) if quote.air_freight else 0
            quote_data["product_ids"] = [int(x) for x in quote.product_ids.split(",")] if quote.product_ids else []
            # 获取产品名称列表
            if quote.product_ids:
                p_ids = quote.product_ids.split(",")
                p_names = [p.name for p in Product.query.filter(Product.id.in_(p_ids)).all()]
                quote_data["product_names"] = ",".join(p_names)
            else:
                quote_data["product_names"] = ""
        elif quote.quote_type == "尾程报价":
            quote_data["express_fee"] = float(quote.express_fee) if quote.express_fee else 0
            quote_data["registration_fee"] = float(quote.registration_fee) if quote.registration_fee else 0
            quote_data["product_ids"] = [int(x) for x in quote.product_ids.split(",")] if quote.product_ids else []
            # 获取产品名称列表
            if quote.product_ids:
                p_ids = quote.product_ids.split(",")
                p_names = [p.name for p in Product.query.filter(Product.id.in_(p_ids)).all()]
                quote_data["product_names"] = ",".join(p_names)
            else:
                quote_data["product_names"] = ""
        elif quote.quote_type == "专线处理费":
            quote_data["dedicated_line_weight_fee"] = float(quote.dedicated_line_weight_fee) if quote.dedicated_line_weight_fee else 0
            quote_data["dedicated_line_piece_fee"] = float(quote.dedicated_line_piece_fee) if quote.dedicated_line_piece_fee else 0
            quote_data["product_ids"] = [int(x) for x in quote.product_ids.split(",")] if quote.product_ids else []
            # 获取产品名称列表
            if quote.product_ids:
                p_ids = quote.product_ids.split(",")
                p_names = [p.name for p in Product.query.filter(Product.id.in_(p_ids)).all()]
                quote_data["product_names"] = ",".join(p_names)
            else:
                quote_data["product_names"] = ""
        
        quotes_data.append(quote_data)

    return jsonify({
        "success": True, 
        "quotes": quotes_data,
        "pagination": pagination_data
    })


@app.post("/api/customer-quotes")
def api_create_customer_quote():
    """创建客户报价"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建报价"}), 403

    data = request.get_json() or {}
    quote_name = (data.get("quote_name") or "").strip()
    customer_id = data.get("customer_id")
    quote_type = data.get("quote_type", "")
    valid_from = data.get("valid_from", "")
    valid_to = data.get("valid_to", "")

    # 验证必填字段
    if not quote_name:
        return jsonify({"success": False, "message": "报价名称不能为空", "field": "quote_name"}), 400

    # 检查报价名称是否已存在
    existing = CustomerQuote.query.filter_by(quote_name=quote_name).first()
    if existing:
        return jsonify({"success": False, "message": "报价名称已存在，请使用其他名称", "field": "quote_name"}), 400

    if not customer_id:
        return jsonify({"success": False, "message": "请选择报价客户", "field": "customer_id"}), 400

    if not quote_type:
        return jsonify({"success": False, "message": "请选择报价类别", "field": "quote_type"}), 400

    if not valid_from or not valid_to:
        return jsonify({"success": False, "message": "请选择有效期", "field": "valid_from"}), 400

    # 验证客户类别与报价类别是否匹配
    customer = Customer.query.get(customer_id)
    if not customer:
        return jsonify({"success": False, "message": "客户不存在"}), 404

    customer_types = customer.customer_types.split(",") if customer.customer_types else []
    type_mapping = {
        "单号报价": "单号客户",
        "头程报价": "头程客户",
        "尾程报价": "尾程客户",
        "专线处理费": "差价客户"
    }
    
    required_customer_type = type_mapping.get(quote_type)
    if required_customer_type not in customer_types:
        return jsonify({
            "success": False, 
            "message": f"该客户不是{required_customer_type}，无法创建{quote_type}",
            "field": "quote_type"
        }), 400

    # 解析日期（直接使用本地时间，不进行时区转换）
    try:
        # 移除时区信息，直接使用提供的日期时间
        valid_from_str = valid_from.replace("Z", "").split("+")[0].split(".")[0]
        valid_to_str = valid_to.replace("Z", "").split("+")[0].split(".")[0]
        valid_from_dt = datetime.strptime(valid_from_str, "%Y-%m-%dT%H:%M:%S")
        valid_to_dt = datetime.strptime(valid_to_str, "%Y-%m-%dT%H:%M:%S")
    except:
        return jsonify({"success": False, "message": "日期格式错误"}), 400

    # 检查同一客户、同一类别、同一时期是否已有报价
    conflict_query = CustomerQuote.query.filter(
        CustomerQuote.customer_id == customer_id,
        CustomerQuote.quote_type == quote_type,
        db.or_(
            db.and_(
                CustomerQuote.valid_from <= valid_from_dt,
                CustomerQuote.valid_to >= valid_from_dt
            ),
            db.and_(
                CustomerQuote.valid_from <= valid_to_dt,
                CustomerQuote.valid_to >= valid_to_dt
            ),
            db.and_(
                CustomerQuote.valid_from >= valid_from_dt,
                CustomerQuote.valid_to <= valid_to_dt
            )
        )
    )
    
    product_ids_list = data.get("product_ids") or []
    product_ids_str = ",".join(map(str, sorted(product_ids_list))) if product_ids_list else None

    # 需要检查产品ID冲突的类型
    if quote_type in ["头程报价", "尾程报价", "专线处理费"]:
        if not product_ids_list:
            return jsonify({"success": False, "message": "请选择产品", "field": "product_ids"}), 400
        
        # 检查重叠
        potential_conflicts = conflict_query.all()
        for pc in potential_conflicts:
            if pc.product_ids:
                pc_list = pc.product_ids.split(",")
                overlap = set(map(str, product_ids_list)) & set(pc_list)
                if overlap:
                    # 将overlap中的ID转为整数列表
                    overlap_ids = [int(pid) for pid in overlap]
                    conflicting_product_names = [p.name for p in Product.query.filter(Product.id.in_(overlap_ids)).all()]
                    return jsonify({
                        "success": False, 
                        "message": f"该客户在此时期内已有包含产品({', '.join(conflicting_product_names)})的{quote_type}"
                    }), 400
    
    # 获取报价明细
    quote = CustomerQuote(
        quote_name=quote_name,
        customer_id=customer_id,
        quote_type=quote_type,
        product_ids=product_ids_str,
        valid_from=valid_from_dt,
        valid_to=valid_to_dt
    )

    # 根据类型设置报价明细
    if quote_type == "单号报价":
        unit_fee = data.get("unit_fee")
        if unit_fee is None or unit_fee == "":
            return jsonify({"success": False, "message": "请输入单号费", "field": "unit_fee"}), 400
        quote.unit_fee = unit_fee
    
    elif quote_type == "头程报价":
        air_freight = data.get("air_freight")
        if air_freight is None or air_freight == "":
            return jsonify({"success": False, "message": "请输入空运费", "field": "air_freight"}), 400
        quote.air_freight = air_freight
    
    elif quote_type == "尾程报价":
        express_fee = data.get("express_fee")
        registration_fee = data.get("registration_fee")
        if express_fee is None or express_fee == "":
            return jsonify({"success": False, "message": "请输入快递费", "field": "express_fee"}), 400
        if registration_fee is None or registration_fee == "":
            return jsonify({"success": False, "message": "请输入挂号费", "field": "registration_fee"}), 400
        quote.express_fee = express_fee
        quote.registration_fee = registration_fee

    elif quote_type == "专线处理费":
        w_fee = data.get("dedicated_line_weight_fee")
        p_fee = data.get("dedicated_line_piece_fee")
        
        # 验证：不可同时为0
        try:
            w_val = float(w_fee) if w_fee else 0
            p_val = float(p_fee) if p_fee else 0
            if w_val == 0 and p_val == 0:
                return jsonify({"success": False, "message": "专线处理费的重量收费和单件收费不能同时为0", "field": "dedicated_line_weight_fee"}), 400
        except ValueError:
            return jsonify({"success": False, "message": "费用格式错误"}), 400
            
        quote.dedicated_line_weight_fee = w_fee
        quote.dedicated_line_piece_fee = p_fee

    db.session.add(quote)
    db.session.commit()

    return jsonify({"success": True, "id": quote.id})


@app.put("/api/customer-quotes/<int:quote_id>")
def api_update_customer_quote(quote_id):
    """更新客户报价"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑报价"}), 403

    quote = CustomerQuote.query.get(quote_id)
    if not quote:
        return jsonify({"success": False, "message": "报价不存在"}), 404

    data = request.get_json() or {}
    quote_name = (data.get("quote_name") or "").strip()
    customer_id = data.get("customer_id")
    quote_type = data.get("quote_type", "")
    valid_from = data.get("valid_from", "")
    valid_to = data.get("valid_to", "")

    # 验证
    if not quote_name:
        return jsonify({"success": False, "message": "报价名称不能为空", "field": "quote_name"}), 400

    # 检查名称是否被其他报价使用
    existing = CustomerQuote.query.filter(
        CustomerQuote.quote_name == quote_name,
        CustomerQuote.id != quote_id
    ).first()
    if existing:
        return jsonify({"success": False, "message": "报价名称已存在", "field": "quote_name"}), 400

    if not customer_id:
        return jsonify({"success": False, "message": "请选择报价客户", "field": "customer_id"}), 400

    if not quote_type:
        return jsonify({"success": False, "message": "请选择报价类别", "field": "quote_type"}), 400

    # 验证客户类别
    customer = Customer.query.get(customer_id)
    if not customer:
        return jsonify({"success": False, "message": "客户不存在"}), 404

    customer_types = customer.customer_types.split(",") if customer.customer_types else []
    type_mapping = {
        "单号报价": "单号客户",
        "头程报价": "头程客户",
        "尾程报价": "尾程客户",
        "专线处理费": "差价客户"
    }
    
    required_customer_type = type_mapping.get(quote_type)
    if required_customer_type not in customer_types:
        return jsonify({
            "success": False,
            "message": f"该客户不是{required_customer_type}，无法创建{quote_type}",
            "field": "quote_type"
        }), 400

    # 解析日期（直接使用本地时间，不进行时区转换）
    try:
        # 移除时区信息，直接使用提供的日期时间
        valid_from_str = valid_from.replace("Z", "").split("+")[0].split(".")[0]
        valid_to_str = valid_to.replace("Z", "").split("+")[0].split(".")[0]
        valid_from_dt = datetime.strptime(valid_from_str, "%Y-%m-%dT%H:%M:%S")
        valid_to_dt = datetime.strptime(valid_to_str, "%Y-%m-%dT%H:%M:%S")
    except:
        return jsonify({"success": False, "message": "日期格式错误"}), 400

    # 检查时间冲突
    conflict_query = CustomerQuote.query.filter(
        CustomerQuote.customer_id == customer_id,
        CustomerQuote.quote_type == quote_type,
        CustomerQuote.id != quote_id,
        db.or_(
            db.and_(
                CustomerQuote.valid_from <= valid_from_dt,
                CustomerQuote.valid_to >= valid_from_dt
            ),
            db.and_(
                CustomerQuote.valid_from <= valid_to_dt,
                CustomerQuote.valid_to >= valid_to_dt
            ),
            db.and_(
                CustomerQuote.valid_from >= valid_from_dt,
                CustomerQuote.valid_to <= valid_to_dt
            )
        )
    )
    
    product_ids_list = data.get("product_ids") or []
    product_ids_str = ",".join(map(str, sorted(product_ids_list))) if product_ids_list else None

    # 需要检查产品ID冲突的类型
    if quote_type in ["头程报价", "尾程报价", "专线处理费"]:
        if not product_ids_list:
            return jsonify({"success": False, "message": "请选择产品", "field": "product_ids"}), 400
        
        # 检查重叠
        potential_conflicts = conflict_query.all()
        for pc in potential_conflicts:
            if pc.product_ids:
                pc_list = pc.product_ids.split(",")
                overlap = set(map(str, product_ids_list)) & set(pc_list)
                if overlap:
                    # 将overlap中的ID转为整数列表
                    overlap_ids = [int(pid) for pid in overlap]
                    conflicting_product_names = [p.name for p in Product.query.filter(Product.id.in_(overlap_ids)).all()]
                    return jsonify({
                        "success": False, 
                        "message": f"该客户在此时期内已有包含产品({', '.join(conflicting_product_names)})的{quote_type}"
                    }), 400

    # 更新基本信息
    quote.quote_name = quote_name
    quote.customer_id = customer_id
    quote.quote_type = quote_type
    quote.product_ids = product_ids_str
    quote.valid_from = valid_from_dt
    quote.valid_to = valid_to_dt

    # 清空所有报价明细
    quote.unit_fee = None
    quote.air_freight = None
    quote.express_fee = None
    quote.registration_fee = None
    quote.dedicated_line_weight_fee = None
    quote.dedicated_line_piece_fee = None

    # 根据类型设置报价明细
    if quote_type == "单号报价":
        unit_fee = data.get("unit_fee")
        if unit_fee is None or unit_fee == "":
            return jsonify({"success": False, "message": "请输入单号费", "field": "unit_fee"}), 400
        quote.unit_fee = unit_fee
    
    elif quote_type == "头程报价":
        air_freight = data.get("air_freight")
        if air_freight is None or air_freight == "":
            return jsonify({"success": False, "message": "请输入空运费", "field": "air_freight"}), 400
        quote.air_freight = air_freight
    
    elif quote_type == "尾程报价":
        express_fee = data.get("express_fee")
        registration_fee = data.get("registration_fee")
        if express_fee is None or express_fee == "":
            return jsonify({"success": False, "message": "请输入快递费", "field": "express_fee"}), 400
        if registration_fee is None or registration_fee == "":
            return jsonify({"success": False, "message": "请输入挂号费", "field": "registration_fee"}), 400
        quote.express_fee = express_fee
        quote.registration_fee = registration_fee

    elif quote_type == "专线处理费":
        w_fee = data.get("dedicated_line_weight_fee")
        p_fee = data.get("dedicated_line_piece_fee")
        
        # 验证：不可同时为0
        try:
            w_val = float(w_fee) if w_fee else 0
            p_val = float(p_fee) if p_fee else 0
            if w_val == 0 and p_val == 0:
                return jsonify({"success": False, "message": "专线处理费的重量收费和单件收费不能同时为0", "field": "dedicated_line_weight_fee"}), 400
        except ValueError:
            return jsonify({"success": False, "message": "费用格式错误"}), 400
            
        quote.dedicated_line_weight_fee = w_fee
        quote.dedicated_line_piece_fee = p_fee

    db.session.commit()
    return jsonify({"success": True})


@app.delete("/api/customer-quotes/<int:quote_id>")
def api_delete_customer_quote(quote_id):
    """删除客户报价"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除报价"}), 403

    quote = CustomerQuote.query.get(quote_id)
    if not quote:
        return jsonify({"success": False, "message": "报价不存在"}), 404

    db.session.delete(quote)
    db.session.commit()
    return jsonify({"success": True})


# ==================== 供应商报价管理 API ====================

@app.get("/api/supplier-quotes")
def api_get_supplier_quotes():
    """获取供应商报价列表（支持搜索）"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    # 获取搜索参数
    supplier_id = request.args.get("supplier_id", "")
    product_id = request.args.get("product_id", "")
    valid_date = request.args.get("valid_date", "")
    status = request.args.get("status", "")  # 生效中/已失效
    page = request.args.get("page", type=int)
    per_page = request.args.get("per_page", type=int, default=20)

    query = SupplierQuote.query
    now = datetime.now()

    if supplier_id:
        query = query.filter(SupplierQuote.supplier_id == supplier_id)
    
    if product_id:
        query = query.filter(SupplierQuote.product_id == product_id)
    
    if valid_date:
        try:
            search_date = datetime.strptime(valid_date, "%Y-%m-%d")
            query = query.filter(
                SupplierQuote.valid_from <= search_date,
                SupplierQuote.valid_to >= search_date
            )
        except:
            pass

    if status == "生效中":
        query = query.filter(SupplierQuote.valid_from <= now, SupplierQuote.valid_to >= now)
    elif status == "已失效":
        query = query.filter((SupplierQuote.valid_from > now) | (SupplierQuote.valid_to < now))

    # 按有效期起始时间降序排列
    query = query.order_by(SupplierQuote.valid_from.desc())

    if page:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        quotes = pagination.items
        pagination_data = {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    else:
        quotes = query.all()
        pagination_data = None
    
    quotes_data = []
    now = datetime.now()
    for quote in quotes:
        is_effective = quote.valid_from <= now <= quote.valid_to
        quotes_data.append({
            "id": quote.id,
            "quote_name": quote.quote_name,
            "supplier_id": quote.supplier_id,
            "supplier_name": quote.supplier.full_name if quote.supplier else "",
            "supplier_short_name": quote.supplier.short_name if quote.supplier else "",
            "product_id": quote.product_id,
            "product_name": quote.product.name if quote.product else "",
            "express_fee": float(quote.express_fee) if quote.express_fee else 0,
            "registration_fee": float(quote.registration_fee) if quote.registration_fee else 0,
            "min_weight": float(quote.min_weight) if quote.min_weight else 0,
            "price_tiers": json.loads(quote.price_tiers) if quote.price_tiers else [],
            "valid_from": quote.valid_from.isoformat() if quote.valid_from else None,
            "valid_to": quote.valid_to.isoformat() if quote.valid_to else None,
            "is_effective": is_effective,
            "status": "生效中" if is_effective else "已失效",
            "created_at": quote.created_at.isoformat() if quote.created_at else None,
        })

    return jsonify({
        "success": True, 
        "quotes": quotes_data,
        "pagination": pagination_data
    })


@app.post("/api/supplier-quotes")
def api_create_supplier_quote():
    """创建供应商报价"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限创建报价"}), 403

    data = request.get_json() or {}
    quote_name = (data.get("quote_name") or "").strip()
    supplier_id = data.get("supplier_id")
    product_id = data.get("product_id")
    min_weight = data.get("min_weight", 0)
    price_tiers = data.get("price_tiers", [])
    valid_from = data.get("valid_from", "")
    valid_to = data.get("valid_to", "")

    # 验证必填字段
    if not quote_name:
        return jsonify({"success": False, "message": "报价名称不能为空", "field": "quote_name"}), 400

    # 检查报价名称是否已存在
    existing = SupplierQuote.query.filter_by(quote_name=quote_name).first()
    if existing:
        return jsonify({"success": False, "message": "报价名称已存在，请使用其他名称", "field": "quote_name"}), 400

    if not supplier_id:
        return jsonify({"success": False, "message": "请选择供应商", "field": "supplier_id"}), 400

    if not product_id:
        return jsonify({"success": False, "message": "请选择产品", "field": "product_id"}), 400

    if not price_tiers or len(price_tiers) == 0:
        return jsonify({"success": False, "message": "请至少添加一个价格阶梯", "field": "price_tiers"}), 400

    if not valid_from or not valid_to:
        return jsonify({"success": False, "message": "请选择有效期", "field": "valid_from"}), 400

    # 解析日期
    try:
        valid_from_str = valid_from.replace("Z", "").split("+")[0].split(".")[0]
        valid_to_str = valid_to.replace("Z", "").split("+")[0].split(".")[0]
        valid_from_dt = datetime.strptime(valid_from_str, "%Y-%m-%dT%H:%M:%S")
        valid_to_dt = datetime.strptime(valid_to_str, "%Y-%m-%dT%H:%M:%S")
    except:
        return jsonify({"success": False, "message": "日期格式错误"}), 400

    # 检查同一供应商、同一产品、同一时期是否已有报价
    conflict = SupplierQuote.query.filter(
        SupplierQuote.supplier_id == supplier_id,
        SupplierQuote.product_id == product_id,
        db.or_(
            db.and_(
                SupplierQuote.valid_from <= valid_from_dt,
                SupplierQuote.valid_to >= valid_from_dt
            ),
            db.and_(
                SupplierQuote.valid_from <= valid_to_dt,
                SupplierQuote.valid_to >= valid_to_dt
            ),
            db.and_(
                SupplierQuote.valid_from >= valid_from_dt,
                SupplierQuote.valid_to <= valid_to_dt
            )
        )
    ).first()
    
    if conflict:
        return jsonify({
            "success": False,
            "message": "该供应商在此时期内已有相同产品的报价"
        }), 400

    # 创建报价
    quote = SupplierQuote(
        quote_name=quote_name,
        supplier_id=supplier_id,
        product_id=product_id,
        min_weight=min_weight,
        price_tiers=json.dumps(price_tiers),
        # 兼容旧字段，取第一个阶梯的值
        express_fee=price_tiers[0].get('express', 0) if price_tiers else 0,
        registration_fee=price_tiers[0].get('reg', 0) if price_tiers else 0,
        valid_from=valid_from_dt,
        valid_to=valid_to_dt
    )

    db.session.add(quote)
    db.session.commit()

    return jsonify({"success": True, "id": quote.id})


@app.put("/api/supplier-quotes/<int:quote_id>")
def api_update_supplier_quote(quote_id):
    """更新供应商报价"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限编辑报价"}), 403

    quote = SupplierQuote.query.get(quote_id)
    if not quote:
        return jsonify({"success": False, "message": "报价不存在"}), 404

    data = request.get_json() or {}
    quote_name = (data.get("quote_name") or "").strip()
    supplier_id = data.get("supplier_id")
    product_id = data.get("product_id")
    min_weight = data.get("min_weight", 0)
    price_tiers = data.get("price_tiers", [])
    valid_from = data.get("valid_from", "")
    valid_to = data.get("valid_to", "")

    # 验证
    if not quote_name:
        return jsonify({"success": False, "message": "报价名称不能为空", "field": "quote_name"}), 400

    # 检查名称是否被其他报价使用
    existing = SupplierQuote.query.filter(
        SupplierQuote.quote_name == quote_name,
        SupplierQuote.id != quote_id
    ).first()
    if existing:
        return jsonify({"success": False, "message": "报价名称已存在", "field": "quote_name"}), 400

    if not supplier_id:
        return jsonify({"success": False, "message": "请选择供应商", "field": "supplier_id"}), 400

    if not product_id:
        return jsonify({"success": False, "message": "请选择产品", "field": "product_id"}), 400

    if not price_tiers or len(price_tiers) == 0:
        return jsonify({"success": False, "message": "请至少添加一个价格阶梯", "field": "price_tiers"}), 400

    # 解析日期
    try:
        valid_from_str = valid_from.replace("Z", "").split("+")[0].split(".")[0]
        valid_to_str = valid_to.replace("Z", "").split("+")[0].split(".")[0]
        valid_from_dt = datetime.strptime(valid_from_str, "%Y-%m-%dT%H:%M:%S")
        valid_to_dt = datetime.strptime(valid_to_str, "%Y-%m-%dT%H:%M:%S")
    except:
        return jsonify({"success": False, "message": "日期格式错误"}), 400

    # 检查时间冲突
    conflict = SupplierQuote.query.filter(
        SupplierQuote.supplier_id == supplier_id,
        SupplierQuote.product_id == product_id,
        SupplierQuote.id != quote_id,
        db.or_(
            db.and_(
                SupplierQuote.valid_from <= valid_from_dt,
                SupplierQuote.valid_to >= valid_from_dt
            ),
            db.and_(
                SupplierQuote.valid_from <= valid_to_dt,
                SupplierQuote.valid_to >= valid_to_dt
            ),
            db.and_(
                SupplierQuote.valid_from >= valid_from_dt,
                SupplierQuote.valid_to <= valid_to_dt
            )
        )
    ).first()
    
    if conflict:
        return jsonify({
            "success": False,
            "message": "该供应商在此时期内已有相同产品的报价"
        }), 400

    # 更新
    quote.quote_name = quote_name
    quote.supplier_id = supplier_id
    quote.product_id = product_id
    quote.min_weight = min_weight
    quote.price_tiers = json.dumps(price_tiers)
    # 兼容旧字段
    quote.express_fee = price_tiers[0].get('express', 0) if price_tiers else 0
    quote.registration_fee = price_tiers[0].get('reg', 0) if price_tiers else 0
    quote.valid_from = valid_from_dt
    quote.valid_to = valid_to_dt

    db.session.commit()
    return jsonify({"success": True})


@app.delete("/api/supplier-quotes/<int:quote_id>")
def api_delete_supplier_quote(quote_id):
    """删除供应商报价"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除报价"}), 403

    quote = SupplierQuote.query.get(quote_id)
    if not quote:
        return jsonify({"success": False, "message": "报价不存在"}), 404

    db.session.delete(quote)
    db.session.commit()
    return jsonify({"success": True})


# ==================== 运单数据管理 API ====================

def apply_waybill_filters(query, data):
    """通用运单过滤逻辑，支持单号/转单号多行搜索"""
    customer_id = data.get("customer_id", "")
    supplier_id = data.get("supplier_id", "")
    product_id = data.get("product_id", "")
    order_time_start = data.get("order_time_start", "")
    order_time_end = data.get("order_time_end", "")
    order_nos_str = data.get("order_nos", "")
    transfer_nos_str = data.get("transfer_nos", "")

    # 客户搜索（四个客户字段中任意一个匹配）
    if customer_id:
        query = query.filter(
            db.or_(
                Waybill.unit_customer_id == customer_id,
                Waybill.first_leg_customer_id == customer_id,
                Waybill.last_leg_customer_id == customer_id,
                Waybill.differential_customer_id == customer_id
            )
        )
    
    if supplier_id:
        query = query.filter(Waybill.supplier_id == supplier_id)
    
    if product_id:
        query = query.filter(Waybill.product_id == product_id)
    
    # 下单时间范围搜索
    if order_time_start:
        try:
            start_dt = datetime.strptime(order_time_start, "%Y-%m-%d")
            query = query.filter(Waybill.order_time >= start_dt)
        except:
            pass
    
    if order_time_end:
        try:
            end_dt = datetime.strptime(order_time_end, "%Y-%m-%d")
            # 结束日期包含当天整天
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(Waybill.order_time <= end_dt)
        except:
            pass

    # 订单号搜索（支持多行输入）
    if order_nos_str:
        order_nos = [x.strip() for x in order_nos_str.split('\n') if x.strip()]
        if order_nos:
            # 分片处理 IN 查询，避免 SQL 语句过长
            chunk_size = 1000
            chunks = [order_nos[i:i + chunk_size] for i in range(0, len(order_nos), chunk_size)]
            query = query.filter(db.or_(*[Waybill.order_no.in_(chunk) for chunk in chunks]))
            
    # 转单号搜索（支持多行输入）
    if transfer_nos_str:
        transfer_nos = [x.strip() for x in transfer_nos_str.split('\n') if x.strip()]
        if transfer_nos:
            # 分片处理 IN 查询，避免 SQL 语句过长
            chunk_size = 1000
            chunks = [transfer_nos[i:i + chunk_size] for i in range(0, len(transfer_nos), chunk_size)]
            query = query.filter(db.or_(*[Waybill.transfer_no.in_(chunk) for chunk in chunks]))
            
    return query

@app.route("/api/waybills", methods=["GET", "POST"])
def api_get_waybills():
    """获取运单列表（支持搜索和分页）"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    # 获取参数（优先从 JSON POST 中获取）
    if request.method == "POST":
        data = request.get_json() or {}
    else:
        data = request.args
    
    # 分页参数
    page = int(data.get("page", 1))
    page_size = int(data.get("page_size", 200))

    # 检查是否有搜索过滤条件 (排除分页参数)
    filter_keys = ["customer_id", "supplier_id", "product_id", "order_time_start", "order_time_end", "order_nos", "transfer_nos"]
    has_filter = any([data.get(k) for k in filter_keys])
    
    query = apply_waybill_filters(Waybill.query, data)

    if not has_filter:
        # 如果没有任何过滤条件，默认限制在最近的5万条数据内，以保证大表下的性能
        # 先统计总数，最大显示为50000
        full_count = query.count()
        total = min(full_count, 50000)
        # 只取最近的5万条进行分页
        query = query.order_by(Waybill.order_time.desc()).limit(50000)
    else:
        # 有搜索条件时，统计搜索结果的全量总数
        total = query.count()
        query = query.order_by(Waybill.order_time.desc())

    # 分页执行 (如果上面已经 limit(50000)，这里的分页会在那5万条内进行)
    # 注意：SQLAlchemy 的 limit().limit() 会覆盖，所以我们需要 subquery
    if not has_filter and full_count > 50000:
        subq = query.subquery()
        # 从子查询中进行分页
        waybills = db.session.query(Waybill).select_entity_from(subq).limit(page_size).offset((page - 1) * page_size).all()
    else:
        waybills = query.limit(page_size).offset((page - 1) * page_size).all()
    
    waybills_data = []
    for waybill in waybills:
        waybills_data.append({
            "id": waybill.id,
            "order_no": waybill.order_no,
            "transfer_no": waybill.transfer_no or "",
            "weight": float(waybill.weight) if waybill.weight else 0,
            "order_time": waybill.order_time.isoformat() if waybill.order_time else None,
            "product_id": waybill.product_id,
            "product_name": waybill.product.name if waybill.product else "",
            
            # 客户信息
            "unit_customer_id": waybill.unit_customer_id,
            "unit_customer_name": waybill.unit_customer.short_name if waybill.unit_customer else "",
            "first_leg_customer_id": waybill.first_leg_customer_id,
            "first_leg_customer_name": waybill.first_leg_customer.short_name if waybill.first_leg_customer else "",
            "last_leg_customer_id": waybill.last_leg_customer_id,
            "last_leg_customer_name": waybill.last_leg_customer.short_name if waybill.last_leg_customer else "",
            "differential_customer_id": waybill.differential_customer_id,
            "differential_customer_name": waybill.differential_customer.short_name if waybill.differential_customer else "",
            
            "supplier_id": waybill.supplier_id,
            "supplier_name": waybill.supplier.short_name if waybill.supplier else "",
            
            # 费用信息
            "unit_fee": float(waybill.unit_fee) if waybill.unit_fee else 0,
            "first_leg_fee": float(waybill.first_leg_fee) if waybill.first_leg_fee else 0,
            "last_leg_fee": float(waybill.last_leg_fee) if waybill.last_leg_fee else 0,
            "differential_fee": float(waybill.differential_fee) if waybill.differential_fee else 0,
            "dedicated_line_fee": float(waybill.dedicated_line_fee) if waybill.dedicated_line_fee else 0,
            "supplier_cost": float(waybill.supplier_cost) if waybill.supplier_cost else 0,
            "other_fee": float(waybill.other_fee) if waybill.other_fee else 0,
            
            "remark": waybill.remark or "",
        })

    return jsonify({
        "success": True,
        "waybills": waybills_data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    })


@app.route("/api/waybills/recalculate", methods=["POST"])
def api_recalculate_waybills():
    """重算查询出来的运单费用"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限进行此操作"}), 403

    data = request.get_json() or {}
    
    # 1. 查找所有符合条件的运单
    query = Waybill.query
    query = apply_waybill_filters(query, data)
    
    waybills = query.all()
    if not waybills:
        return jsonify({"success": True, "message": "没有找到符合条件的运单", "count": 0})

    # 2. 预加载所有报价和基础数据并建立索引字典（大幅提升查询性能）
    products_map = {p.id: p for p in Product.query.all()}
    customer_quotes = CustomerQuote.query.all()
    customer_quotes_idx = {}
    for q in customer_quotes:
        key = (q.customer_id, q.quote_type)
        if key not in customer_quotes_idx:
            customer_quotes_idx[key] = []
        customer_quotes_idx[key].append(q)

    supplier_quotes = SupplierQuote.query.all()
    supplier_quotes_idx = {}
    for q in supplier_quotes:
        # 预解析阶梯报价 JSON
        if q.price_tiers and isinstance(q.price_tiers, str):
            try: q.parsed_tiers = json.loads(q.price_tiers)
            except: q.parsed_tiers = []
        else:
            q.parsed_tiers = []
            
        key = (q.supplier_id, q.product_id)
        if key not in supplier_quotes_idx:
            supplier_quotes_idx[key] = []
        supplier_quotes_idx[key].append(q)
    
    updated_count = 0
    errors = []
    
    try:
        # 3. 循环计算并更新
        for wb in waybills:
            fees, row_errors = calculate_waybill_fees(wb, products_map, customer_quotes_idx, supplier_quotes_idx)
            
            if row_errors:
                errors.append(f"单号 {wb.order_no}: {'; '.join(row_errors)}")
                continue # 如果计算出错，跳过该单更新，保持原有数据
            
            if fees:
                wb.unit_fee = fees["unit_fee"]
                wb.first_leg_fee = fees["first_leg_fee"]
                wb.last_leg_fee = fees["last_leg_fee"]
                wb.differential_fee = fees["differential_fee"]
                wb.dedicated_line_fee = fees["dedicated_line_fee"]
                wb.supplier_cost = fees["supplier_cost"]
                updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": f"重算完成。成功更新 {updated_count} 条运单。",
            "total_queried": len(waybills),
            "error_count": len(errors),
            "errors": errors[:100] # 只返回前100个错误，避免数据量过大
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"重算失败：{str(e)}"}), 500


@app.route("/api/waybills/export", methods=["GET", "POST"])
def api_export_waybills():
    """导出运单列表为 Excel"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    # 获取参数
    if request.method == "POST":
        data = request.get_json() or {}
    else:
        data = request.args
    
    query = Waybill.query
    query = apply_waybill_filters(query, data)

    # 按下单时间降序
    waybills = query.order_by(Waybill.order_time.desc()).all()

    # 构造数据
    data = []
    for idx, w in enumerate(waybills):
        data.append({
            "序号": idx + 1,
            "订单号": w.order_no,
            "转单号": w.transfer_no or "",
            "重量(kg)": float(w.weight) if w.weight else 0,
            "下单时间": w.order_time.strftime("%Y-%m-%d %H:%M:%S") if w.order_time else "",
            "产品": w.product.name if w.product else "",
            "单号客户": w.unit_customer.short_name if w.unit_customer else "",
            "头程客户": w.first_leg_customer.short_name if w.first_leg_customer else "",
            "尾程客户": w.last_leg_customer.short_name if w.last_leg_customer else "",
            "差价客户": w.differential_customer.short_name if w.differential_customer else "",
            "供应商": w.supplier.short_name if w.supplier else "",
            "单号收费": float(w.unit_fee) if w.unit_fee else 0,
            "头程收费": float(w.first_leg_fee) if w.first_leg_fee else 0,
            "尾程收费": float(w.last_leg_fee) if w.last_leg_fee else 0,
            "差价收费": float(w.differential_fee) if w.differential_fee else 0,
            "供应商成本": float(w.supplier_cost) if w.supplier_cost else 0,
            "专线处理费": float(w.dedicated_line_fee) if w.dedicated_line_fee else 0,
            "其他费用": float(w.other_fee) if w.other_fee else 0,
            "备注": w.remark or ""
        })

    # 生成 Excel
    df = pd.DataFrame(data)
    output = io.BytesIO()
    # 使用 openpyxl 引擎
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='运单数据')
        
        # 获取工作表以设置列宽
        workbook = writer.book
        worksheet = writer.sheets['运单数据']
        
        # 简单设置列宽
        for i, col in enumerate(df.columns):
            column_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.column_dimensions[chr(65 + i)].width = min(column_len, 50)

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='waybills_export.xlsx'
    )


@app.get("/api/waybills/download-template")
def api_download_waybill_template():
    """下载运单导入模板"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401
    
    # 创建 Excel 工作簿
    wb = Workbook()
    ws = wb.active
    ws.title = "运单数据"
    
    # 设置表头
    headers = ["订单号", "转单号", "重量(kg)", "下单时间", "产品", 
                "单号客户", "头程客户", "尾程客户", "差价客户", "供应商"]
    ws.append(headers)
    
    # 设置表头样式
    header_fill = PatternFill(start_color="E8F5F0", end_color="E8F5F0", fill_type="solid")
    header_font = Font(bold=True, size=11)
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
    
    # 设置列宽
    ws.column_dimensions['A'].width = 20  # 订单号
    ws.column_dimensions['B'].width = 20  # 转单号
    ws.column_dimensions['C'].width = 12  # 重量
    ws.column_dimensions['D'].width = 20  # 下单时间
    ws.column_dimensions['E'].width = 15  # 产品
    ws.column_dimensions['F'].width = 15  # 单号客户
    ws.column_dimensions['G'].width = 15  # 头程客户
    ws.column_dimensions['H'].width = 15  # 尾程客户
    ws.column_dimensions['I'].width = 15  # 差价客户
    ws.column_dimensions['J'].width = 15  # 供应商
    
    # 添加示例数据（第2行）
    example_data = [
        "ORD20260115001",  # 订单号
        "TRN001",  # 转单号
        "12.500",  # 重量
        "2026-1-5 12:15:00",  # 下单时间
        "示例产品",  # 产品
        "客户A简称",  # 单号客户
        "客户B简称",  # 头程客户
        "客户C简称",  # 尾程客户
        "",  # 差价客户
        "供应商简称"  # 供应商
    ]
    ws.append(example_data)
    
    # 保存到内存
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'运单导入模板_{datetime.now().strftime("%Y%m%d")}.xlsx'
    )


@app.post("/api/waybills/import")
def api_import_waybills():
    """导入运单数据"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401
    
    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限导入"}), 403
    
    # 检查是否有上传文件
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "请选择文件"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"success": False, "message": "请选择文件"}), 400
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({"success": False, "message": "请上传Excel文件（.xlsx或.xls）"}), 400
    
    try:
        # 保存上传文件
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"waybill_import_{timestamp}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # 准备模型字典
        models = {
            'Waybill': Waybill,
            'Product': Product,
            'Customer': Customer,
            'Supplier': Supplier,
            'CustomerQuote': CustomerQuote,
            'SupplierQuote': SupplierQuote
        }
        
        # 处理导入
        success, message, error_details = validate_and_process_waybill_import(
            file_path, db, models
        )
        
        # 删除上传的文件
        try:
            os.remove(file_path)
        except:
            pass
        
        if success:
            return jsonify({
                "success": True,
                "message": message
            })
        else:
            return jsonify({
                "success": False,
                "message": message,
                "errors": error_details
            }), 400
    
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"导入失败：{str(e)}"
        }), 500


@app.post("/api/waybills/batch-delete")
def api_batch_delete_waybills():
    """批量删除运单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401
    
    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除"}), 403
    
    try:
        data = request.get_json()
        ids = data.get("ids", [])
        
        if not ids:
            return jsonify({"success": False, "message": "请选择要删除的运单"}), 400
        
        # 查询要删除的运单
        waybills = Waybill.query.filter(Waybill.id.in_(ids)).all()
        
        if not waybills:
            return jsonify({"success": False, "message": "未找到要删除的运单"}), 404
        
        # 批量删除
        for waybill in waybills:
            db.session.delete(waybill)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"成功删除{len(waybills)}条运单"
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"删除失败：{str(e)}"
        }), 500


# ==================== 账单管理 API ====================

# ==================== 供应商账单管理 API ====================

@app.get("/api/supplier-invoices")
def api_get_supplier_invoices():
    """获取供应商账单列表"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    supplier_name = request.args.get("supplier_name", "")
    supplier_id = request.args.get("supplier_id")
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    page = request.args.get("page", type=int, default=1)
    per_page = request.args.get("per_page", type=int, default=20)

    query = SupplierInvoice.query.join(Supplier)

    if supplier_id:
        query = query.filter(SupplierInvoice.supplier_id == supplier_id)
    elif supplier_name:
        query = query.filter(Supplier.short_name.like(f"%{supplier_name}%"))
    if year:
        query = query.filter(SupplierInvoice.year == year)
    if month:
        query = query.filter(SupplierInvoice.month == month)

    pagination = query.order_by(SupplierInvoice.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    invoices_data = []
    for inv in pagination.items:
        invoices_data.append({
            "id": inv.id,
            "supplier_name": inv.supplier.full_name,
            "period": f"{inv.year}-{inv.month:02d}",
            "amount": float(inv.amount),
            "file_name": inv.file_name,
            "is_paid": inv.is_paid,
            "created_at": inv.created_at.isoformat()
        })

    return jsonify({
        "success": True,
        "invoices": invoices_data,
        "pagination": {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    })


@app.post("/api/supplier-invoices/generate")
def api_generate_supplier_invoices():
    """批量异步生成供应商账单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    data = request.get_json() or {}
    year = data.get("year")
    month = data.get("month")

    if not year or not month:
        return jsonify({"success": False, "message": "请选择年份和月份"}), 400

    # 提交异步任务
    task = async_generate_supplier_invoices.delay(year, month)
    
    # 记录任务
    new_task = TaskRecord(
        task_id=task.id,
        task_name=f"生成供应商账单({year}-{month})",
        status="PENDING"
    )
    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "success": True, 
        "message": "账单生成任务已提交，请稍后查看结果",
        "task_id": task.id
    })


@app.delete("/api/supplier-invoices/<int:invoice_id>")
def api_delete_supplier_invoice(invoice_id):
    """删除供应商账单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除账单"}), 403

    invoice = SupplierInvoice.query.get(invoice_id)
    if not invoice:
        return jsonify({"success": False, "message": "账单不存在"}), 404

    if invoice.file_name:
        file_path = os.path.join(app.config['SUPPLIER_INVOICE_FOLDER'], invoice.file_name)
        if os.path.exists(file_path):
            try: os.remove(file_path)
            except: pass

    db.session.delete(invoice)
    db.session.commit()
    return jsonify({"success": True})


@app.post("/api/supplier-invoices/<int:invoice_id>/recalculate")
def api_recalculate_supplier_invoice(invoice_id):
    """批量异步重新计算供应商账单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    invoice = SupplierInvoice.query.get(invoice_id)
    if not invoice:
        return jsonify({"success": False, "message": "账单不存在"}), 404

    # 提交异步任务
    task = async_generate_supplier_invoices.delay(invoice.year, invoice.month)
    
    # 记录任务
    new_task = TaskRecord(
        task_id=task.id,
        task_name=f"重算供应商账单({invoice.year}-{invoice.month})",
        status="PENDING"
    )
    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "success": True, 
        "message": "重算任务已提交，请稍后查看结果",
        "task_id": task.id
    })


@app.get("/api/supplier-invoices/<int:invoice_id>/download")
def api_download_supplier_invoice(invoice_id):
    """下载供应商账单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    invoice = SupplierInvoice.query.get(invoice_id)
    if not invoice or not invoice.file_name:
        return jsonify({"success": False, "message": "文件不存在"}), 404

    file_path = os.path.join(app.config['SUPPLIER_INVOICE_FOLDER'], invoice.file_name)
    if not os.path.exists(file_path):
        return jsonify({"success": False, "message": "服务器文件已丢失"}), 404

    return send_file(file_path, as_attachment=True, download_name=invoice.file_name)


@app.get("/api/invoices")
def api_get_invoices():
    """获取账单列表，支持搜索"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    customer_id = request.args.get("customer_id")
    fee_type = request.args.get("fee_type")
    year = request.args.get("year")
    month = request.args.get("month")
    
    # 分页参数
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = Invoice.query

    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if fee_type:
        query = query.filter(Invoice.fee_type == fee_type)
    if year:
        query = query.filter(Invoice.year == year)
    if month:
        query = query.filter(Invoice.month == month)

    # 排序：年份降序、月份降序、创建时间降序
    query = query.order_by(Invoice.year.desc(), Invoice.month.desc(), Invoice.created_at.desc())
    
    # 分页查询
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    invoices = pagination.items
    
    data = []
    for inv in invoices:
        data.append({
            "id": inv.id,
            "customer_id": inv.customer_id,
            "customer_name": inv.customer.full_name if inv.customer else "",
            "fee_type": inv.fee_type,
            "year": inv.year,
            "month": inv.month,
            "amount": float(inv.amount),
            "file_name": inv.file_name,
            "is_paid": inv.is_paid,
            "created_at": inv.created_at.isoformat()
        })

    return jsonify({
        "success": True, 
        "invoices": data,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    })


@app.post("/api/invoices/generate")
def api_generate_invoices():
    """批量异步生成应收账单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    data = request.get_json() or {}
    year = data.get("year")
    month = data.get("month")

    if not year or not month:
        return jsonify({"success": False, "message": "请选择年份和月份"}), 400

    # 提交异步任务
    task = async_generate_customer_invoices.delay(year, month)
    
    # 记录任务
    new_task = TaskRecord(
        task_id=task.id,
        task_name=f"生成应收账单({year}-{month})",
        status="PENDING"
    )
    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "success": True, 
        "message": "账单生成任务已提交，请稍后查看结果",
        "task_id": task.id
    })


@app.get("/api/tasks/status/<task_id>")
def api_get_task_status(task_id):
    """查询异步任务执行状态"""
    record = TaskRecord.query.filter_by(task_id=task_id).first()
    if not record:
        return jsonify({"success": False, "message": "任务记录不存在"}), 404
    
    return jsonify({
        "success": True,
        "task_id": record.task_id,
        "status": record.status,
        "result_msg": record.result_msg,
        "updated_at": record.updated_at.isoformat()
    })


@app.delete("/api/invoices/<int:invoice_id>")
def api_delete_invoice(invoice_id):
    """删除账单记录及文件"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除账单"}), 403

    invoice = Invoice.query.get(invoice_id)
    if not invoice:
        return jsonify({"success": False, "message": "账单不存在"}), 404

    # 删除物理文件
    if invoice.file_name:
        file_path = os.path.join(app.config['INVOICE_FOLDER'], invoice.file_name)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass

    db.session.delete(invoice)
    db.session.commit()
    return jsonify({"success": True})


@app.post("/api/invoices/<int:invoice_id>/recalculate")
def api_recalculate_invoice(invoice_id):
    """批量异步重新计算应收账单"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    invoice = Invoice.query.get(invoice_id)
    if not invoice:
        return jsonify({"success": False, "message": "账单不存在"}), 404

    # 提交异步任务
    task = async_generate_customer_invoices.delay(invoice.year, invoice.month)
    
    # 记录任务
    new_task = TaskRecord(
        task_id=task.id,
        task_name=f"重算应收账单({invoice.year}-{invoice.month})",
        status="PENDING"
    )
    db.session.add(new_task)
    db.session.commit()

    return jsonify({
        "success": True, 
        "message": "重算任务已提交，请稍后查看结果",
        "task_id": task.id
    })


@app.get("/api/invoices/<int:invoice_id>/download")
def api_download_invoice(invoice_id):
    """下载账单文件"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    invoice = Invoice.query.get(invoice_id)
    if not invoice or not invoice.file_name:
        return jsonify({"success": False, "message": "文件不存在"}), 404

    file_path = os.path.join(app.config['INVOICE_FOLDER'], invoice.file_name)
    if not os.path.exists(file_path):
        return jsonify({"success": False, "message": "服务器文件已丢失"}), 404

    return send_file(file_path, as_attachment=True, download_name=invoice.file_name)


# ==================== 收付款管理 API ====================

@app.get("/api/payments")
def api_get_payments():
    """获取收付款记录"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    target_type = request.args.get("target_type")
    target_id = request.args.get("target_id")
    payment_type = request.args.get("payment_type")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = Payment.query

    # 打印调试信息到控制台（如果能看到的话）
    print(f"DEBUG: Fetching payments with filters - type: {target_type}, id: {target_id}, ptype: {payment_type}, start: {start_date}, end: {end_date}")

    if target_type and target_type.strip():
        query = query.filter(Payment.target_type == target_type.strip())
    if target_id and str(target_id).strip() and str(target_id) != 'undefined' and str(target_id).strip() != '':
        query = query.filter(Payment.target_id == target_id)
    if payment_type:
        query = query.filter(Payment.payment_type == payment_type)
    if start_date and start_date.strip():
        try:
            query = query.filter(Payment.payment_date >= datetime.strptime(start_date, "%Y-%m-%d"))
        except: pass
    if end_date and end_date.strip():
        try:
            query = query.filter(Payment.payment_date <= datetime.strptime(end_date, "%Y-%m-%d"))
        except: pass

    pagination = query.order_by(Payment.payment_date.desc(), Payment.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    print(f"DEBUG: Found {pagination.total} total records, current page items: {len(pagination.items)}")
    
    payments_data = []
    for p in pagination.items:
        linked_invoice = ""
        try:
            if p.target_type == 'customer' and p.invoice_id:
                inv = Invoice.query.get(p.invoice_id)
                if inv and inv.customer:
                    linked_invoice = f"{inv.year}年{inv.month}月-{inv.customer.short_name}-{inv.fee_type}"
            elif p.target_type == 'supplier' and p.supplier_invoice_id:
                sinv = SupplierInvoice.query.get(p.supplier_invoice_id)
                if sinv and sinv.supplier:
                    linked_invoice = f"{sinv.year}年{sinv.month}月-{sinv.supplier.short_name}"
        except Exception as e:
            print(f"Error processing payment invoice link: {e}")
            linked_invoice = "数据关联错误"

        payments_data.append({
            "id": p.id,
            "target_type": p.target_type,
            "target_id": p.target_id,
            "target_name": p.target_name,
            "payment_type": p.payment_type.strip() if p.payment_type else "",
            "payment_date": p.payment_date.strftime("%Y-%m-%d"),
            "amount": float(p.amount),
            "receipt_path": p.receipt_path,
            "invoice_id": p.invoice_id,
            "supplier_invoice_id": p.supplier_invoice_id,
            "linked_invoice": linked_invoice,
            "remark": p.remark,
            "created_at": p.created_at.isoformat()
        })

    return jsonify({
        "success": True,
        "payments": payments_data,
        "pagination": {
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page
        }
    })

@app.post("/api/payments")
def api_create_payment():
    """新增收付款记录"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    data = request.get_json() or {}
    try:
        invoice_id = data.get("invoice_id")
        supplier_invoice_id = data.get("supplier_invoice_id")

        payment = Payment(
            target_type=data.get("target_type"),
            target_id=data.get("target_id"),
            payment_type=data.get("payment_type"),
            payment_date=datetime.strptime(data.get("payment_date"), "%Y-%m-%d"),
            amount=data.get("amount"),
            receipt_path=data.get("receipt_path"),
            invoice_id=invoice_id,
            supplier_invoice_id=supplier_invoice_id,
            remark=data.get("remark")
        )
        
        # 标记账单为已收/已付
        if invoice_id:
            inv = Invoice.query.get(invoice_id)
            if inv: inv.is_paid = True
        if supplier_invoice_id:
            sinv = SupplierInvoice.query.get(supplier_invoice_id)
            if sinv: sinv.is_paid = True

        db.session.add(payment)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.put("/api/payments/<int:payment_id>")
def api_update_payment(payment_id):
    """更新收付款记录"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    payment = Payment.query.get(payment_id)
    if not payment:
        return jsonify({"success": False, "message": "记录不存在"}), 404

    data = request.get_json() or {}
    try:
        # 处理旧账单状态恢复
        if payment.invoice_id:
            old_inv = Invoice.query.get(payment.invoice_id)
            if old_inv: old_inv.is_paid = False
        if payment.supplier_invoice_id:
            old_sinv = SupplierInvoice.query.get(payment.supplier_invoice_id)
            if old_sinv: old_sinv.is_paid = False

        payment.target_type = data.get("target_type")
        payment.target_id = data.get("target_id")
        payment.payment_type = data.get("payment_type")
        payment.payment_date = datetime.strptime(data.get("payment_date"), "%Y-%m-%d")
        payment.amount = data.get("amount")
        payment.receipt_path = data.get("receipt_path")
        payment.invoice_id = data.get("invoice_id")
        payment.supplier_invoice_id = data.get("supplier_invoice_id")
        payment.remark = data.get("remark")

        # 标记新账单状态
        if payment.invoice_id:
            new_inv = Invoice.query.get(payment.invoice_id)
            if new_inv: new_inv.is_paid = True
        if payment.supplier_invoice_id:
            new_sinv = SupplierInvoice.query.get(payment.supplier_invoice_id)
            if new_sinv: new_sinv.is_paid = True

        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.delete("/api/payments/<int:payment_id>")
def api_delete_payment(payment_id):
    """删除收付款记录"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if current_user.get("role") != "系统管理员":
        return jsonify({"success": False, "message": "无权限删除记录"}), 403

    payment = Payment.query.get(payment_id)
    if not payment:
        return jsonify({"success": False, "message": "记录不存在"}), 404

    try:
        # 恢复账单状态
        if payment.invoice_id:
            inv = Invoice.query.get(payment.invoice_id)
            if inv: inv.is_paid = False
        if payment.supplier_invoice_id:
            sinv = SupplierInvoice.query.get(payment.supplier_invoice_id)
            if sinv: sinv.is_paid = False

        # 同时也尝试删除水单文件
        if payment.receipt_path:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], os.path.basename(payment.receipt_path))
            if os.path.exists(file_path):
                try: os.remove(file_path)
                except: pass

        db.session.delete(payment)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.get("/api/unpaid-invoices")
def api_get_unpaid_invoices():
    """获取未核销的账单用于收付款绑定"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    target_type = request.args.get("target_type")
    target_id = request.args.get("target_id")
    
    invoices = []
    if target_type == 'customer':
        query = Invoice.query.filter_by(customer_id=target_id, is_paid=False)
        for inv in query.all():
            invoices.append({
                "id": inv.id,
                "label": f"{inv.year}年{inv.month}月-{inv.customer.short_name}-{inv.fee_type} (金额: {inv.amount})"
            })
    elif target_type == 'supplier':
        query = SupplierInvoice.query.filter_by(supplier_id=target_id, is_paid=False)
        for inv in query.all():
            invoices.append({
                "id": inv.id,
                "label": f"{inv.year}年{inv.month}月-{inv.supplier.short_name} (金额: {inv.amount})"
            })
            
    return jsonify({"success": True, "invoices": invoices})

@app.post("/api/payments/upload-receipt")
def api_upload_payment_receipt():
    """上传水单图片"""
    current_user = session.get("user")
    if not current_user:
        return jsonify({"success": False, "message": "未登录"}), 401

    if 'file' not in request.files:
        return jsonify({"success": False, "message": "没有文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "文件名为空"}), 400
    
    if file:
        filename = secure_filename(file.filename)
        # 增加时间戳防止同名文件冲突
        unique_filename = f"receipt_{int(datetime.now().timestamp())}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        return jsonify({"success": True, "url": f"/uploads/{unique_filename}"})
    
    return jsonify({"success": False, "message": "上传失败"}), 500


@app.route("/app")
def app_main():
    """主应用界面：左侧导航菜单 + 内容区域（角色管理等）"""
    user = session.get("user")
    if not user:
        return redirect(url_for("login"))
    return render_template("app.html", user=user)


@app.get("/api/dashboard/stats")
def api_dashboard_stats():
    """获取仪表盘统计数据"""
    start_date_str = request.args.get("start_date")  # 格式: YYYY-MM
    end_date_str = request.args.get("end_date")      # 格式: YYYY-MM
    customer_type = request.args.get("customer_type")  # 客户类型

    now = datetime.now()
    if not start_date_str:
        start_date_str = now.strftime("%Y-%m")
    if not end_date_str:
        end_date_str = now.strftime("%Y-%m")

    try:
        try:
            start_parts = start_date_str.split("-")
            end_parts = end_date_str.split("-")
            start_year, start_month = int(start_parts[0]), int(start_parts[1])
            end_year, end_month = int(end_parts[0]), int(end_parts[1])
        except (ValueError, IndexError):
            # 格式错误时回退到当前月
            now = datetime.now()
            start_year, start_month = now.year, now.month
            end_year, end_month = now.year, now.month
        
        start_dt = datetime(start_year, start_month, 1)
        if end_month == 12:
            end_dt = datetime(end_year + 1, 1, 1)
        else:
            end_dt = datetime(end_year, end_month + 1, 1)

        # 根据选择的客户类型，确定对应的字段
        id_field = Waybill.unit_customer_id
        if customer_type == "头程客户":
            id_field = Waybill.first_leg_customer_id
        elif customer_type == "尾程客户":
            id_field = Waybill.last_leg_customer_id
        elif customer_type == "差价客户":
            id_field = Waybill.differential_customer_id

        # 1. 单量数据统计 (日期范围) - 合并件数和重量查询以减少数据库交互
        vol_query = db.session.query(
            func.count(Waybill.id),
            func.sum(Waybill.weight)
        ).filter(
            Waybill.order_time >= start_dt,
            Waybill.order_time < end_dt
        ).filter(id_field != None)
        
        if customer_type:
            vol_query = vol_query.join(Customer, id_field == Customer.id).filter(
                Customer.customer_types.like(f"%{customer_type}%")
            )
            
        vol_res = vol_query.first()
        total_pieces = vol_res[0] or 0
        total_weight = vol_res[1] or 0
        
        # 产品分布 (饼图)
        product_stats_query = db.session.query(
            Product.name, func.count(Waybill.id)
        ).join(Waybill).filter(
            Waybill.order_time >= start_dt,
            Waybill.order_time < end_dt
        ).filter(id_field != None)
        
        if customer_type:
            product_stats_query = product_stats_query.join(Customer, id_field == Customer.id).filter(
                Customer.customer_types.like(f"%{customer_type}%")
            )
        product_stats = product_stats_query.group_by(Product.name).all()
        
        # 客户分布 (单量和重量)
        customer_stats_query = db.session.query(
            Customer.short_name, 
            func.count(Waybill.id).label('pieces'),
            func.sum(Waybill.weight).label('weight')
        ).join(Waybill, id_field == Customer.id).filter(
            Waybill.order_time >= start_dt,
            Waybill.order_time < end_dt
        )
        if customer_type:
            customer_stats_query = customer_stats_query.filter(
                Customer.customer_types.like(f"%{customer_type}%")
            )
        customer_stats = customer_stats_query.group_by(Customer.short_name).order_by(func.count(Waybill.id).desc()).all()

        # 2. 财务数据统计 (全局累计)
        total_receipts = db.session.query(func.sum(Payment.amount)).filter(Payment.payment_type == '收款').scalar() or 0
        total_payments = db.session.query(func.sum(Payment.amount)).filter(Payment.payment_type == '付款').scalar() or 0
        cash_balance = float(total_receipts) - float(total_payments)
        total_receivable = db.session.query(func.sum(Invoice.amount)).filter(Invoice.is_paid == False).scalar() or 0
        total_payable = db.session.query(func.sum(SupplierInvoice.amount)).filter(SupplierInvoice.is_paid == False).scalar() or 0

        return jsonify({
            "success": True,
            "volume": {
                "pieces": total_pieces,
                "weight": round(float(total_weight), 2),
                "product_distribution": [{"name": r[0], "value": r[1]} for r in product_stats],
                "customer_distribution": {
                    "names": [r[0] for r in customer_stats],
                    "pieces": [r[1] for r in customer_stats],
                    "weights": [round(float(r[2]), 2) if r[2] else 0 for r in customer_stats]
                }
            },
            "finance": {
                "cash_balance": round(float(cash_balance), 2),
                "receivable": round(float(total_receivable), 2),
                "payable": round(float(total_payable), 2)
            }
        })
    except Exception as e:
        print(f"Dashboard stats error: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.get("/api/dashboard/handling-fee")
def api_dashboard_handling_fee():
    """获取物流处理费统计（专线处理费）"""
    start_date_str = request.args.get("start_date")  # 格式: YYYY-MM
    end_date_str = request.args.get("end_date")      # 格式: YYYY-MM
    customer_id = request.args.get("customer_id")
    
    try:
        query = db.session.query(func.sum(Waybill.dedicated_line_fee)).filter(Waybill.differential_customer_id != None)
        
        # 时间过滤
        if start_date_str and start_date_str != "all":
            sy, sm = map(int, start_date_str.split("-"))
            start_dt = datetime(sy, sm, 1)
            query = query.filter(Waybill.order_time >= start_dt)
            
        if end_date_str and end_date_str != "all":
            ey, em = map(int, end_date_str.split("-"))
            if em == 12:
                end_dt = datetime(ey + 1, 1, 1)
            else:
                end_dt = datetime(ey, em + 1, 1)
            query = query.filter(Waybill.order_time < end_dt)
            
        # 客户过滤
        if customer_id and customer_id != "all":
            query = query.filter(Waybill.differential_customer_id == int(customer_id))
            
        total_fee = query.scalar() or 0
        return jsonify({"success": True, "total": round(float(total_fee), 2)})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.get("/api/dashboard/trend")
def api_dashboard_trend():
    """获取仪表盘趋势图数据"""
    # 同时支持 customer_ids[] 和 customer_ids
    customer_ids = request.args.getlist("customer_ids[]", type=int)
    if not customer_ids:
        customer_ids = request.args.getlist("customer_ids", type=int)
        
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    customer_type = request.args.get("customer_type")

    print(f"Trend Request: start={start_date_str}, end={end_date_str}, type={customer_type}, ids={customer_ids}")

    if not start_date_str or not end_date_str:
        return jsonify({"success": False, "message": "缺少日期范围"}), 400

    try:
        # 处理可能的无效日期字符串
        try:
            start_parts = start_date_str.split("-")
            end_parts = end_date_str.split("-")
            start_year, start_month = int(start_parts[0]), int(start_parts[1])
            end_year, end_month = int(end_parts[0]), int(end_parts[1])
        except (ValueError, IndexError):
            return jsonify({"success": False, "message": "日期格式不正确"}), 400

        start_dt = datetime(start_year, start_month, 1)
        if end_month == 12:
            end_dt = datetime(end_year + 1, 1, 1)
        else:
            end_dt = datetime(end_year, end_month + 1, 1)

        # 根据选择的客户类型，确定对应的字段
        id_field = Waybill.unit_customer_id
        if customer_type == "头程客户":
            id_field = Waybill.first_leg_customer_id
        elif customer_type == "尾程客户":
            id_field = Waybill.last_leg_customer_id
        elif customer_type == "差价客户":
            id_field = Waybill.differential_customer_id

        # 如果没有指定客户，获取该类别下趋势单量最多的一个
        if not customer_ids:
            # 这里的 join(Customer, id_field == Customer.id) 是关键，它排除了 NULL id_field
            top_customer = db.session.query(Customer.id).join(Waybill, id_field == Customer.id).filter(
                Waybill.order_time >= start_dt,
                Waybill.order_time < end_dt
            ).group_by(Customer.id).order_by(func.count(Waybill.id).desc()).first()
            
            if top_customer:
                customer_ids = [top_customer[0]]
                print(f"Auto-selected top customer: {customer_ids}")
            else:
                print("No top customer found for this range/type")
                # 生成日期序列即便没有数据也返回
                days = []
                curr = start_dt
                while curr < end_dt:
                    days.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
                return jsonify({"success": True, "series": [], "dates": days})

        # 获取涉及的客户名称
        customers = Customer.query.filter(Customer.id.in_(customer_ids)).all()
        customer_name_map = {c.id: c.short_name for c in customers}
        
        # 补全可能由于 type=int 转换失败导致的缺失名称（虽然理论上不会）
        for cid in customer_ids:
            if cid not in customer_name_map:
                c_obj = Customer.query.get(cid)
                if c_obj: customer_name_map[cid] = c_obj.short_name

        # 生成日期序列
        days = []
        curr = start_dt
        while curr < end_dt:
            days.append(curr.strftime("%Y-%m-%d"))
            curr += timedelta(days=1)

        # 批量查询数据
        trend_raw = db.session.query(
            id_field,
            func.date(Waybill.order_time).label('date'),
            func.count(Waybill.id)
        ).filter(
            id_field.in_(customer_ids),
            Waybill.order_time >= start_dt,
            Waybill.order_time < end_dt
        ).group_by(id_field, func.date(Waybill.order_time)).all()
        print(f"Trend Raw Results: {len(trend_raw)}")

        # 组织数据结构
        # { customer_id: { date_str: count } }
        data_map = {}
        for cid, dt, count in trend_raw:
            if cid is None: continue
            
            # 强制转为 int 避免类型不匹配问题
            try:
                cid_key = int(cid)
            except:
                cid_key = cid
                
            if cid_key not in data_map:
                data_map[cid_key] = {}
            
            # 处理日期格式
            if hasattr(dt, 'strftime'):
                d_str = dt.strftime("%Y-%m-%d")
            else:
                d_str = str(dt)[:10]
            data_map[cid_key][d_str] = count

        result_series = []
        for cid in customer_ids:
            try:
                cid_int = int(cid)
            except:
                cid_int = cid
                
            if cid_int not in customer_name_map:
                continue
                
            counts = [data_map.get(cid_int, {}).get(d, 0) for d in days]
            result_series.append({
                "name": customer_name_map[cid_int],
                "data": counts,
                "type": 'line',
                "smooth": True,
                "symbol": 'circle',
                "symbolSize": 6
            })

        return jsonify({
            "success": True,
            "dates": days,
            "series": result_series,
            "selected_customer_ids": [int(x) for x in customer_ids]
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


@app.get("/api/dashboard/unpaid-details")
def api_dashboard_unpaid_details():
    """获取未核销账单详情"""
    target_type = request.args.get("type")  # receivable or payable
    try:
        details = []
        if target_type == 'receivable':
            # 获取未付客户账单
            invoices = Invoice.query.filter_by(is_paid=False).order_by(Invoice.year.desc(), Invoice.month.desc()).all()
            for inv in invoices:
                details.append({
                    "id": inv.id,
                    "name": f"{inv.year}年{inv.month}月 - {inv.customer.short_name} - {inv.fee_type}",
                    "amount": float(inv.amount),
                    "period": f"{inv.year}年{inv.month}月"
                })
        elif target_type == 'payable':
            # 获取未付供应商账单
            invoices = SupplierInvoice.query.filter_by(is_paid=False).order_by(SupplierInvoice.year.desc(), SupplierInvoice.month.desc()).all()
            for inv in invoices:
                details.append({
                    "id": inv.id,
                    "name": f"{inv.year}年{inv.month}月 - {inv.supplier.short_name} 对账单",
                    "amount": float(inv.amount),
                    "period": f"{inv.year}年{inv.month}月"
                })
        
        return jsonify({"success": True, "details": details})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ==================== GitHub 自动部署 Webhook ====================
@app.post('/hooks/github')
def github_webhook():
    """处理 GitHub 的 Webhook 请求，自动部署代码更新"""
    # 验证请求来源
    signature = request.headers.get('X-Hub-Signature')
    if not signature:
        return jsonify({'success': False, 'message': 'Missing signature'}), 400
    
    # 获取密钥（建议从环境变量中读取）
    webhook_secret = os.environ.get('GITHUB_WEBHOOK_SECRET', 'your-webhook-secret-here')
    
    # 验证签名
    payload_body = request.data
    mac = hmac.new(
        webhook_secret.encode('utf-8'),
        msg=payload_body,
        digestmod=hashlib.sha1
    )
    expected_signature = 'sha1=' + mac.hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({'success': False, 'message': 'Invalid signature'}), 401
    
    # 解析请求体
    payload = request.json
    
    # 检查是否是 push 事件且推送到主分支
    if request.headers.get('X-GitHub-Event') == 'push':
        ref = payload.get('ref')
        if ref in ['refs/heads/main', 'refs/heads/master']:  # 支持常见的主分支名称
            try:
                # 执行 git pull 拉取最新代码
                result = subprocess.run(['git', 'pull'], cwd=os.getcwd(), capture_output=True, text=True)
                if result.returncode != 0:
                    return jsonify({'success': False, 'message': f'Git pull failed: {result.stderr}'})
                
                # 重新安装依赖（如果有变动）
                pip_result = subprocess.run(['pip', 'install', '-r', 'requirements.txt'], 
                                           cwd=os.getcwd(), capture_output=True, text=True)
                
                return jsonify({
                    'success': True, 
                    'message': 'Code updated successfully',
                    'git_output': result.stdout,
                    'pip_output': pip_result.stdout if 'pip_result' in locals() else ''
                })
            except Exception as e:
                return jsonify({'success': False, 'message': f'Deployment failed: {str(e)}'})
    
    return jsonify({'success': True, 'message': 'Event received but not processed'})


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
