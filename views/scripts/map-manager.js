// views/scripts/map-manager.js

class MapManager {
    constructor() {
        this.chart = null;
        this.isInitialized = false;
    }

    async initialize(opportunityType = '') {
        const mapContainer = document.getElementById('taiwan-map-container');
        if (!mapContainer) return;

        const render = async () => {
            if (typeof Highcharts !== 'undefined' && Highcharts.maps && Highcharts.maps['countries/tw/tw-all']) {
                await this.fetchAndRender(opportunityType);
            } else {
                mapContainer.innerHTML = `<div class="alert alert-error">地圖資料庫載入失敗。</div>`;
            }
        };
        // 確保 Highcharts 函式庫已載入
        if (typeof Highcharts === 'undefined') {
            setTimeout(render, 500);
        } else {
            await render();
        }
    }

    async update(opportunityType = '') {
        if (!this.isInitialized) {
            await this.initialize(opportunityType);
        } else {
            await this.fetchAndUpdateSeries(opportunityType);
        }
    }

    async fetchAndRender(opportunityType = '') {
        const mapContainer = document.getElementById('taiwan-map-container');
        try {
            const seriesData = await this.fetchMapData(opportunityType);
            const maxValue = Math.max(0, ...seriesData.map(d => d.value).filter(v => typeof v === 'number'));
            mapContainer.innerHTML = '';

            const themeOptions = getHighchartsThemeOptions();
            const originalMapData = Highcharts.maps['countries/tw/tw-all'];
            const mainIslandMap = JSON.parse(JSON.stringify(originalMapData));
            mainIslandMap.features = mainIslandMap.features.filter(feature => !['Penghu', 'Kinmen', 'Lienchiang'].includes(feature.properties.name));

            this.chart = Highcharts.mapChart(mapContainer, {
                ...themeOptions,
                chart: { ...themeOptions.chart, map: mainIslandMap, margin: [0, 0, 0, 0] },
                title: { text: '' },
                mapNavigation: { enabled: false },
                colorAxis: {
                    min: 0,
                    max: maxValue > 0 ? maxValue : 1,
                    minColor: '#dcfce7',
                    maxColor: '#166534'
                },
                legend: {
                    ...themeOptions.legend,
                    layout: 'vertical',
                    align: 'right',
                    verticalAlign: 'middle',
                    y: 70,
                    floating: true,
                    padding: 4,
                    symbolHeight: 100,
                    title: { ...themeOptions.legend.title, text: '機會數' }
                },
                series: [{
                    data: seriesData,
                    name: '機會案件數量',
                    states: { hover: { color: '#dc2626' } },
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    dataLabels: { enabled: false }
                }],
                tooltip: {
                    ...themeOptions.tooltip,
                    formatter: function() { 
                        return `<b>${this.point.chineseName}</b><br/>機會案件：<b>${this.point.value}</b> 件`; 
                    }
                }
            });
            this.isInitialized = true;
        } catch (error) {
            mapContainer.innerHTML = `<div class="alert alert-error"><strong>地圖載入失敗</strong><br/>${error.message}</div>`;
        }
    }

    async fetchAndUpdateSeries(opportunityType = '') {
        try {
            const seriesData = await this.fetchMapData(opportunityType);
            if (this.chart) {
                const maxValue = Math.max(0, ...seriesData.map(d => d.value).filter(v => typeof v === 'number'));
                this.chart.colorAxis[0].update({ max: maxValue > 0 ? maxValue : 1 });
                this.chart.series[0].setData(seriesData, true);
            }
        } catch (error) {
            showNotification('地圖資料更新失敗', 'error');
        }
    }

    async fetchMapData(opportunityType = '') {
        const apiUrl = opportunityType ? `/api/opportunities/by-county?opportunityType=${encodeURIComponent(opportunityType)}` : '/api/opportunities/by-county';
        const countyData = await authedFetch(apiUrl);
        const countyCountMap = new Map();
        countyData.forEach(item => {
            if(item.county) {
                countyCountMap.set(item.county.trim().replace(/台/g, '臺'), item.count);
            }
        });
        const mapSource = Highcharts.maps['countries/tw/tw-all'];
        const mainIslandFeatures = mapSource.features.filter(feature => !['Penghu', 'Kinmen', 'Lienchiang'].includes(feature.properties.name));
        const countyNameMap = { 'Taipei City': '臺北市', 'New Taipei City': '新北市', 'Taoyuan': '桃園市', 'Taichung City': '臺中市', 'Tainan City': '臺南市', 'Kaohsiung City': '高雄市', 'Keelung City': '基隆市', 'Hsinchu City': '新竹市', 'Chiayi City': '嘉義市', 'Hsinchu': '新竹縣', 'Miaoli': '苗栗縣', 'Changhua': '彰化縣', 'Nantou': '南投縣', 'Yunlin': '雲林縣', 'Chiayi': '嘉義縣', 'Pingtung': '屏東縣', 'Yilan': '宜蘭縣', 'Hualien': '花蓮縣', 'Taitung': '臺東縣' };
        
        return mainIslandFeatures.map(feature => {
            const englishName = feature.properties.name;
            const chineseName = countyNameMap[englishName] || englishName;
            return { 'hc-key': feature.properties['hc-key'], value: countyCountMap.get(chineseName) || 0, chineseName };
        });
    }
}

// 建立全域實例
window.mapManager = new MapManager();