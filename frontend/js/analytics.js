/**
 * CrisisConnect Analytics Dashboard Logic
 * Manages global data visualization, time-range filtering, 
 * and severity calendar heatmap generation.
 */

// Global Chart Defaults
Chart.defaults.color = '#A08870';
Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(14, 9, 5, 0.9)';
Chart.defaults.plugins.tooltip.titleFont = { family: 'Rajdhani', size: 14 };
Chart.defaults.plugins.tooltip.bodyFont = { family: 'Share Tech Mono', size: 13 };
Chart.defaults.plugins.tooltip.borderColor = '#2B1B10';
Chart.defaults.plugins.tooltip.borderWidth = 1;

let lineChart, barChart, pieChart;
let totalPieCount = 0;

// Center Text Plugin Hook for Doughnut
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw: function(chart) {
    if (chart.config.type !== 'doughnut') return;
    let w = chart.width, h = chart.height, ctx = chart.ctx;
    ctx.restore();
    
    let fontSize = (h / 8).toFixed(2);
    ctx.font = `bold ${fontSize}px "Share Tech Mono"`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    let text = totalPieCount.toString(),
        textX = Math.round((w - ctx.measureText(text).width) / 2),
        textY = h / 2;
    ctx.fillText(text, textX, textY);
    
    ctx.font = `bold ${(h / 18).toFixed(2)}px "Rajdhani"`;
    ctx.fillStyle = "#FF5500";
    let lText = "TOTAL";
    let lTextX = Math.round((w - ctx.measureText(lText).width) / 2);
    ctx.fillText(lText, lTextX, textY - (fontSize/2) - 5);
    ctx.save();
  }
};
Chart.register(centerTextPlugin);

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initTimestamp();
    generateRandomDataUpdate(365); // Default 1 Year
});

function initFilters() {
    const pills = document.querySelectorAll('.filter-bar .pill-btn');
    pills.forEach(btn => {
      btn.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        
        const filterVal = btn.dataset.days;
        let days = 365;
        if(filterVal !== 'all') days = parseInt(filterVal);
        else days = 500;

        generateRandomDataUpdate(days);
      });
    });
}

function generateRandomDataUpdate(timeFactor) {
    const mul = timeFactor / 365; 

    // 1. Stat Cards
    const totalEv = Math.floor(142 * mul) + Math.floor(Math.random()*15);
    const affNum = (4.2 * mul).toFixed(1);
    
    document.getElementById('st-total').innerText = totalEv;
    document.getElementById('st-people').innerText = affNum + 'M';
    document.getElementById('st-countries').innerText = Math.max(1, Math.floor(34 * Math.max(0.2, mul)));
    document.getElementById('st-sev').innerText = (3.0 + Math.random()*0.8).toFixed(1);

    // 2. Line Chart
    updateLineChart(mul);

    // 3. Bar Chart
    updateBarChart(mul);

    // 4. Doughnut Chart
    updatePieChart(mul);

    // 5. Calendar Grid
    updateCalendarGrid(timeFactor);
}

function updateLineChart(mul) {
    const mLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mDataTot = [], mDataCrit = [];
    for(let i=0; i<12; i++) {
        const t = Math.floor((Math.random()*15 + 5) * mul);
        mDataTot.push(t);
        mDataCrit.push(Math.floor(t * (0.1 + Math.random()*0.2)));
    }

    if(lineChart) {
        lineChart.data.datasets[0].data = mDataTot;
        lineChart.data.datasets[1].data = mDataCrit;
        lineChart.update();
    } else {
        const ctxL = document.getElementById('lineChart').getContext('2d');
        lineChart = new Chart(ctxL, {
          type: 'line',
          data: {
            labels: mLabels,
            datasets: [
              {
                label: 'Total Events',
                data: mDataTot,
                borderColor: '#FF5500',
                backgroundColor: 'rgba(255, 85, 0, 0.15)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: '#0a0e1a',
                pointBorderColor: '#FF5500'
              },
              {
                label: 'Critical / Catastrophic',
                data: mDataCrit,
                borderColor: '#ff3b3b',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                borderDash: [5, 5],
                pointBackgroundColor: '#0a0e1a',
                pointBorderColor: '#ff3b3b'
              }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              y: { grid: { color: '#2B1B10' }, beginAtZero: true },
              x: { grid: { color: '#2B1B10' } }
            },
            plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true } } }
          }
        });
    }
}

function updateBarChart(mul) {
    const cList = ['Philippines','Bangladesh','Indonesia','Türkiye','Japan','Mozambique','Pakistan','Peru','USA','India'];
    const cVals = [];
    let baseCountry = 800000 * mul;
    for(let i=0; i<10; i++) {
        cVals.push(Math.floor(baseCountry));
        baseCountry *= (0.7 + Math.random()*0.1); 
    }
    
    const barColors = cVals.map((v, i) => {
        const pct = i / 9;
        const r1 = 255, g1 = 59, b1 = 59;
        const r2 = 255, g2 = 179, b2 = 64;
        const rr = Math.round(r1 + (r2-r1)*pct);
        const rg = Math.round(g1 + (g2-g1)*pct);
        const rb = Math.round(b1 + (b2-b1)*pct);
        return `rgba(${rr},${rg},${rb},0.9)`;
    });

    if(barChart) {
        barChart.data.datasets[0].data = cVals;
        barChart.data.datasets[0].backgroundColor = barColors;
        barChart.update();
    } else {
        const ctxB = document.getElementById('barChart').getContext('2d');
        barChart = new Chart(ctxB, {
          type: 'bar',
          data: {
            labels: cList,
            datasets: [{
              label: 'Affected Population',
              data: cVals,
              backgroundColor: barColors,
              borderRadius: 4,
              borderWidth: 0
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: '#2B1B10' }, ticks: { callback: (v)=> (v/1000)+'k' } },
              y: { grid: { display: false } }
            }
          }
        });
    }
}

function updatePieChart(mul) {
    const pieT = ['Flood','Earthquake','Wildfire','Cyclone','Heatwave','Other'];
    const pieD = [
        Math.floor(45*mul), Math.floor(30*mul), Math.floor(22*mul), 
        Math.floor(18*mul), Math.floor(15*mul), Math.floor(12*mul)
    ];
    totalPieCount = pieD.reduce((a,b)=>a+b, 0);

    if(pieChart) {
        pieChart.data.datasets[0].data = pieD;
        pieChart.update();
    } else {
        const ctxP = document.getElementById('pieChart').getContext('2d');
        pieChart = new Chart(ctxP, {
          type: 'doughnut',
          data: {
            labels: pieT,
            datasets: [{
              data: pieD,
              backgroundColor: ['#FF5500', '#ff3b3b', '#ffb340', '#9c27b0', '#ff8800', '#5c6bc0'],
              borderWidth: 1, borderColor: '#0a0e1a',
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 16 } } }
          }
        });
    }
}

function updateCalendarGrid(timeFactor) {
    const calGrid = document.getElementById('cal-grid');
    let cellsHtml = '';
    const now = new Date();
    now.setUTCHours(0,0,0,0);
    const oneYearAgo = new Date(now);
    oneYearAgo.setUTCDate(now.getUTCDate() - 364);

    for(let i=0; i<364; i++) {
        const curDate = new Date(oneYearAgo);
        curDate.setUTCDate(oneYearAgo.getUTCDate() + i);
        const iso = curDate.toISOString().split('T')[0];
        let sev = 0;
        const rDrop = Math.random();
        
        if (timeFactor < 300 && i < (364 - timeFactor)) {
           sev = 0;
        } else {
          if (rDrop > 0.95) sev = 5;
          else if (rDrop > 0.88) sev = 4;
          else if (rDrop > 0.70) sev = 3;
          else if (rDrop > 0.40) sev = Math.floor(Math.random()*2)+1;
        }
        const clsStr = sev === 0 ? 'sev-0' : (sev <= 2 ? 'sev-1' : `sev-${sev}`);
        const tipStr = `Date: ${iso}\nSeverity Level: ${sev}`;
        cellsHtml += `<div class="cal-cell ${clsStr}" title="${tipStr}"></div>`;
    }
    calGrid.innerHTML = cellsHtml;
}

function initTimestamp() {
    const ts = document.getElementById('timestamp');
    function update() {
      const d = new Date();
      const p = n => n.toString().padStart(2, '0');
      ts.innerText = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
    }
    setInterval(update, 1000);
    update();
}
