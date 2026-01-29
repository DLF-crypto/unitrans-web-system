const TrackingInterfaceManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">轨迹接口管理</h2>
                <button class="btn btn-primary" @click="openCreateModal">
                    + 新增接口
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>接口名称</th>
                            <th>请求地址</th>
                            <th>获取频率(小时)</th>
                            <th>创建时间</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="6" style="text-align: center; padding: 40px;">加载中...</td>
                        </tr>
                        <tr v-else-if="interfaces.length === 0">
                            <td colspan="6" style="text-align: center; padding: 40px; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-else v-for="(item, index) in interfaces" :key="item.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ item.interface_name }}</td>
                            <td style="word-break: break-all;">{{ item.request_url }}</td>
                            <td>{{ item.fetch_interval }}</td>
                            <td>{{ formatDateTime(item.created_at) }}</td>
                            <td>
                                <button class="btn-link" @click="openEditModal(item)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteInterface(item)">删除</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页控件 -->
            <div class="pagination-container" v-if="pagination.total > 0">
                <div class="pagination-info">
                    共 {{ pagination.total }} 条记录，每页
                    <select v-model="pagination.perPage" @change="handlePageSizeChange" class="page-size-select">
                        <option :value="10">10</option>
                        <option :value="20">20</option>
                        <option :value="50">50</option>
                        <option :value="100">100</option>
                    </select>
                    条
                </div>
                <div class="pagination-buttons">
                    <button class="btn-page" :disabled="pagination.currentPage === 1" @click="changePage(1)">首页</button>
                    <button class="btn-page" :disabled="pagination.currentPage === 1" @click="changePage(pagination.currentPage - 1)">上一页</button>
                    <span class="page-current">{{ pagination.currentPage }} / {{ pagination.pages }}</span>
                    <button class="btn-page" :disabled="pagination.currentPage === pagination.pages" @click="changePage(pagination.currentPage + 1)">下一页</button>
                    <button class="btn-page" :disabled="pagination.currentPage === pagination.pages" @click="changePage(pagination.pages)">末页</button>
                </div>
            </div>

            <!-- 创建/编辑模态框 -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑接口' : '新增接口' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitForm" class="modal-body" style="max-height: 600px; overflow-y: auto;">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>接口名称 <span style="color: #e57373;">*</span></label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.interface_name" 
                                placeholder="请输入接口名称"
                                maxlength="128"
                            />
                            <div v-if="errors.interface_name" class="error-text">{{ errors.interface_name }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>请求地址 <span style="color: #e57373;">*</span></label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.request_url" 
                                placeholder="请输入请求地址，如 https://api.example.com/tracking"
                                maxlength="512"
                            />
                            <div v-if="errors.request_url" class="error-text">{{ errors.request_url }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>验证信息</label>
                            <small style="color: #666;">格式：{"api_id":"123456","key":"xxxx"}，多个参数用逗号分隔</small>
                            <textarea 
                                class="form-input" 
                                v-model="form.auth_params" 
                                placeholder='{"api_id":"123456","key":"xxxx"}'
                                rows="3"
                                style="resize: vertical; font-family: monospace;"
                            ></textarea>
                            <div v-if="errors.auth_params" class="error-text">{{ errors.auth_params }}</div>
                        </div>

                        <!-- 关键信息代码参数 -->
                        <div class="form-field" style="margin-bottom: 16px; border: 1px solid #e0e0e0; padding: 15px; border-radius: 4px; background: #fafafa;">
                            <label style="font-weight: 600; margin-bottom: 10px; display: block;">关键信息代码参数</label>
                            <small style="color: #666; display: block; margin-bottom: 10px;">填写供应商报文中对应字段的key值，用于系统自动解析</small>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="font-size: 12px; color: #666;">供应商节点时间字段名</label>
                                    <input type="text" class="form-input" v-model="keyParams.time_key" placeholder="如：changeDate" style="margin-top: 4px;" />
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: #666;">供应商状态字段名</label>
                                    <input type="text" class="form-input" v-model="keyParams.status_key" placeholder="如：status" style="margin-top: 4px;" />
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: #666;">供应商轨迹描述字段名</label>
                                    <input type="text" class="form-input" v-model="keyParams.description_key" placeholder="如：record" style="margin-top: 4px;" />
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: #666;">供应商城市字段名</label>
                                    <input type="text" class="form-input" v-model="keyParams.city_key" placeholder="如：city" style="margin-top: 4px;" />
                                </div>
                                <div>
                                    <label style="font-size: 12px; color: #666;">供应商国家字段名</label>
                                    <input type="text" class="form-input" v-model="keyParams.country_key" placeholder="如：country" style="margin-top: 4px;" />
                                </div>
                            </div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>头程状态映射表</label>
                            <small style="color: #666;">点击下方添加映射关系</small>
                            <div style="margin-top: 10px;">
                                <table style="width: 100%; border-collapse: collapse; border: 1px solid var(--border-color);">
                                    <thead>
                                        <tr style="background: #f5f5f5;">
                                            <th style="padding: 10px; border: 1px solid var(--border-color); font-size: 13px; font-weight: 500; text-align: left; width: 25%;">供应商状态</th>
                                            <th style="padding: 10px; border: 1px solid var(--border-color); font-size: 13px; font-weight: 500; text-align: left; width: 30%;">供应商轨迹描述</th>
                                            <th style="padding: 10px; border: 1px solid var(--border-color); font-size: 13px; font-weight: 500; text-align: left; width: 30%;">系统状态代码</th>
                                            <th style="padding: 10px; border: 1px solid var(--border-color); font-size: 13px; font-weight: 500; text-align: center; width: 15%;">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(mapping, index) in statusMappings" :key="index">
                                            <td style="padding: 8px; border: 1px solid var(--border-color);">
                                                <input 
                                                    type="text" 
                                                    class="form-input" 
                                                    v-model="mapping.supplier_status"
                                                    placeholder="供应商状态"
                                                    style="width: 100%; min-width: 0;"
                                                />
                                            </td>
                                            <td style="padding: 8px; border: 1px solid var(--border-color);">
                                                <input 
                                                    type="text" 
                                                    class="form-input" 
                                                    v-model="mapping.supplier_description"
                                                    placeholder="非必填"
                                                    style="width: 100%; min-width: 0;"
                                                    title="非必填。如填写，系统会优先匹配轨迹描述，不匹配再使用状态码"
                                                />
                                            </td>
                                            <td style="padding: 8px; border: 1px solid var(--border-color);">
                                                <select class="form-input" v-model="mapping.system_status_code" style="width: 100%; min-width: 0;">
                                                    <option value="">请选择</option>
                                                    <option v-for="node in trackingNodes" :key="node.id" :value="node.status_code">
                                                        {{ node.status_code }} - {{ node.status_description }}
                                                    </option>
                                                </select>
                                            </td>
                                            <td style="padding: 8px; border: 1px solid var(--border-color); text-align: center;">
                                                <button type="button" class="btn-link btn-danger" @click="removeMapping(index)">删除</button>
                                            </td>
                                        </tr>
                                        <tr v-if="statusMappings.length === 0">
                                            <td colspan="4" style="text-align: center; color: #999; padding: 20px; border: 1px solid var(--border-color);">暂无映射</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <button type="button" class="btn btn-secondary" @click="addMapping" style="margin-top: 10px;">
                                    + 添加映射
                                </button>
                            </div>
                            <div v-if="errors.status_mapping" class="error-text">{{ errors.status_mapping }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>获取频率(小时) <span style="color: #e57373;">*</span></label>
                            <small style="color: #666;">可输入小数，如1.2表示1小时12分钟</small>
                            <input 
                                type="number" 
                                class="form-input" 
                                v-model.number="form.fetch_interval" 
                                placeholder="请输入获取频率"
                                step="0.1"
                                min="0.1"
                            />
                            <div v-if="errors.fetch_interval" class="error-text">{{ errors.fetch_interval }}</div>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
                            <button type="submit" class="btn btn-primary" :disabled="submitting">
                                <span v-if="!submitting">确认{{ isEdit ? '保存' : '新增' }}</span>
                                <span v-else>提交中...</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            interfaces: [],
            trackingNodes: [],
            loading: false,
            showModal: false,
            isEdit: false,
            submitting: false,
            form: {
                interface_name: '',
                request_url: '',
                auth_params: '',
                fetch_interval: ''
            },
            keyParams: {
                status_key: '',
                description_key: '',
                city_key: '',
                country_key: ''
            },
            statusMappings: [],
            errors: {},
            pagination: {
                currentPage: 1,
                perPage: 20,
                total: 0,
                pages: 0
            }
        };
    },
    mounted() {
        this.loadInterfaces();
        this.loadTrackingNodes();
    },
    methods: {
        async loadInterfaces() {
            this.loading = true;
            try {
                const resp = await fetch(`/api/tracking-interfaces?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await resp.json();
                if (data.success) {
                    this.interfaces = data.interfaces;
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                } else {
                    alert(data.message || '加载失败');
                }
            } catch (error) {
                console.error('加载失败:', error);
                alert('加载失败，请稍后重试');
            } finally {
                this.loading = false;
            }
        },
        async loadTrackingNodes() {
            try {
                const resp = await fetch('/api/tracking-nodes?per_page=1000');
                const data = await resp.json();
                if (data.success) {
                    this.trackingNodes = data.nodes;
                }
            } catch (error) {
                console.error('加载轨迹节点失败:', error);
            }
        },
        openCreateModal() {
            this.isEdit = false;
            this.form = {
                interface_name: '',
                request_url: '',
                auth_params: '',
                fetch_interval: ''
            };
            this.keyParams = {
                time_key: '',
                status_key: '',
                description_key: '',
                city_key: '',
                country_key: ''
            };
            this.statusMappings = [];
            this.errors = {};
            this.showModal = true;
        },
        openEditModal(item) {
            this.isEdit = true;
            this.form = {
                id: item.id,
                interface_name: item.interface_name,
                request_url: item.request_url,
                auth_params: item.auth_params || '',
                fetch_interval: item.fetch_interval
            };
            
            // 解析关键参数
            try {
                this.keyParams = item.response_key_params ? JSON.parse(item.response_key_params) : {
                    time_key: '',
                    status_key: '',
                    description_key: '',
                    city_key: '',
                    country_key: ''
                };
            } catch (e) {
                this.keyParams = {
                    time_key: '',
                    status_key: '',
                    description_key: '',
                    city_key: '',
                    country_key: ''
                };
            }
            
            // 解析状态映射
            try {
                this.statusMappings = item.status_mapping ? JSON.parse(item.status_mapping) : [];
                // 确保每个映射都有supplier_description字段
                this.statusMappings = this.statusMappings.map(m => ({
                    supplier_status: m.supplier_status || '',
                    supplier_description: m.supplier_description || '',
                    system_status_code: m.system_status_code || ''
                }));
            } catch (e) {
                this.statusMappings = [];
            }
            
            this.errors = {};
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.errors = {};
        },
        addMapping() {
            this.statusMappings.push({
                supplier_status: '',
                supplier_description: '',
                system_status_code: ''
            });
        },
        removeMapping(index) {
            this.statusMappings.splice(index, 1);
        },
        validateForm() {
            this.errors = {};
            let valid = true;

            if (!this.form.interface_name) {
                this.errors.interface_name = '接口名称不能为空';
                valid = false;
            }

            if (!this.form.request_url) {
                this.errors.request_url = '请求地址不能为空';
                valid = false;
            }

            if (!this.form.fetch_interval) {
                this.errors.fetch_interval = '获取频率不能为空';
                valid = false;
            } else if (this.form.fetch_interval <= 0) {
                this.errors.fetch_interval = '获取频率必须大于0';
                valid = false;
            }

            // 验证auth_params JSON格式
            if (this.form.auth_params) {
                try {
                    JSON.parse(this.form.auth_params);
                } catch (e) {
                    this.errors.auth_params = 'JSON格式错误';
                    valid = false;
                }
            }

            return valid;
        },
        async submitForm() {
            if (!this.validateForm()) {
                return;
            }

            // 构建提交数据
            const submitData = {
                interface_name: this.form.interface_name,
                request_url: this.form.request_url,
                auth_params: this.form.auth_params,
                status_mapping: JSON.stringify(this.statusMappings),
                response_key_params: JSON.stringify(this.keyParams),
                fetch_interval: this.form.fetch_interval
            };

            this.submitting = true;
            try {
                const url = this.isEdit ? `/api/tracking-interfaces/${this.form.id}` : '/api/tracking-interfaces';
                const method = this.isEdit ? 'PUT' : 'POST';
                
                const resp = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData)
                });
                
                const data = await resp.json();
                if (data.success) {
                    alert(this.isEdit ? '修改成功' : '创建成功');
                    this.closeModal();
                    this.loadInterfaces();
                } else {
                    if (data.field && data.message) {
                        this.errors[data.field] = data.message;
                    } else {
                        alert(data.message || '操作失败');
                    }
                }
            } catch (error) {
                console.error('提交失败:', error);
                alert('操作失败，请稍后重试');
            } finally {
                this.submitting = false;
            }
        },
        async deleteInterface(item) {
            if (!confirm(`确定要删除接口"${item.interface_name}"吗？`)) {
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-interfaces/${item.id}`, {
                    method: 'DELETE'
                });
                const data = await resp.json();
                if (data.success) {
                    alert('删除成功');
                    this.loadInterfaces();
                } else {
                    alert(data.message || '删除失败');
                }
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败，请稍后重试');
            }
        },
        changePage(page) {
            if (page < 1 || page > this.pagination.pages) return;
            this.pagination.currentPage = page;
            this.loadInterfaces();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadInterfaces();
        },
        formatDateTime(dateTimeStr) {
            if (!dateTimeStr) return '';
            const dt = new Date(dateTimeStr);
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            const hour = String(dt.getHours()).padStart(2, '0');
            const minute = String(dt.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hour}:${minute}`;
        }
    }
};
