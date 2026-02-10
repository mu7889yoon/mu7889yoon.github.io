---
title: "活動見える化くん"
---

<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.15.3/dist/cdn.min.js"></script>

<style>
.heatmap-container { overflow-x: auto; }
.heatmap { display: flex; gap: 2px; }
.heatmap-week { display: flex; flex-direction: column; gap: 2px; }
.heatmap-cell { width: 12px; height: 12px; border-radius: 2px; cursor: pointer; }
.heatmap-cell:hover { outline: 1px solid #333; }
.heatmap-months { display: flex; font-size: 11px; color: #666; margin-bottom: 4px; padding-left: 32px; }
.heatmap-days { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #666; margin-right: 4px; }
.heatmap-days span { height: 12px; line-height: 12px; }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 12px; color: #666; margin-top: 8px; }
.legend-cell { width: 12px; height: 12px; border-radius: 2px; }
.tooltip { position: fixed; background: #1f1f1f; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 100; }
</style>

<div x-data="progressVisualizer()" x-init="init()">
  <div style="margin-bottom: 1rem;">
    <label>期間選択</label><br>
    <select x-model="year" @change="render()">
      <template x-for="y in years" :key="y">
        <option :value="y" x-text="y + '年'"></option>
      </template>
    </select>
  </div>

  <div x-show="loading" style="color: #666;">読み込み中...</div>
  <div x-show="error" x-text="error" style="color: #b00020;"></div>

  <div class="heatmap-months" x-html="monthsHtml"></div>
  <div style="display: flex;">
    <div class="heatmap-days">
      <span></span><span>月</span><span></span><span>水</span><span></span><span>金</span><span></span>
    </div>
    <div class="heatmap-container">
      <div class="heatmap" x-html="heatmapHtml" @mouseover="showTooltip($event)" @mouseout="hideTooltip()"></div>
    </div>
  </div>

  <div class="legend">
    <div class="legend-cell" style="background:#ebedf0;"></div><span style="margin-right:8px;">なし</span>
    <div class="legend-cell" style="background:#4CAF50;"></div><span style="margin-right:8px;">個人ブログ</span>
    <div class="legend-cell" style="background:#FF9800;"></div><span style="margin-right:8px;">会社ブログ</span>
    <div class="legend-cell" style="background:#2196F3;"></div><span style="margin-right:8px;">LT/登壇</span>
    <div class="legend-cell" style="background:#9C27B0;"></div><span style="margin-right:8px;">運営</span>
    <div class="legend-cell" style="background:#607D8B;"></div><span>その他</span>
  </div>

  <div style="margin-top: 1rem;"><strong>合計:</strong> <span x-text="totalCount"></span> 件</div>
  <div x-ref="tooltip" class="tooltip" x-show="tooltipVisible" x-html="tooltipContent" :style="tooltipStyle"></div>
</div>

<script>
function progressVisualizer() {
  const TYPE_COLORS = { blog: '#4CAF50', 'seeds-blog': '#FF9800', lt: '#2196F3', organizer: '#9C27B0', other: '#607D8B' };
  const TYPE_LABELS = { blog: '個人ブログ', 'seeds-blog': '会社ブログ', lt: 'LT/登壇', organizer: 'コミュニティ運営', other: 'その他' };
  const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const START_YEAR = 2024;
  const CURRENT_YEAR = new Date().getFullYear();

  const toDateStr = d => d.toISOString().split('T')[0];

  const getCellStyle = types => {
    if (!types.length) return 'background:#ebedf0;';
    const unique = [...new Set(types)];
    if (unique.length === 1) return 'background:' + TYPE_COLORS[unique[0]] + ';';
    const grad = unique.map((t, i) => {
      const p1 = (i / unique.length * 100).toFixed(0);
      const p2 = ((i + 1) / unique.length * 100).toFixed(0);
      return TYPE_COLORS[t] + ' ' + p1 + '%,' + TYPE_COLORS[t] + ' ' + p2 + '%';
    }).join(',');
    return 'background:linear-gradient(135deg,' + grad + ');';
  };

  return {
    loading: false,
    error: '',
    year: CURRENT_YEAR,
    years: Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => CURRENT_YEAR - i),
    allData: [],
    totalCount: 0,
    monthsHtml: '',
    heatmapHtml: '',
    tooltipVisible: false,
    tooltipContent: '',
    tooltipStyle: '',

    async init() {
      await this.loadData();
      this.render();
    },

    async loadData() {
      this.loading = true;
      try {
        const [blogRes, outputRes] = await Promise.all([
          fetch('/index.xml').then(r => r.text()),
          fetch('/data/output.jsonl').then(r => r.text()).catch(() => '')
        ]);
        this.allData = [...this.parseBlogXml(blogRes), ...this.parseJsonl(outputRes)];
      } catch (e) {
        this.error = 'データの読み込みに失敗: ' + e.message;
      }
      this.loading = false;
    },

    parseBlogXml(xml) {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return [...doc.querySelectorAll('item')].map(item => {
        const pubDate = item.querySelector('pubDate');
        return pubDate ? { date: toDateStr(new Date(pubDate.textContent)), type: 'blog' } : null;
      }).filter(Boolean);
    },

    parseJsonl(text) {
      if (!text.trim()) return [];
      return text.trim().split('\n').map(line => {
        try {
          const obj = JSON.parse(line);
          return obj.date && obj.type ? { date: obj.date.split('T')[0], type: obj.type } : null;
        } catch { return null; }
      }).filter(Boolean);
    },

    render() {
      const start = new Date(this.year, 0, 1);
      const end = new Date(this.year, 11, 31);

      // 日付ごとにデータを集計
      const byDate = {};
      this.allData.forEach(item => {
        const d = new Date(item.date);
        if (d >= start && d <= end) {
          (byDate[item.date] ||= []).push(item.type);
        }
      });

      // 週の開始（日曜）に調整
      const current = new Date(start);
      current.setDate(current.getDate() - current.getDay());

      let weeks = [], monthPositions = [], lastMonth = -1, total = 0;

      while (current <= end || current.getDay() !== 0) {
        let weekHtml = '<div class="heatmap-week">';
        for (let d = 0; d < 7; d++) {
          const dateStr = toDateStr(current);
          const inRange = current >= start && current <= end;
          const types = inRange ? (byDate[dateStr] || []) : [];

          if (inRange && current.getMonth() !== lastMonth) {
            monthPositions.push({ month: current.getMonth(), week: weeks.length });
            lastMonth = current.getMonth();
          }

          const style = inRange ? getCellStyle(types) : 'background:transparent;';
          total += types.length;
          weekHtml += `<div class="heatmap-cell" style="${style}" data-date="${dateStr}" data-types="${types.join(',')}"></div>`;
          current.setDate(current.getDate() + 1);
        }
        weeks.push(weekHtml + '</div>');
        if (current > end && current.getDay() === 0) break;
      }

      // 月ラベル
      this.monthsHtml = monthPositions.map((pos, i) => {
        const next = monthPositions[i + 1];
        const width = (next ? next.week - pos.week : 4) * 14;
        return `<span style="width:${width}px">${MONTHS[pos.month]}</span>`;
      }).join('');

      this.heatmapHtml = weeks.join('');
      this.totalCount = total;
    },

    showTooltip(e) {
      const cell = e.target.closest('.heatmap-cell');
      if (!cell) return;

      const date = cell.dataset.date;
      const types = cell.dataset.types ? cell.dataset.types.split(',').filter(Boolean) : [];
      let content = `${date}: ${types.length}件`;

      if (types.length) {
        const counts = types.reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {});
        content += '<br>' + Object.entries(counts).map(([t, c]) => `${TYPE_LABELS[t] || t}: ${c}`).join('<br>');
      }

      this.tooltipContent = content;
      this.tooltipStyle = `left:${e.clientX + 12}px;top:${e.clientY + 12}px`;
      this.tooltipVisible = true;
    },

    hideTooltip() {
      this.tooltipVisible = false;
    }
  };
}
</script>
