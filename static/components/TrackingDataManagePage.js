const TrackingDataManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">轨迹数据管理</h2>
            </div>

            <!-- 搜索区域 -->
            <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px; position: relative;">
                        <label>客户（通过简称搜索）</label>
                        <input 
                            type="text" 
                            class="form-input" 
                            v-model="searchForm.customer_search"
                            @input="filterCustomers"
                            @focus="showCustomerDropdown = true; filterCustomers()"
                            @dblclick="showAllCustomers"
                            @blur="hideCustomerDropdown"
                            placeholder="双击显示所有客户或输入简称搜索"
                        />
                        <div v-if="showCustomerDropdown && filteredCustomerList.length > 0" 
                             style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div v-for="customer in filteredCustomerList" 
                                 :key="customer.id"
                                 @mousedown="selectCustomer(customer)"
                                 style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;"
                                 :style="{ background: searchForm.customer_id === customer.id ? '#f0f9ff' : 'white' }"
                                 @mouseenter="$event.target.style.background='#f0f9ff'"
                                 @mouseleave="$event.target.style.background=(searchForm.customer_id === customer.id ? '#f0f9ff' : 'white')">
                                <div style="font-weight: 500;">{{ customer.short_name }}</div>
                                <div style="font-size: 12px; color: #666; margin-top: 2px;">{{ customer.full_name }}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px; position: relative;">
                        <label>供应商（通过简称搜索）</label>
                        <input 
                            type="text" 
                            class="form-input" 
                            v-model="searchForm.supplier_search"
                            @input="filterSuppliers"
                            @focus="showSupplierDropdown = true; filterSuppliers()"
                            @dblclick="showAllSuppliers"
                            @blur="hideSupplierDropdown"
                            placeholder="双击显示所有供应商或输入简称搜索"
                        />
                        <div v-if="showSupplierDropdown && filteredSupplierList.length > 0" 
                             style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div v-for="supplier in filteredSupplierList" 
                                 :key="supplier.id"
                                 @mousedown="selectSupplier(supplier)"
                                 style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;"
                                 :style="{ background: searchForm.supplier_id === supplier.id ? '#f0f9ff' : 'white' }"
                                 @mouseenter="$event.target.style.background='#f0f9ff'"
                                 @mouseleave="$event.target.style.background=(searchForm.supplier_id === supplier.id ? '#f0f9ff' : 'white')">
                                <div style="font-weight: 500;">{{ supplier.short_name }}</div>
                                <div style="font-size: 12px; color: #666; margin-top: 2px;">{{ supplier.full_name }}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 200px;">
                        <label>接口名称</label>
                        <select class="form-input" v-model="searchForm.interface_name">
                            <option value="">全部接口</option>
                            <option v-for="interfaceName in trackingInterfaces" :key="interfaceName" :value="interfaceName">{{ interfaceName }}</option>
                        </select>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>是否自动跟踪</label>
                        <select class="form-input" v-model="searchForm.stop_tracking">
                            <option value="">全部</option>
                            <option value="false">是</option>
                            <option value="true">否</option>
                        </select>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>下单时间起始</label>
                        <input type="date" class="form-input" v-model="searchForm.order_time_start" />
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>下单时间结束</label>
                        <input type="date" class="form-input" v-model="searchForm.order_time_end" />
                    </div>
                    
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" @click="resetSearch">重置</button>
                        <button class="btn btn-primary" @click="searchTracking">搜索</button>
                    </div>
                </div>
                
                <!-- 多单号搜索区域 -->
                <div style="display: flex; gap: 12px; margin-top: 12px; width: 100%;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 300px; max-width: 400px;">
                        <label>订单号搜索 (双击输入框可展开/收起多行输入)</label>
                        <textarea 
                            class="form-input" 
                            v-model="searchForm.order_nos"
                            :rows="isOrderNosExpanded ? 10 : 1"
                            @dblclick="isOrderNosExpanded = !isOrderNosExpanded"
                            placeholder="输入订单号，多个请换行（支持多达9.9万单查询）"
                            style="resize: vertical; min-height: 38px; font-family: inherit;"
                        ></textarea>
                    </div>
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 300px; max-width: 400px;">
                        <label>转单号搜索 (双击输入框可展开/收起多行输入)</label>
                        <textarea 
                            class="form-input" 
                            v-model="searchForm.transfer_nos"
                            :rows="isTransferNosExpanded ? 10 : 1"
                            @dblclick="isTransferNosExpanded = !isTransferNosExpanded"
                            placeholder="输入转单号，多个请换行（支持多达9.9万单查询）"
                            style="resize: vertical; min-height: 38px; font-family: inherit;"
                        ></textarea>
                    </div>
                </div>
            </div>

            <!-- 功能区 -->
            <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
                <button class="btn btn-primary" @click="fetchTracking" :disabled="selectedWaybillIds.length === 0">
                    获取转单轨迹
                </button>
                <button class="btn btn-primary" @click="fetchLastmileTracking" :disabled="selectedWaybillIds.length === 0">
                    获取尾程单轨迹
                </button>
                <button class="btn btn-warning" @click="showImportLastmileDialog" style="background-color: #ff9800; border-color: #ff9800;">
                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        导入尾程单号
                    </span>
                </button>
                <button class="btn btn-primary" @click="pushTracking" :disabled="selectedTrackingIds.length === 0">
                    推送轨迹
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">
                                <input 
                                    type="checkbox" 
                                    @change="toggleAll" 
                                    :checked="allSelected"
                                />
                            </th>
                            <th>ID</th>
                            <th>订单号</th>
                            <th>转单号</th>
                            <th>尾程单号</th>
                            <th>接口名称</th>
                            <th>下单时间</th>
                            <th>轨迹状态</th>
                            <th>原始接口报文</th>
                            <th>尾程接口报文</th>
                            <th>推送报文</th>
                            <th>深邮响应报文</th>
                            <th>最新获取时间</th>
                            <th>最新推送时间</th>
                            <th>是否自动跟踪</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="15" style="text-align: center; padding: 40px;">加载中...</td>
                        </tr>
                        <tr v-else-if="trackingData.length === 0">
                            <td colspan="15" style="text-align: center; padding: 40px; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-else v-for="(item, index) in trackingData" :key="item.waybill_id">
                            <td>
                                <input 
                                    type="checkbox" 
                                    :value="item.waybill_id"
                                    v-model="selectedWaybillIds"
                                    @change="handleCheckboxChange(item)"
                                />
                            </td>
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ item.order_no }}</td>
                            <td>{{ item.transfer_no || '-' }}</td>
                            <td>{{ item.last_mile_no || '-' }}</td>
                            <td>{{ item.interface_name || '-' }}</td>
                            <td>{{ formatDateTime(item.order_time) || '-' }}</td>
                            <td>
                                <span 
                                    v-if="item.status_description" 
                                    class="btn-link"
                                    @click="viewDetails(item)"
                                >
                                    {{ item.status_description }}
                                </span>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>
                                <span 
                                    v-if="item.has_raw_response" 
                                    class="btn-link"
                                    @click="viewRawResponse(item)"
                                >
                                    查看报文
                                </span>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>
                                <span 
                                    v-if="item.has_lastmile_response" 
                                    class="btn-link"
                                    @click="viewLastmileResponse(item)"
                                >
                                    查看报文
                                </span>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>
                                <span 
                                    v-if="item.has_push_events" 
                                    class="btn-link"
                                    @click="viewPushEvents(item)"
                                >
                                    查看报文
                                </span>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>
                                <span 
                                    v-if="item.has_szpost_response" 
                                    class="btn-link"
                                    @click="viewSzpostResponse(item)"
                                >
                                    查看报文
                                </span>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>{{ formatDateTime(item.last_fetch_time) || '-' }}</td>
                            <td>{{ formatDateTime(item.last_push_time) || '-' }}</td>
                            <td>
                                <span :style="{ color: item.stop_tracking ? '#ff4d4f' : '#52c41a' }">
                                    {{ item.stop_tracking ? '否' : '是' }}
                                </span>
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
                        <option :value="200">200</option>
                        <option :value="500">500</option>
                        <option :value="1000">1000</option>
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

            <!-- 轨迹详情模态框 -->
            <div v-if="showDetailModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title">轨迹详情</h3>
                        <button class="modal-close" @click="closeDetailModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">订单号：</label>
                            <span>{{ trackingDetail.order_no }}</span>
                        </div>
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">转单号：</label>
                            <span>{{ trackingDetail.transfer_no || '-' }}</span>
                        </div>
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">最新获取时间：</label>
                            <span>{{ formatDateTime(trackingDetail.last_fetch_time) || '-' }}</span>
                        </div>
                        
                        <!-- 轨迹历史记录表格 -->
                        <div style="margin-top: 16px;">
                            <h4 style="font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #333;">轨迹历史记录</h4>
                            <table class="data-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="width: 25%;">时间</th>
                                        <th style="width: 55%;">轨迹描述</th>
                                        <th style="width: 20%;">轨迹状态代码</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!trackingHistoryList || trackingHistoryList.length === 0">
                                        <td colspan="3" style="text-align: center; padding: 20px; color: #999;">暂无轨迹记录</td>
                                    </tr>
                                    <tr v-else v-for="(item, index) in trackingHistoryList" :key="index">
                                        <td>{{ formatDateTime(item.tracking_time) || '-' }}</td>
                                        <td>{{ item.description || '-' }}</td>
                                        <td>{{ item.status_code || '-' }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closeDetailModal">关闭</button>
                    </div>
                </div>
            </div>

            <!-- 原始报文模态框 -->
            <div v-if="showRawModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">原始接口报文</h3>
                        <button class="modal-close" @click="closeRawModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">订单号：</label>
                            <span>{{ rawResponseData.order_no }}</span>
                        </div>
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">转单号：</label>
                            <span>{{ rawResponseData.transfer_no || '-' }}</span>
                        </div>
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">原始报文：</label>
                            <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; max-height: 400px; font-family: 'Courier New', monospace; font-size: 13px;">{{ rawResponseFormatted }}</pre>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closeRawModal">关闭</button>
                    </div>
                </div>
            </div>
            
            <!-- 尾程报文模态框 -->
            <div v-if="showLastmileModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title">尾程接口报文</h3>
                        <button class="modal-close" @click="closeLastmileModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">订单号：</label>
                            <span>{{ lastmileResponseData.order_no }}</span>
                        </div>
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">尾程单号：</label>
                            <span>{{ lastmileResponseData.last_mile_no || '-' }}</span>
                        </div>
                        
                        <!-- 注册报文 -->
                        <div class="detail-item" style="margin-bottom: 16px;">
                            <label style="font-weight: 500; color: #666; display: block; margin-bottom: 8px;">注册报文：</label>
                            <pre v-if="lastmileRegisterFormatted" style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; max-height: 300px; font-family: 'Courier New', monospace; font-size: 13px;">{{ lastmileRegisterFormatted }}</pre>
                            <div v-else style="color: #999; padding: 12px; background: #f5f5f5; border-radius: 4px;">暂无数据</div>
                        </div>
                        
                        <!-- 单号报文 -->
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666; display: block; margin-bottom: 8px;">单号报文：</label>
                            <pre v-if="lastmileTrackingFormatted" style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; max-height: 300px; font-family: 'Courier New', monospace; font-size: 13px;">{{ lastmileTrackingFormatted }}</pre>
                            <div v-else style="color: #999; padding: 12px; background: #f5f5f5; border-radius: 4px;">暂无数据</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closeLastmileModal">关闭</button>
                    </div>
                </div>
            </div>
            
            <!-- 推送报文模态框 -->
            <div v-if="showPushEventsModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 1000px;">
                    <div class="modal-header">
                        <h3 class="modal-title">推送报文</h3>
                        <button class="modal-close" @click="closePushEventsModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">订单号：</label>
                            <span>{{ pushEventsData.order_no }}</span>
                        </div>
                        
                        <div style="margin-top: 16px;">
                            <h4 style="font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #333;">推送事件列表（按时间顺序）</h4>
                            <table class="data-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="width: 8%;">操作</th>
                                        <th style="width: 15%;">轨迹时间</th>
                                        <th style="width: 10%;">状态代码</th>
                                        <th style="width: 25%;">轨迹描述</th>
                                        <th style="width: 12%;">城市</th>
                                        <th style="width: 10%;">国家</th>
                                        <th style="width: 10%;">数据来源</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="!pushEventsList || pushEventsList.length === 0">
                                        <td colspan="7" style="text-align: center; padding: 20px; color: #999;">暂无推送报文</td>
                                    </tr>
                                    <tr v-else v-for="(event, index) in pushEventsList" :key="index">
                                        <td style="text-align: center;">
                                            <button 
                                                class="btn-link btn-danger" 
                                                @click="deletePushEvent(index)"
                                                style="font-size: 12px; padding: 2px 8px;"
                                            >
                                                删除
                                            </button>
                                        </td>
                                        <td @dblclick="startEditCell(index, 'tracking_time')" style="cursor: pointer;">
                                            <input 
                                                v-if="editingEventIndex === index + '-tracking_time'"
                                                type="text"
                                                v-model="event.tracking_time"
                                                @blur="finishEditCell"
                                                @keyup.enter="finishEditCell"
                                                style="width: 100%; padding: 4px; border: 1px solid #4CAF50; border-radius: 3px;"
                                                placeholder="yyyy-MM-dd HH:mm:ss"
                                            />
                                            <span v-else>{{ formatTrackingTime(event.tracking_time) }}</span>
                                        </td>
                                        <td @dblclick="startEditCell(index, 'status_code')" style="cursor: pointer;">
                                            <select 
                                                v-if="editingEventIndex === index + '-status_code'"
                                                v-model="event.status_code"
                                                @blur="finishEditCell"
                                                @change="finishEditCell"
                                                style="width: 100%; padding: 4px; border: 1px solid #4CAF50; border-radius: 3px;"
                                            >
                                                <option value="">请选择</option>
                                                <option v-for="node in trackingNodes" :key="node.status_code" :value="node.status_code">
                                                    {{ node.status_code }}
                                                </option>
                                            </select>
                                            <span v-else>{{ event.status_code || '-' }}</span>
                                        </td>
                                        <td @dblclick="startEditCell(index, 'description')" style="cursor: pointer;">
                                            <input 
                                                v-if="editingEventIndex === index + '-description'"
                                                type="text"
                                                v-model="event.description"
                                                @blur="finishEditCell"
                                                @keyup.enter="finishEditCell"
                                                style="width: 100%; padding: 4px; border: 1px solid #4CAF50; border-radius: 3px;"
                                            />
                                            <span v-else>{{ event.description || '-' }}</span>
                                        </td>
                                        <td @dblclick="startEditCell(index, 'city')" style="cursor: pointer;">
                                            <input 
                                                v-if="editingEventIndex === index + '-city'"
                                                type="text"
                                                v-model="event.city"
                                                @blur="finishEditCell"
                                                @keyup.enter="finishEditCell"
                                                style="width: 100%; padding: 4px; border: 1px solid #4CAF50; border-radius: 3px;"
                                            />
                                            <span v-else>{{ event.city || '-' }}</span>
                                        </td>
                                        <td @dblclick="startEditCell(index, 'country')" style="cursor: pointer;">
                                            <input 
                                                v-if="editingEventIndex === index + '-country'"
                                                type="text"
                                                v-model="event.country"
                                                @blur="finishEditCell"
                                                @keyup.enter="finishEditCell"
                                                style="width: 100%; padding: 4px; border: 1px solid #4CAF50; border-radius: 3px;"
                                            />
                                            <span v-else>{{ event.country || '-' }}</span>
                                        </td>
                                        <td>
                                            <span :style="{ color: event.source === 'lastmile' ? '#1890ff' : (event.source === 'manual' ? '#ff9800' : '#52c41a') }">
                                                {{ event.source === 'lastmile' ? '尾程' : (event.source === 'manual' ? '人工录入' : '头程') }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style="margin-top: 12px; text-align: center;">
                                <button 
                                    class="btn btn-primary" 
                                    @click="addNewPushEvent"
                                    style="background: #4CAF50; border: none; padding: 6px 16px; border-radius: 4px; font-size: 14px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(76, 175, 80, 0.2); transition: all 0.3s;"
                                    @mouseenter="$event.target.style.background='#45a049'"
                                    @mouseleave="$event.target.style.background='#4CAF50'"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    新增轨迹
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closePushEventsModal">关闭</button>
                        <button class="btn btn-primary" @click="savePushEvents">保存</button>
                    </div>
                </div>
            </div>
            
            <!-- 导入尾程单号模态框 -->
            <div v-if="showImportModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">导入尾程单号</h3>
                        <button class="modal-close" @click="closeImportModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 16px;">
                            <button class="btn btn-secondary" @click="downloadTemplate">
                                下载导入模板
                            </button>
                        </div>
                        <div class="form-field">
                            <label>选择Excel文件</label>
                            <input type="file" ref="fileInput" accept=".xlsx,.xls" @change="handleFileChange" class="form-input" />
                        </div>
                        <div v-if="uploadFileName" style="margin-top: 8px; color: #666; font-size: 14px;">
                            已选择：{{ uploadFileName }}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closeImportModal">取消</button>
                        <button class="btn btn-primary" @click="submitImport" :disabled="!uploadFile">开始导入</button>
                    </div>
                </div>
            </div>
            
            <!-- 深邮响应报文模态框 -->
            <div v-if="showSzpostResponseModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">深邮响应报文</h3>
                        <button class="modal-close" @click="closeSzpostResponseModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">订单号：</label>
                            <span>{{ szpostResponseData.order_no }}</span>
                        </div>
                        <div class="detail-item" style="margin-bottom: 12px;">
                            <label style="font-weight: 500; color: #666;">响应报文：</label>
                            <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; max-height: 400px; font-family: 'Courier New', monospace; font-size: 13px;">{{ szpostResponseFormatted }}</pre>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closeSzpostResponseModal">关闭</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            trackingData: [],
            selectedWaybillIds: [],
            selectedTrackingIds: [],
            loading: false,
            showDetailModal: false,
            showRawModal: false,
            showLastmileModal: false,
            showPushEventsModal: false,
            showSzpostResponseModal: false,
            showImportModal: false,
            trackingDetail: {},
            trackingHistoryList: [],
            rawResponseData: {},
            lastmileResponseData: {},
            pushEventsData: {},
            pushEventsList: [],
            editingEventIndex: null,
            trackingNodes: [],
            szpostResponseData: {},
            uploadFile: null,
            uploadFileName: '',
            searchForm: {
                customer_id: '',
                customer_search: '',
                supplier_id: '',
                supplier_search: '',
                interface_name: '',
                stop_tracking: '',
                order_time_start: '',
                order_time_end: '',
                order_nos: '',
                transfer_nos: ''
            },
            customers: [],
            suppliers: [],
            trackingInterfaces: [],
            filteredCustomerList: [],
            filteredSupplierList: [],
            showCustomerDropdown: false,
            showSupplierDropdown: false,
            isOrderNosExpanded: false,
            isTransferNosExpanded: false,
            pagination: {
                currentPage: 1,
                perPage: 200,
                total: 0,
                pages: 0
            }
        };
    },
    computed: {
        allSelected() {
            return this.trackingData.length > 0 && this.selectedWaybillIds.length === this.trackingData.length;
        },
        rawResponseFormatted() {
            if (!this.rawResponseData.raw_response) return '暂无数据';
            try {
                const obj = JSON.parse(this.rawResponseData.raw_response);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return this.rawResponseData.raw_response;
            }
        },
        lastmileResponseFormatted() {
            if (!this.lastmileResponseData.lastmile_response) return '';
            try {
                const obj = JSON.parse(this.lastmileResponseData.lastmile_response);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return this.lastmileResponseData.lastmile_response;
            }
        },
        lastmileRegisterFormatted() {
            if (!this.lastmileResponseData.register_response) return '';
            try {
                const obj = JSON.parse(this.lastmileResponseData.register_response);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return this.lastmileResponseData.register_response;
            }
        },
        lastmileTrackingFormatted() {
            if (!this.lastmileResponseData.tracking_response) return '';
            try {
                const obj = JSON.parse(this.lastmileResponseData.tracking_response);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return this.lastmileResponseData.tracking_response;
            }
        },
        szpostResponseFormatted() {
            if (!this.szpostResponseData.response) return '暂无数据';
            try {
                const obj = JSON.parse(this.szpostResponseData.response);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return this.szpostResponseData.response;
            }
        }
    },
    mounted() {
        this.loadTrackingData();
        this.loadCustomers();
        this.loadSuppliers();
        this.loadTrackingInterfaces();
        this.loadTrackingNodes();
    },
    methods: {
        async loadTrackingData() {
            this.loading = true;
            try {
                const params = new URLSearchParams({
                    page: this.pagination.currentPage,
                    per_page: this.pagination.perPage
                });

                // 添加搜索参数
                if (this.searchForm.customer_id) params.append('customer_id', this.searchForm.customer_id);
                if (this.searchForm.supplier_id) params.append('supplier_id', this.searchForm.supplier_id);
                if (this.searchForm.interface_name) params.append('interface_name', this.searchForm.interface_name);
                if (this.searchForm.stop_tracking) params.append('stop_tracking', this.searchForm.stop_tracking);
                if (this.searchForm.order_time_start) params.append('start_date', this.searchForm.order_time_start);
                if (this.searchForm.order_time_end) params.append('end_date', this.searchForm.order_time_end);
                if (this.searchForm.order_nos) params.append('order_nos', this.searchForm.order_nos);
                if (this.searchForm.transfer_nos) params.append('transfer_nos', this.searchForm.transfer_nos);

                const resp = await fetch(`/api/tracking-data?${params.toString()}`);
                const data = await resp.json();
                if (data.success) {
                    this.trackingData = data.tracking_data;
                    this.pagination.total = data.pagination.total;
                    this.pagination.pages = data.pagination.pages;
                    this.pagination.currentPage = data.pagination.current_page;
                    this.pagination.perPage = data.pagination.per_page;
                    this.selectedWaybillIds = [];
                    this.selectedTrackingIds = [];
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
        async loadCustomers() {
            try {
                const resp = await fetch('/api/customers?per_page=10000');
                const data = await resp.json();
                if (data.success) {
                    this.customers = data.customers;
                }
            } catch (error) {
                console.error('加载客户列表失败:', error);
            }
        },
        async loadSuppliers() {
            try {
                const resp = await fetch('/api/suppliers?per_page=10000');
                const data = await resp.json();
                if (data.success) {
                    this.suppliers = data.suppliers;
                }
            } catch (error) {
                console.error('加载供应商列表失败:', error);
            }
        },
        async loadProducts() {
            try {
                const resp = await fetch('/api/products?per_page=10000');
                const data = await resp.json();
                if (data.success) {
                    this.products = data.products;
                }
            } catch (error) {
                console.error('加载产品列表失败:', error);
            }
        },
        async loadTrackingInterfaces() {
            try {
                const resp = await fetch('/api/tracking-interfaces?per_page=10000');
                const data = await resp.json();
                if (data.success) {
                    // 提取接口名称列表
                    const interfaceNames = data.interfaces.map(item => item.interface_name);
                    this.trackingInterfaces = [...new Set(interfaceNames)];
                }
            } catch (error) {
                console.error('加载轨迹接口列表失败:', error);
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
        filterCustomers() {
            const search = this.searchForm.customer_search.toLowerCase();
            if (search) {
                this.filteredCustomerList = this.customers.filter(c => 
                    c.short_name.toLowerCase().includes(search) || 
                    c.full_name.toLowerCase().includes(search)
                );
            } else {
                this.filteredCustomerList = [];
            }
        },
        showAllCustomers() {
            this.filteredCustomerList = this.customers;
            this.showCustomerDropdown = true;
        },
        selectCustomer(customer) {
            this.searchForm.customer_id = customer.id;
            this.searchForm.customer_search = customer.short_name;
            this.showCustomerDropdown = false;
        },
        hideCustomerDropdown() {
            setTimeout(() => {
                this.showCustomerDropdown = false;
            }, 200);
        },
        filterSuppliers() {
            const search = this.searchForm.supplier_search.toLowerCase();
            if (search) {
                this.filteredSupplierList = this.suppliers.filter(s => 
                    s.short_name.toLowerCase().includes(search) || 
                    s.full_name.toLowerCase().includes(search)
                );
            } else {
                this.filteredSupplierList = [];
            }
        },
        showAllSuppliers() {
            this.filteredSupplierList = this.suppliers;
            this.showSupplierDropdown = true;
        },
        selectSupplier(supplier) {
            this.searchForm.supplier_id = supplier.id;
            this.searchForm.supplier_search = supplier.short_name;
            this.showSupplierDropdown = false;
        },
        hideSupplierDropdown() {
            setTimeout(() => {
                this.showSupplierDropdown = false;
            }, 200);
        },
        searchTracking() {
            this.pagination.currentPage = 1;
            this.loadTrackingData();
        },
        resetSearch() {
            this.searchForm = {
                customer_id: '',
                customer_search: '',
                supplier_id: '',
                supplier_search: '',
                interface_name: '',
                stop_tracking: '',
                order_time_start: '',
                order_time_end: '',
                order_nos: '',
                transfer_nos: ''
            };
            this.pagination.currentPage = 1;
            this.loadTrackingData();
        },
        toggleAll(event) {
            if (event.target.checked) {
                this.selectedWaybillIds = this.trackingData.map(item => item.waybill_id);
                this.selectedTrackingIds = this.trackingData
                    .filter(item => item.tracking_id)
                    .map(item => item.tracking_id);
            } else {
                this.selectedWaybillIds = [];
                this.selectedTrackingIds = [];
            }
        },
        handleCheckboxChange(item) {
            // 当勾选/取消运单时，同步更新tracking_id列表
            if (this.selectedWaybillIds.includes(item.waybill_id)) {
                // 勾选了，如果有tracking_id则添加
                if (item.tracking_id && !this.selectedTrackingIds.includes(item.tracking_id)) {
                    this.selectedTrackingIds.push(item.tracking_id);
                }
            } else {
                // 取消勾选，移除tracking_id
                if (item.tracking_id) {
                    const index = this.selectedTrackingIds.indexOf(item.tracking_id);
                    if (index > -1) {
                        this.selectedTrackingIds.splice(index, 1);
                    }
                }
            }
        },
        async viewDetails(item) {
            if (!item.tracking_id) {
                alert('该运单暂无轨迹信息');
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-data/${item.tracking_id}/details`);
                const data = await resp.json();
                if (data.success) {
                    this.trackingDetail = data.tracking;
                    
                    // 解析原始报文中的trackInfo数组
                    this.trackingHistoryList = [];
                    if (data.tracking.raw_response) {
                        try {
                            const rawData = JSON.parse(data.tracking.raw_response);
                            
                            // 通邮接口格式：tracks[0].trackInfo
                            if (rawData.tracks && rawData.tracks.length > 0 && rawData.tracks[0].trackInfo) {
                                const trackInfoList = rawData.tracks[0].trackInfo;
                                
                                // 按时间降序排列（最新的在前）
                                trackInfoList.sort((a, b) => (b.changeDate || 0) - (a.changeDate || 0));
                                
                                // 获取状态映射表
                                this.trackingHistoryList = await this.mapTrackingStatus(trackInfoList, item);
                            }
                            // 华岳接口或其他格式：如果有其他结构，可以在这里扩展
                        } catch (e) {
                            console.error('解析原始报文失败:', e);
                        }
                    }
                    
                    this.showDetailModal = true;
                } else {
                    alert(data.message || '获取详情失败');
                }
            } catch (error) {
                console.error('获取详情失败:', error);
                alert('获取详情失败，请稍后重试');
            }
        },
        closeDetailModal() {
            this.showDetailModal = false;
            this.trackingDetail = {};
            this.trackingHistoryList = [];
        },
        async mapTrackingStatus(trackInfoList, item) {
            // 获取该运单对应的轨迹接口配置，以获取状态映射表
            try {
                const interfaceName = item.interface_name;
                if (!interfaceName) {
                    // 如果没有接口名称，直接返回原始状态
                    return trackInfoList.map(info => ({
                        tracking_time: info.changeDate ? new Date(info.changeDate).toISOString() : null,
                        description: info.record || '',
                        status_code: String(info.status || '')
                    }));
                }
                
                // 获取轨迹接口配置
                const resp = await fetch(`/api/tracking-interfaces?per_page=10000`);
                const data = await resp.json();
                
                if (!data.success || !data.interfaces) {
                    // 如果获取失败，返回原始状态
                    return trackInfoList.map(info => ({
                        tracking_time: info.changeDate ? new Date(info.changeDate).toISOString() : null,
                        description: info.record || '',
                        status_code: String(info.status || '')
                    }));
                }
                
                // 查找对应的接口
                const interfaceConfig = data.interfaces.find(i => i.interface_name === interfaceName);
                if (!interfaceConfig || !interfaceConfig.status_mapping) {
                    // 如果没有找到映射表，返回原始状态
                    return trackInfoList.map(info => ({
                        tracking_time: info.changeDate ? new Date(info.changeDate).toISOString() : null,
                        description: info.record || '',
                        status_code: String(info.status || '')
                    }));
                }
                
                // 解析状态映射表
                const statusMapping = JSON.parse(interfaceConfig.status_mapping);
                
                // 映射每个轨迹记录的状态
                return trackInfoList.map(info => {
                    const supplierStatus = String(info.status || '');
                    
                    // 查找对应的系统状态码
                    let systemStatusCode = '';
                    for (const mapping of statusMapping) {
                        if (mapping.supplier_status === supplierStatus) {
                            systemStatusCode = mapping.system_status_code || '';
                            break;
                        }
                    }
                    
                    return {
                        tracking_time: info.changeDate ? new Date(info.changeDate).toISOString() : null,
                        description: info.record || '',
                        status_code: systemStatusCode  // 使用映射后的系统状态码
                    };
                });
            } catch (error) {
                console.error('状态映射失败:', error);
                // 如果出错，返回原始状态
                return trackInfoList.map(info => ({
                    tracking_time: info.changeDate ? new Date(info.changeDate).toISOString() : null,
                    description: info.record || '',
                    status_code: String(info.status || '')
                }));
            }
        },
        async viewRawResponse(item) {
            if (!item.tracking_id) {
                alert('该运单暂无轨迹信息');
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-data/${item.tracking_id}/details`);
                const data = await resp.json();
                if (data.success) {
                    this.rawResponseData = data.tracking;
                    this.showRawModal = true;
                } else {
                    alert(data.message || '获取原始报文失败');
                }
            } catch (error) {
                console.error('获取原始报文失败:', error);
                alert('获取原始报文失败，请稍后重试');
            }
        },
        closeRawModal() {
            this.showRawModal = false;
            this.rawResponseData = {};
        },
        async pushTracking() {
            if (this.selectedTrackingIds.length === 0) {
                alert('请选择要推送的轨迹');
                return;
            }

            try {
                const resp = await fetch('/api/tracking-data/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tracking_ids: this.selectedTrackingIds })
                });
                const data = await resp.json();
                if (data.success) {
                    alert('推送成功');
                    this.loadTrackingData();
                } else {
                    alert(data.message || '推送失败');
                }
            } catch (error) {
                console.error('推送失败:', error);
                alert('推送失败，请稍后重试');
            }
        },
        async fetchTracking() {
            if (this.selectedWaybillIds.length === 0) {
                alert('请选择要获取轨迹的运单');
                return;
            }

            const count = this.selectedWaybillIds.length;

            try {
                const resp = await fetch('/api/tracking-data/fetch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ waybill_ids: this.selectedWaybillIds })
                });
                const data = await resp.json();
                
                // 第一次点击时提示，之后无需提示
                if (data.success) {
                    alert(`已提交${count}单获取任务，后台处理中...（稍后刷新查看结果）`);
                }
                // 失败时不提示，用户自己查看
            } catch (error) {
                console.error('获取失败:', error);
                // 网络异常也不提示
            }
        },
        changePage(page) {
            if (page < 1 || page > this.pagination.pages) return;
            this.pagination.currentPage = page;
            this.loadTrackingData();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadTrackingData();
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
        },
        async viewLastmileResponse(item) {
            if (!item.tracking_id) {
                alert('该运单暂无轨迹信息');
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-data/${item.tracking_id}/details`);
                const data = await resp.json();
                if (data.success && (data.tracking.lastmile_register_response || data.tracking.lastmile_tracking_response)) {
                    this.lastmileResponseData = {
                        order_no: item.order_no,
                        last_mile_no: item.last_mile_no,
                        register_response: data.tracking.lastmile_register_response,
                        tracking_response: data.tracking.lastmile_tracking_response,
                        lastmile_response: data.tracking.lastmile_raw_response || ''  // 兼容旧字段
                    };
                    this.showLastmileModal = true;
                } else {
                    alert('该运单暂无尾程接口报文');
                }
            } catch (error) {
                console.error('获取尾程报文失败:', error);
                alert('获取尾程报文失败，请稍后重试');
            }
        },
        closeLastmileModal() {
            this.showLastmileModal = false;
            this.lastmileResponseData = {};
        },
        async viewPushEvents(item) {
            if (!item.tracking_id) {
                alert('该运单暂无轨迹信息');
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-data/${item.tracking_id}/push-events`);
                const data = await resp.json();
                if (data.success) {
                    this.pushEventsData = {
                        order_no: data.order_no,
                        tracking_id: item.tracking_id
                    };
                    this.pushEventsList = data.push_events || [];
                    this.showPushEventsModal = true;
                } else {
                    alert(data.message || '获取推送报文失败');
                }
            } catch (error) {
                console.error('获取推送报文失败:', error);
                alert('获取推送报文失败，请稍后重试');
            }
        },
        closePushEventsModal() {
            this.showPushEventsModal = false;
            this.pushEventsData = {};
            this.pushEventsList = [];
        },
        async deletePushEvent(index) {
            if (!confirm('确认删除该条轨迹事件？')) {
                return;
            }
            
            // 前端删除
            this.pushEventsList.splice(index, 1);
            
            // 同步到后端
            try {
                const resp = await fetch(`/api/tracking-data/${this.pushEventsData.tracking_id}/push-events`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ push_events: this.pushEventsList })
                });
                const data = await resp.json();
                if (!data.success) {
                    alert(data.message || '删除失败');
                    // 重新加载数据
                    this.viewPushEvents({ tracking_id: this.pushEventsData.tracking_id });
                }
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败，请稍后重试');
            }
        },
        async viewSzpostResponse(item) {
            if (!item.tracking_id) {
                alert('该运单暂无轨迹信息');
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-data/${item.tracking_id}/szpost-response`);
                const data = await resp.json();
                if (data.success && data.szpost_response) {
                    this.szpostResponseData = {
                        order_no: item.order_no,
                        response: data.szpost_response
                    };
                    this.showSzpostResponseModal = true;
                } else {
                    alert('该运单暂无深邮响应报文');
                }
            } catch (error) {
                console.error('获取深邮响应报文失败:', error);
                alert('获取深邮响应报文失败，请稍后重试');
            }
        },
        closeSzpostResponseModal() {
            this.showSzpostResponseModal = false;
            this.szpostResponseData = {};
        },
        formatTrackingTime(timeStr) {
            if (!timeStr) return '-';
            return timeStr.replace('T', ' ');
        },
        async fetchLastmileTracking() {
            if (this.selectedWaybillIds.length === 0) {
                alert('请选择要获取尾程轨迹的运单');
                return;
            }

            const count = this.selectedWaybillIds.length;

            try {
                const resp = await fetch('/api/tracking-data/fetch-lastmile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ waybill_ids: this.selectedWaybillIds })
                });
                const data = await resp.json();
                
                // 第一次点击时提示，之后无需提示
                if (data.success) {
                    alert(`已提交${count}单尾程轨迹获取任务，后台处理中...（稍后刷新查看结果）`);
                }
                // 失败时不提示，用户自己查看
            } catch (error) {
                console.error('尾程轨迹异常:', error);
                // 网络异常也不提示
            }
        },
        showImportLastmileDialog() {
            this.showImportModal = true;
            this.uploadFile = null;
            this.uploadFileName = '';
        },
        closeImportModal() {
            this.showImportModal = false;
            this.uploadFile = null;
            this.uploadFileName = '';
            if (this.$refs.fileInput) {
                this.$refs.fileInput.value = '';
            }
        },
        handleFileChange(event) {
            const file = event.target.files[0];
            if (file) {
                this.uploadFile = file;
                this.uploadFileName = file.name;
            }
        },
        async downloadTemplate() {
            try {
                const resp = await fetch('/api/tracking-data/lastmile-template');
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '尾程单号导入模板.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('下载模板失败:', error);
                alert('下载模板失败，请稍后重试');
            }
        },
        async submitImport() {
            if (!this.uploadFile) {
                alert('请选择要导入的文件');
                return;
            }

            const formData = new FormData();
            formData.append('file', this.uploadFile);

            try {
                const resp = await fetch('/api/tracking-data/import-lastmile', {
                    method: 'POST',
                    body: formData
                });
                const data = await resp.json();
                if (data.success) {
                    alert(data.message || '导入成功');
                    this.closeImportModal();
                    this.loadTrackingData();
                } else {
                    alert(data.message || '导入失败');
                }
            } catch (error) {
                console.error('导入失败:', error);
                alert('导入失败，请稍后重试');
            }
        },
        startEditCell(index, field) {
            this.editingEventIndex = index + '-' + field;
            // 延迟聚焦，等待 DOM 更新
            this.$nextTick(() => {
                const inputs = document.querySelectorAll(`td input, td select`);
                inputs.forEach(input => input.focus());
            });
        },
        finishEditCell() {
            this.editingEventIndex = null;
        },
        addNewPushEvent() {
            const now = new Date();
            const timeStr = now.getFullYear() + '-' + 
                String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                String(now.getDate()).padStart(2, '0') + ' ' + 
                String(now.getHours()).padStart(2, '0') + ':' + 
                String(now.getMinutes()).padStart(2, '0') + ':' + 
                String(now.getSeconds()).padStart(2, '0');
            
            const newEvent = {
                order_no: this.pushEventsData.order_no,
                tracking_time: timeStr,
                status_code: '',
                description: '',
                city: '',
                country: '',
                source: 'manual'
            };
            
            this.pushEventsList.push(newEvent);
            // 按时间排序
            this.pushEventsList.sort((a, b) => {
                return (a.tracking_time || '').localeCompare(b.tracking_time || '');
            });
        },
        async savePushEvents() {
            // 校验所有字段是否均有值
            for (let i = 0; i < this.pushEventsList.length; i++) {
                const event = this.pushEventsList[i];
                if (!event.tracking_time || !event.status_code || !event.description || !event.city || !event.country) {
                    alert(`第 ${i + 1} 条轨迹存在空字段，请填写完整再保存！`);
                    return;
                }
            }
            
            // 保存到后端
            try {
                const resp = await fetch(`/api/tracking-data/${this.pushEventsData.tracking_id}/push-events`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ push_events: this.pushEventsList })
                });
                const data = await resp.json();
                if (data.success) {
                    alert('保存成功');
                    this.closePushEventsModal();
                    this.loadTrackingData();
                } else {
                    alert(data.message || '保存失败');
                }
            } catch (error) {
                console.error('保存失败:', error);
                alert('保存失败，请稍后重试');
            }
        }
    }
};
