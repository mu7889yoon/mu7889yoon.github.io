(() => {
  const TYPE_COLORS = {
    blog: '#4CAF50',
    'seeds-blog': '#FF9800',
    lt: '#2196F3',
    organizer: '#9C27B0',
    other: '#607D8B'
  };
  const TYPE_LABELS = {
    blog: '個人ブログ',
    'seeds-blog': '会社ブログ',
    lt: 'LT/登壇',
    organizer: 'コミュニティ運営',
    other: 'その他'
  };
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const JST_DATE_FORMATTER = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });

  const toDateString = date => JST_DATE_FORMATTER.format(date);

  const cellBackground = types => {
    const uniqueTypes = [...new Set(types)].filter(type => TYPE_COLORS[type]);
    if (!uniqueTypes.length) return '';
    if (uniqueTypes.length === 1) return TYPE_COLORS[uniqueTypes[0]];

    const stops = uniqueTypes.map((type, index) => {
      const start = Math.round(index / uniqueTypes.length * 100);
      const end = Math.round((index + 1) / uniqueTypes.length * 100);
      return `${TYPE_COLORS[type]} ${start}%, ${TYPE_COLORS[type]} ${end}%`;
    });
    return `linear-gradient(135deg, ${stops.join(', ')})`;
  };

  const parseBlogFeed = xml => {
    const documentNode = new DOMParser().parseFromString(xml, 'text/xml');
    return [...documentNode.querySelectorAll('item')].map(item => {
      const publicationDate = item.querySelector('pubDate');
      return publicationDate
        ? { date: toDateString(new Date(publicationDate.textContent)), type: 'blog' }
        : null;
    }).filter(Boolean);
  };

  const parseJsonLines = text => text.trim().split('\n').map(line => {
    try {
      const item = JSON.parse(line);
      return item.date && item.type
        ? { date: item.date.substring(0, 10), type: item.type }
        : null;
    } catch {
      return null;
    }
  }).filter(Boolean);

  const render = (root, activities) => {
    const status = root.querySelector('[data-progress-status]');
    const chart = root.querySelector('[data-progress-chart]');
    const months = root.querySelector('[data-progress-months]');
    const grid = root.querySelector('[data-progress-grid]');
    const tooltip = root.querySelector('[data-progress-tooltip]');
    const currentYear = Number(toDateString(new Date()).slice(0, 4));
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    const byDate = {};

    activities.forEach(activity => {
      if (activity.date.startsWith(`${currentYear}-`)) {
        (byDate[activity.date] ||= []).push(activity.type);
      }
    });

    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - cursor.getDay());
    const weeks = [];
    const monthPositions = [];
    let lastMonth = -1;

    while (cursor <= end || cursor.getDay() !== 0) {
      const week = document.createElement('div');
      week.className = 'home-progress-week';
      week.setAttribute('role', 'row');

      for (let day = 0; day < 7; day += 1) {
        const dateString = toDateString(cursor);
        const inYear = cursor >= start && cursor <= end;
        const types = inYear ? (byDate[dateString] || []) : [];

        if (inYear && cursor.getMonth() !== lastMonth) {
          monthPositions.push({ month: cursor.getMonth(), week: weeks.length });
          lastMonth = cursor.getMonth();
        }

        const cell = document.createElement('div');
        cell.className = 'home-progress-cell';
        cell.setAttribute('role', 'gridcell');
        cell.dataset.date = dateString;
        cell.dataset.types = types.join(',');
        cell.dataset.hasActivity = String(types.length > 0);

        if (!inYear) {
          cell.style.visibility = 'hidden';
          cell.setAttribute('aria-hidden', 'true');
        } else {
          const label = `${dateString}: ${types.length}件`;
          cell.setAttribute('aria-label', label);
          cell.tabIndex = types.length ? 0 : -1;
          const background = cellBackground(types);
          if (background) cell.style.background = background;
        }

        week.appendChild(cell);
        cursor.setDate(cursor.getDate() + 1);
      }

      weeks.push(week);
      if (cursor > end && cursor.getDay() === 0) break;
    }

    monthPositions.forEach((position, index) => {
      const nextPosition = monthPositions[index + 1];
      const label = document.createElement('span');
      label.style.width = `${(nextPosition ? nextPosition.week - position.week : 4) * 14}px`;
      label.textContent = MONTHS[position.month];
      months.appendChild(label);
    });

    grid.replaceChildren(...weeks);
    status.hidden = true;
    chart.hidden = false;

    const showTooltip = (cell, x, y) => {
      if (!cell || !cell.dataset.types) return;
      const types = cell.dataset.types.split(',').filter(Boolean);
      const counts = types.reduce((result, type) => {
        result[type] = (result[type] || 0) + 1;
        return result;
      }, {});
      const details = Object.entries(counts)
        .map(([type, count]) => `${TYPE_LABELS[type] || type}: ${count}`)
        .join('<br>');
      tooltip.innerHTML = `<strong>${cell.dataset.date}</strong><br>${details}`;
      tooltip.style.left = `${x + 12}px`;
      tooltip.style.top = `${y + 12}px`;
      tooltip.hidden = false;
    };

    grid.addEventListener('pointerover', event => {
      const cell = event.target.closest('.home-progress-cell[data-has-activity="true"]');
      showTooltip(cell, event.clientX, event.clientY);
    });
    grid.addEventListener('pointermove', event => {
      if (!tooltip.hidden) {
        tooltip.style.left = `${event.clientX + 12}px`;
        tooltip.style.top = `${event.clientY + 12}px`;
      }
    });
    grid.addEventListener('pointerout', () => { tooltip.hidden = true; });
    grid.addEventListener('focusin', event => {
      const cell = event.target.closest('.home-progress-cell[data-has-activity="true"]');
      if (!cell) return;
      const bounds = cell.getBoundingClientRect();
      showTooltip(cell, bounds.right, bounds.bottom);
    });
    grid.addEventListener('focusout', () => { tooltip.hidden = true; });
  };

  const initialize = async root => {
    const status = root.querySelector('[data-progress-status]');
    try {
      const [feedResponse, activityResponse] = await Promise.all([
        fetch('/index.xml'),
        fetch('/data/output.jsonl').catch(() => null)
      ]);
      if (!feedResponse.ok) throw new Error(`HTTP ${feedResponse.status}`);
      const [feed, activityData] = await Promise.all([
        feedResponse.text(),
        activityResponse && activityResponse.ok ? activityResponse.text() : ''
      ]);
      render(root, [...parseBlogFeed(feed), ...parseJsonLines(activityData)]);
    } catch {
      status.textContent = '活動データを読み込めませんでした。';
    }
  };

  document.querySelectorAll('[data-progress-heatmap]').forEach(initialize);
})();
