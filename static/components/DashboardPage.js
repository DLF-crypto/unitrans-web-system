const DashboardPage = {
    template: `
        <div class="page-container" style="background: #f4f7f6; min-height: 100vh; padding: 24px;">
            <div class="page-header" style="margin-bottom: 24px;">
                <h2 class="page-title" style="margin: 0; color: #333; font-weight: 600;">数据分析中心</h2>
            </div>

            <!-- 业务数据分析 -->
            <div style="margin-bottom: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 4px; height: 20px; background: #42b983; border-radius: 2px;"></div>
                        <h3 style="margin: 0; font-size: 20px; color: #333; font-weight: 600;">业务数据分析</h3>
                    </div>
                    
                    <!-- 统计周期与过滤 -->
                    <div style="display: flex; gap: 12px; align-items: center; background: white; padding: 10px 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 14px; color: #666; white-space: nowrap;">起始：</label>
                            <select v-model="startYearMonth" class="form-input" style="width: 130px; margin: 0;" @change="loadStats">
                                <option v-for="opt in yearMonthOptions" :key="'start_'+opt.value" :value="opt.value">{{ opt.label }}</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 14px; color: #666; white-space: nowrap;">结束：</label>
                            <select v-model="endYearMonth" class="form-input" style="width: 130px; margin: 0;" @change="loadStats">
                                <option v-for="opt in yearMonthOptions" :key="'end_'+opt.value" :value="opt.value">{{ opt.label }}</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 14px; color: #666; white-space: nowrap;">客户类型：</label>
                            <select v-model="customerType" class="form-input" style="width: 110px; margin: 0;" @change="loadStats">
                                <option value="单号客户">单号客户</option>
                                <option value="头程客户">头程客户</option>
                                <option value="尾程客户">尾程客户</option>
                                <option value="差价客户">差价客户</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" style="padding: 6px 16px;" @click="loadStats">刷新数据</button>
                    </div>
                </div>

                <!-- 单量数据看板 -->
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 24px;">
                    <div style="display: flex; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; text-align: center; border-bottom: 1px solid #f0f0f0; padding-bottom: 24px; margin-bottom: 24px;">
                        <div style="flex: 1;">
                            <div style="font-size: 32px; font-weight: 600; color: #333;">{{ volume.pieces }}</div>
                            <div style="font-size: 13px; color: #999; margin-top: 4px;">总单量 (件)</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 32px; font-weight: 600; color: #333;">{{ volume.weight }}</div>
                            <div style="font-size: 13px; color: #999; margin-top: 4px;">总重量 (kg)</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 32px; font-weight: 600; color: #42b983;" v-if="volume.pieces > 0">{{ (volume.weight / volume.pieces).toFixed(2) }}</div>
                            <div style="font-size: 32px; font-weight: 600; color: #42b983;" v-else>0.00</div>
                            <div style="font-size: 13px; color: #999; margin-top: 4px;">平均单重 (kg/单)</div>
                        </div>
                    </div>

                    <!-- 图表区域 -->
                    <div style="display: flex; flex-direction: column; gap: 32px;">
                        <div style="height: 500px; width: 100%;" ref="customerChart"></div>
                        <div style="height: 450px; width: 100%;" ref="productChart"></div>
                    </div>
                </div>

                <!-- 趋势分析 -->
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 4px; height: 18px; background: #2196F3; border-radius: 2px;"></div>
                            <h3 style="margin: 0; font-size: 18px; color: #333;">业务增长趋势</h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 14px; color: #666;">对比客户：</span>
                            
                            <!-- 自定义多选下拉框 -->
                            <div style="position: relative; width: 300px;" ref="trendDropdownContainer">
                                <div @click.stop="showTrendCustomerDropdown = !showTrendCustomerDropdown" 
                                     style="border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; min-height: 38px;">
                                    <span style="font-size: 13px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;">
                                        {{ selectedTrendCustomerNames || '选择客户对比...' }}
                                    </span>
                                    <span style="font-size: 10px; color: #999;">{{ showTrendCustomerDropdown ? '▲' : '▼' }}</span>
                                </div>
                                
                                <div v-if="showTrendCustomerDropdown" 
                                     @click.stop
                                     style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--border-color); border-radius: 8px; margin-top: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 1000; max-height: 300px; overflow-y: auto; padding: 8px 0;">
                                    <div v-for="c in filteredTrendCustomers" :key="c.id" 
                                         style="padding: 8px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer;"
                                         @click="toggleTrendCustomer(c.id)">
                                        <input type="checkbox" :checked="selectedTrendCustomers.includes(c.id)" style="cursor: pointer; pointer-events: none;">
                                        <span style="font-size: 13px; color: #333; pointer-events: none;">{{ c.short_name }}</span>
                                    </div>
                                    <div v-if="filteredTrendCustomers.length === 0" style="padding: 12px; text-align: center; color: #999; font-size: 12px;">
                                        该类型下暂无客户
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="height: 450px;" ref="trendChart"></div>
                </div>
            </div>

            <!-- 财务数据分析 -->
            <div style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <div style="width: 4px; height: 20px; background: #42b983; border-radius: 2px;"></div>
                    <h3 style="margin: 0; font-size: 20px; color: #333; font-weight: 600;">财务数据分析</h3>
                </div>

                <!-- 财务汇总卡片 -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                    <div class="stat-card" style="background: linear-gradient(135deg, #42b983 0%, #35495e 100%); color: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 20px rgba(66, 185, 131, 0.2);">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">资金池余额 (CNY)</div>
                        <div style="font-size: 28px; font-weight: bold;">{{ formatAmount(finance.cash_balance) }}</div>
                        <div style="margin-top: 12px; font-size: 12px; background: rgba(255,255,255,0.2); display: inline-block; padding: 2px 8px; border-radius: 4px;">全局累计数据</div>
                    </div>
                    <div class="stat-card" 
                         style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-left: 5px solid #2196F3; cursor: pointer; transition: transform 0.2s;"
                         @mouseenter="$event.currentTarget.style.transform='translateY(-5px)'"
                         @mouseleave="$event.currentTarget.style.transform='translateY(0)'"
                         @click="showUnpaidDetails('receivable')">
                        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">总应收款 (未核销)</div>
                        <div style="font-size: 28px; font-weight: bold; color: #2196F3;">{{ formatAmount(finance.receivable) }}</div>
                        <div style="margin-top: 12px; font-size: 12px; color: #999;">待收回资金总额 (点击查看详情)</div>
                    </div>
                    <div class="stat-card" 
                         style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-left: 5px solid #f44336; cursor: pointer; transition: transform 0.2s;"
                         @mouseenter="$event.currentTarget.style.transform='translateY(-5px)'"
                         @mouseleave="$event.currentTarget.style.transform='translateY(0)'"
                         @click="showUnpaidDetails('payable')">
                        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">总应付款 (未核销)</div>
                        <div style="font-size: 28px; font-weight: bold; color: #f44336;">{{ formatAmount(finance.payable) }}</div>
                        <div style="margin-top: 12px; font-size: 12px; color: #999;">待支付供应商总额 (点击查看详情)</div>
                    </div>
                </div>
            </div>
            
            <!-- 物流处理费分析 (差价客户专用) -->
            <div style="margin-top: 32px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 4px; height: 18px; background: #FF9800; border-radius: 2px;"></div>
                        <h3 style="margin: 0; font-size: 18px; color: #333;">物流处理费分析</h3>
                    </div>
                    
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 13px; color: #666;">起始：</label>
                            <select v-model="handlingFeeStart" class="form-input" style="width: 120px; margin: 0; padding: 4px 8px;" @change="loadHandlingFee">
                                <option value="all">全部时间</option>
                                <option v-for="opt in yearMonthOptions" :key="'hf_s_'+opt.value" :value="opt.value">{{ opt.label }}</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 13px; color: #666;">结束：</label>
                            <select v-model="handlingFeeEnd" class="form-input" style="width: 120px; margin: 0; padding: 4px 8px;" @change="loadHandlingFee">
                                <option value="all">全部时间</option>
                                <option v-for="opt in yearMonthOptions" :key="'hf_e_'+opt.value" :value="opt.value">{{ opt.label }}</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 13px; color: #666;">差价客户：</label>
                            <select v-model="handlingFeeCustomerId" class="form-input" style="width: 150px; margin: 0; padding: 4px 8px;" @change="loadHandlingFee">
                                <option value="all">所有客户</option>
                                <option v-for="c in differentialCustomers" :key="c.id" :value="c.id">{{ c.short_name }}</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 40px; background: #FFF9F2; padding: 20px; border-radius: 8px; border-left: 5px solid #FF9800;">
                    <div>
                        <div style="font-size: 14px; color: #8a6d3b; margin-bottom: 5px;">累计物流处理费 (CNY)</div>
                        <div style="font-size: 32px; font-weight: bold; color: #e67e22;">{{ formatAmount(handlingFeeTotal) }}</div>
                    </div>
                    <div style="flex: 1; border-left: 1px solid #f9e1c4; padding-left: 40px;">
                        <div style="font-size: 13px; color: #999;">
                            温馨提示：此金额仅统计【专线处理费】字段。默认显示全部时间段及所有差价客户的累计数据。
                        </div>
                    </div>
                </div>
            </div>
            
            <div v-if="loading" class="modal-overlay" style="background: rgba(255,255,255,0.8); z-index: 3000;">
                <div class="loading-spinner"></div>
            </div>

            <!-- 未核销详情弹窗 -->
            <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false" style="z-index: 2000;">
                <div class="modal-content" style="max-width: 650px; border-radius: 12px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ detailModalTitle }}</h3>
                        <button class="modal-close" @click="showDetailModal = false">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 0; max-height: 500px; overflow-y: auto;">
                        <table class="data-table" style="margin: 0; border: none;">
                            <thead style="position: sticky; top: 0; z-index: 1;">
                                <tr>
                                    <th style="background: #f8f9fa;">序号</th>
                                    <th style="background: #f8f9fa;">账单名称</th>
                                    <th style="background: #f8f9fa;">金额</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, index) in detailList" :key="item.id">
                                    <td style="text-align: center; width: 60px;">{{ index + 1 }}</td>
                                    <td>{{ item.name }}</td>
                                    <td style="text-align: right; font-weight: 600; width: 120px;" 
                                        :style="{ color: detailType === 'receivable' ? '#2196F3' : '#f44336' }">
                                        {{ formatAmount(item.amount) }}
                                    </td>
                                </tr>
                                <tr v-if="detailList.length === 0">
                                    <td colspan="3" style="text-align: center; padding: 30px; color: #999;">暂无待核销账单</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer" style="padding: 15px 24px; border-top: 1px solid #f0f0f0;">
                        <div style="flex: 1; font-weight: 600; color: #333;">合计金额：{{ formatAmount(detailTotalAmount) }}</div>
                        <button class="btn btn-secondary" @click="showDetailModal = false">关闭</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        const now = new Date();
        const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return {
            loading: false,
            startYearMonth: curYM,
            endYearMonth: curYM,
            customerType: '单号客户',
            lastCustomerType: '单号客户',
            yearMonthOptions: [],
            customers: [],
            selectedTrendCustomers: [],
            volume: {
                pieces: 0,
                weight: 0,
                product_distribution: [],
                customer_distribution: { names: [], pieces: [], weights: [] }
            },
            finance: {
                cash_balance: 0,
                receivable: 0,
                payable: 0
            },
            showDetailModal: false,
            detailType: '',
            detailModalTitle: '',
            detailList: [],
            showTrendCustomerDropdown: false,
            // 物流处理费专项
            handlingFeeTotal: 0,
            handlingFeeStart: 'all',
            handlingFeeEnd: 'all',
            handlingFeeCustomerId: 'all'
        };
    },
    created() {
        // 将 charts 实例放在非响应式对象中，避免 Vue 3 Proxy 干扰 ECharts
        this.charts = {
            product: null,
            customer: null,
            trend: null
        };
    },
    mounted() {
        this.initYearMonthOptions();
        this.loadCustomers();
        // 并行发起所有统计请求
        Promise.all([
            this.loadStats(),
            this.loadTrendData(),
            this.loadHandlingFee()
        ]);
        window.addEventListener('resize', this.handleResize);
        document.addEventListener('click', this.handleGlobalClick);
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('click', this.handleGlobalClick);
        if (this.charts.product) this.charts.product.dispose();
        if (this.charts.customer) this.charts.customer.dispose();
        if (this.charts.trend) this.charts.trend.dispose();
    },
    computed: {
        detailTotalAmount() {
            return this.detailList.reduce((sum, item) => sum + item.amount, 0);
        },
        filteredTrendCustomers() {
            // 根据当前选择的客户类型过滤可选的趋势图客户
            return this.customers.filter(c => {
                if (!this.customerType) return true;
                return c.customer_types.includes(this.customerType);
            });
        },
        selectedTrendCustomerNames() {
            if (!this.selectedTrendCustomers || !this.selectedTrendCustomers.length) return "";
            if (!this.customers || !this.customers.length) return "加载客户中...";
            
            const names = this.customers
                .filter(c => this.selectedTrendCustomers.includes(c.id))
                .map(c => c.short_name);
            
            return names.length > 0 ? names.join(', ') : "未找到匹配客户";
        },
        differentialCustomers() {
            return this.customers.filter(c => c.customer_types && c.customer_types.includes('差价客户'));
        }
    },
    methods: {
        initYearMonthOptions() {
            const start = new Date(2025, 5); // 2025年6月
            const end = new Date();
            end.setMonth(end.getMonth() + 3); // 预留3个月
            
            let curr = new Date(start);
            while (curr <= end) {
                const y = curr.getFullYear();
                const m = curr.getMonth() + 1;
                const val = `${y}-${String(m).padStart(2, '0')}`;
                this.yearMonthOptions.push({
                    label: `${y}年${m}月`,
                    value: val
                });
                curr.setMonth(curr.getMonth() + 1);
            }
            // 倒序排列，最新的在前面
            this.yearMonthOptions.reverse();
        },
        async loadCustomers() {
            try {
                const res = await fetch('/api/customers');
                const data = await res.json();
                if (data.success) {
                    this.customers = data.customers;
                }
            } catch (e) {
                console.error("加载客户列表失败", e);
            }
        },
        async loadStats() {
            this.loading = true;
            // 只有当客户类型发生变化时，才清空已选趋势客户
            if (this.customerType !== this.lastCustomerType) {
                this.selectedTrendCustomers = [];
                this.lastCustomerType = this.customerType;
            }
            try {
                const res = await fetch(`/api/dashboard/stats?start_date=${this.startYearMonth}&end_date=${this.endYearMonth}&customer_type=${this.customerType}`);
                const data = await res.json();
                if (data.success) {
                    this.volume = data.volume;
                    this.finance = data.finance;
                    this.$nextTick(() => {
                        this.renderCharts();
                    });
                }
            } catch (e) {
                console.error("加载统计数据失败", e);
            } finally {
                this.loading = false;
            }
        },
        async loadTrendData() {
            if (this.loadingTrend) return; // 防止重复加载
            this.loadingTrend = true;
            console.log("Loading trend data for IDs:", this.selectedTrendCustomers);
            try {
                let url = `/api/dashboard/trend?start_date=${this.startYearMonth}&end_date=${this.endYearMonth}&customer_type=${this.customerType}`;
                if (this.selectedTrendCustomers && this.selectedTrendCustomers.length > 0) {
                    this.selectedTrendCustomers.forEach(id => {
                        url += `&customer_ids[]=${Number(id)}`;
                    });
                }
                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    if (this.selectedTrendCustomers.length === 0 && data.selected_customer_ids) {
                        this.selectedTrendCustomers = data.selected_customer_ids.map(id => Number(id));
                    }
                    this.$nextTick(() => {
                        this.renderTrendChart(data);
                    });
                }
            } catch (e) {
                console.error("加载趋势数据失败", e);
            } finally {
                this.loadingTrend = false;
            }
        },
        async loadHandlingFee() {
            try {
                let url = `/api/dashboard/handling-fee?start_date=${this.handlingFeeStart}&end_date=${this.handlingFeeEnd}&customer_id=${this.handlingFeeCustomerId}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    this.handlingFeeTotal = data.total;
                }
            } catch (e) {
                console.error("加载处理费数据失败", e);
            }
        },
        renderCharts() {
            if (typeof echarts === 'undefined') {
                console.error("ECharts library not found");
                return;
            }

            try {
                // 1. 产品分布饼图
                const productDom = this.$refs.productChart;
                if (productDom) {
                    if (!this.charts.product) {
                        this.charts.product = echarts.init(productDom);
                    }
                    this.charts.product.setOption({
                        title: { text: '产品发运占比', left: 'center', textStyle: { fontSize: 18, fontWeight: '600' } },
                        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                        legend: { 
                            orient: 'vertical',
                            left: 'left',
                            top: 'center',
                            padding: [0, 0, 0, 20],
                            itemGap: 15
                        },
                        series: [{
                            name: '发运件数',
                            type: 'pie',
                            radius: ['45%', '75%'],
                            center: ['60%', '50%'],
                            avoidLabelOverlap: false,
                            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                            label: { show: false },
                            emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
                            data: this.volume.product_distribution || [],
                            color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
                        }]
                    }, true);
                }

                // 2. 客户分布柱状图
                const customerDom = this.$refs.customerChart;
                if (customerDom) {
                    if (!this.charts.customer) {
                        this.charts.customer = echarts.init(customerDom);
                    }
                    
                    const dist = this.volume.customer_distribution || { names: [], pieces: [], weights: [] };
                    const names = [...(dist.names || [])].reverse();
                    const pieces = [...(dist.pieces || [])].reverse();
                    const weights = [...(dist.weights || [])].reverse();

                    this.charts.customer.setOption({
                        title: { text: '客户单量/重量分析', left: 'center', textStyle: { fontSize: 18, fontWeight: '600' } },
                        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                        legend: { bottom: '0' },
                        grid: { left: '3%', right: '8%', bottom: '15%', containLabel: true },
                        dataZoom: [{ type: 'inside', yAxisIndex: 0 }],
                        xAxis: { type: 'value', name: '数值' },
                        yAxis: { type: 'category', data: names },
                        series: [
                            {
                                name: '总单量 (件)',
                                type: 'bar',
                                data: pieces,
                                itemStyle: { color: '#2196F3' },
                                label: { show: true, position: 'right' }
                            },
                            {
                                name: '总重量 (kg)',
                                type: 'bar',
                                data: weights,
                                itemStyle: { color: '#42b983' },
                                label: { show: true, position: 'right' }
                            }
                        ]
                    }, true);
                }
            } catch (err) {
                console.error("渲染主图表出错:", err);
            }
        },
        renderTrendChart(data) {
            if (typeof echarts === 'undefined') return;
            
            const trendDom = this.$refs.trendChart;
            if (!trendDom) return;

            if (!this.charts.trend) {
                this.charts.trend = echarts.init(trendDom);
            }
            
            // 每次重新渲染前清理，防止残留
            // this.charts.trend.clear(); // 移除 clear()，改用 setOption(..., true) 实现清理
            
            const dates = data.dates || [];
            const series = data.series || [];
            
            console.log("Rendering trend chart with:", { datesCount: dates.length, seriesCount: series.length });

            const option = {
                title: { 
                    text: series.length === 0 ? '该周期内暂无业务数据' : '',
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#999', fontSize: 14, fontWeight: 'normal' }
                },
                tooltip: { 
                    trigger: 'axis',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderWidth: 1,
                    borderColor: '#ccc',
                    textStyle: { color: '#333' },
                    formatter: function(params) {
                        if (!params || params.length === 0) return "";
                        let res = '<div style="font-weight: bold; margin-bottom: 5px;">' + params[0].name + '</div>';
                        params.forEach(item => {
                            res += '<div style="display: flex; justify-content: space-between; gap: 20px;">' + 
                                   '<span>' + item.marker + item.seriesName + '</span>' + 
                                   '<span style="font-weight: bold;">' + item.value + ' 件</span>' + 
                                   '</div>';
                        });
                        return res;
                    }
                },
                legend: { 
                    bottom: '0',
                    type: 'scroll',
                    padding: [0, 20]
                },
                grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
                dataZoom: [
                    { type: 'inside', xAxisIndex: 0, filterMode: 'none' }, // 鼠标滚轮缩放时间轴
                    { type: 'slider', xAxisIndex: 0, bottom: '10%', height: 20 } // 滑动条缩放
                ],
                xAxis: { 
                    type: 'category', 
                    boundaryGap: false, 
                    data: dates,
                    axisLabel: {
                        interval: 'auto',
                        rotate: 30,
                        fontSize: 11
                    },
                    axisLine: { lineStyle: { color: '#ccc' } }
                },
                yAxis: { 
                    type: 'value', 
                    name: '单量 (件)',
                    nameTextStyle: { color: '#999' },
                    minInterval: 1,
                    splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
                    axisLine: { show: false }
                },
                series: series,
                color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
            };

            this.charts.trend.setOption(option, true);
        },
        handleResize() {
            Object.values(this.charts).forEach(c => {
                if (c && typeof c.resize === 'function') {
                    // 检查实例是否已被销毁
                    if (c.isDisposed && c.isDisposed()) return;
                    try {
                        c.resize();
                    } catch (e) {
                        console.warn("ECharts resize error:", e);
                    }
                }
            });
        },
        handleGlobalClick(e) {
            // 点击外部关闭下拉框
            if (this.showTrendCustomerDropdown) {
                const container = this.$refs.trendDropdownContainer;
                if (container && !container.contains(e.target)) {
                    this.showTrendCustomerDropdown = false;
                }
            }
        },
        toggleTrendCustomer(id) {
            const index = this.selectedTrendCustomers.indexOf(id);
            if (index > -1) {
                this.selectedTrendCustomers.splice(index, 1);
            } else {
                this.selectedTrendCustomers.push(id);
            }
            console.log("Selected trend customers:", this.selectedTrendCustomers);
            this.loadTrendData();
        },
        closeTrendDropdown() {
            this.showTrendCustomerDropdown = false;
        },
        async showUnpaidDetails(type) {
            this.detailType = type;
            this.detailModalTitle = type === 'receivable' ? '待核销应收账单明细' : '待核销应付账单明细';
            this.loading = true;
            try {
                const res = await fetch(`/api/dashboard/unpaid-details?type=${type}`);
                const data = await res.json();
                if (data.success) {
                    this.detailList = data.details;
                    this.showDetailModal = true;
                }
            } catch (e) {
                console.error("加载详情失败", e);
            } finally {
                this.loading = false;
            }
        },
        formatAmount(amt) {
            return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt);
        }
    }
};
