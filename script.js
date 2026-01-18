// Global variables
let csvData = null;
let chart = null;
let analysisResults = {};
let exxEyyChart = null;

// DOM Elements
const csvFileInput = document.getElementById('csvFile');
const fileInfo = document.getElementById('fileInfo');
const controlsSection = document.getElementById('controlsSection');
const chartContainer = document.getElementById('chartContainer');
const plotBtn = document.getElementById('plotBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const offsetStrainInput = document.getElementById('offsetStrain');

// Graph Sheet Elements
const generateGraphBtn = document.getElementById('generateGraphBtn');
const downloadGraphPdfBtn = document.getElementById('downloadGraphPdfBtn');
const downloadGraphImageBtn = document.getElementById('downloadGraphImageBtn');
const graphCanvas = document.getElementById('graphCanvas');
const graphContainer = document.getElementById('graphContainer');
const graphScaleXInput = document.getElementById('graphScaleX');
const graphScaleYInput = document.getElementById('graphScaleY');

// Exx-Eyy Elements
const generateExxEyyBtn = document.getElementById('generateExxEyyBtn');
const downloadExxEyyBtn = document.getElementById('downloadExxEyyBtn');
const exxEyyContainer = document.getElementById('exxEyyContainer');
const exxEyyCanvas = document.getElementById('exxEyyChart');

// Tab Navigation Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const viewContents = document.querySelectorAll('.view-content');

// Event Listeners
csvFileInput.addEventListener('change', handleFileUpload);
plotBtn.addEventListener('click', generatePlot);
downloadBtn.addEventListener('click', downloadPlot);
fullscreenBtn.addEventListener('click', openFullscreen);

// Graph Sheet Event Listeners
generateGraphBtn.addEventListener('click', generateGraphSheet);
downloadGraphPdfBtn.addEventListener('click', downloadGraphPdf);
downloadGraphImageBtn.addEventListener('click', downloadGraphImage);

// Exx-Eyy Event Listeners
generateExxEyyBtn.addEventListener('click', generateExxEyyPlot);
downloadExxEyyBtn.addEventListener('click', downloadExxEyyPlot);

// Tab Navigation Event Listeners
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        // Remove active class from all buttons and views
        tabBtns.forEach(b => b.classList.remove('active'));
        viewContents.forEach(v => v.classList.remove('active'));
        
        // Add active class to clicked button and corresponding view
        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// File Upload Handler
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        csvData = parseCSV(text);
        
        if (csvData && csvData.length > 0) {
            fileInfo.textContent = `✓ File loaded successfully: ${file.name} (${csvData.length} data points)`;
            fileInfo.classList.add('show');
            controlsSection.style.display = 'block';
            
            // Show graph container for graph sheet view
            graphContainer.style.display = 'block';
            
            // Show exx-eyy container if exx and eyy data exists
            if (csvData[0].exx !== undefined && csvData[0].eyy !== undefined) {
                exxEyyContainer.style.display = 'block';
            }
        } else {
            alert('Error: Could not parse CSV file. Please ensure it has either (strain and stress) or (exx and eyy) columns.');
        }
    };
    reader.readAsText(file);
}

// Parse CSV Data
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const data = [];
    
    // Parse header to detect column format
    const header = lines[0].toLowerCase();
    const hasExxEyy = header.includes('exx') && header.includes('eyy');
    const hasStressStrain = header.includes('stress') || header.includes('strain');
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 2) {
            let strain, stress, exx, eyy;
            
            if (hasExxEyy && hasStressStrain) {
                // CSV with both stress/strain and exx/eyy columns
                if (values.length >= 5) {
                    // Format: Point, Stress, Strain, exx, eyy
                    stress = parseFloat(values[1]);
                    strain = parseFloat(values[2]);
                    exx = parseFloat(values[3]);
                    eyy = parseFloat(values[4]);
                } else if (values.length >= 4) {
                    // Format: Stress, Strain, exx, eyy
                    stress = parseFloat(values[0]);
                    strain = parseFloat(values[1]);
                    exx = parseFloat(values[2]);
                    eyy = parseFloat(values[3]);
                }
            } else if (hasExxEyy) {
                // CSV with only exx and eyy columns
                if (values.length >= 3) {
                    // Format: Point, exx, eyy
                    exx = parseFloat(values[1]);
                    eyy = parseFloat(values[2]);
                } else if (values.length >= 2) {
                    // Format: exx, eyy
                    exx = parseFloat(values[0]);
                    eyy = parseFloat(values[1]);
                }
                // Use exx and eyy as strain and stress for compatibility
                if (!isNaN(exx) && !isNaN(eyy)) {
                    strain = exx;
                    stress = eyy;
                }
            } else {
                // Original format - only stress and strain
                if (values.length >= 3) {
                    // 3 columns: Point, Stress, Strain
                    stress = parseFloat(values[1]);
                    strain = parseFloat(values[2]);
                } else {
                    // 2 columns: Strain, Stress
                    strain = parseFloat(values[0]);
                    stress = parseFloat(values[1]);
                }
            }
            
            // Convert negative strain values to positive
            if (!isNaN(strain) && strain < 0) {
                strain = Math.abs(strain);
            }
            
            // Create point with available data
            const point = {};
            
            if (!isNaN(strain) && !isNaN(stress)) {
                point.strain = strain;
                point.stress = stress;
            }
            
            if (!isNaN(exx) && !isNaN(eyy)) {
                point.exx = exx;
                point.eyy = eyy;
            }
            
            // Add point if it has at least one valid dataset
            if ((point.strain !== undefined && point.stress !== undefined) || 
                (point.exx !== undefined && point.eyy !== undefined)) {
                data.push(point);
            }
        }
    }
    
    return data;
}

// Calculate Yield Strength using Offset Method
function calculateYieldStrength(data, offsetPercent) {
    // Convert offset percentage to decimal
    const offset = offsetPercent / 100;
    
    // Calculate elastic modulus as slope of line joining 2nd and 3rd points
    const elasticModulus = (data[2].stress - data[1].stress) / (data[2].strain - data[1].strain);
    
    // Offset line equation: stress = elasticModulus * (strain - offset)
    // Find where offset line intersects the stress-strain curve
    
    // Iterate through consecutive point pairs to find intersection
    for (let i = 1; i < data.length; i++) {
        const p1 = data[i - 1];  // Previous point
        const p2 = data[i];      // Current point
        
        // Calculate offset line stress values at both points
        const offsetStress1 = elasticModulus * (p1.strain - offset);
        const offsetStress2 = elasticModulus * (p2.strain - offset);
        
        // Calculate difference between curve and offset line at both points
        const diff1 = p1.stress - offsetStress1;
        const diff2 = p2.stress - offsetStress2;
        
        // Check if offset line crosses the curve between these two points
        // (one point is below the line, the other is above, or at the line)
        if ((diff1 <= 0 && diff2 >= 0) || (diff1 >= 0 && diff2 <= 0)) {
            // Found the segment where intersection occurs
            // Now calculate exact intersection point using line-line intersection
            
            // Curve segment equation: stress = m1 * (strain - p1.strain) + p1.stress
            // where m1 is the slope of the curve segment
            const m1 = (p2.stress - p1.stress) / (p2.strain - p1.strain);
            
            // Offset line equation: stress = m2 * (strain - offset)
            // where m2 is the elastic modulus
            const m2 = elasticModulus;
            
            // Setting them equal to find intersection:
            // m1 * (strain - p1.strain) + p1.stress = m2 * (strain - offset)
            // m1 * strain - m1 * p1.strain + p1.stress = m2 * strain - m2 * offset
            // strain * (m1 - m2) = m1 * p1.strain - p1.stress - m2 * offset
            // strain = (m1 * p1.strain - p1.stress - m2 * offset) / (m1 - m2)
            
            const intersectionStrain = (m1 * p1.strain - p1.stress - m2 * offset) / (m1 - m2);
            
            // Calculate stress at intersection using offset line equation
            const intersectionStress = m2 * (intersectionStrain - offset);
            
            return { 
                strain: intersectionStrain, 
                stress: intersectionStress, 
                index: i // Reference index for context
            };
        }
    }
    
    // If no intersection found in the data range, return null
    return null;
}

// Find Ultimate Tensile Strength (maximum stress)
function findUTS(data) {
    let maxStress = -Infinity;
    let utsPoint = null;
    
    data.forEach((point, index) => {
        if (point.stress > maxStress) {
            maxStress = point.stress;
            utsPoint = { ...point, index };
        }
    });
    
    return utsPoint;
}

// Find Fracture Point (last data point or where stress drops significantly)
function findFracturePoint(data, utsPoint) {
    // Start from UTS and find where stress drops significantly
    let fracturePoint = { ...data[data.length - 1], index: data.length - 1 };
    
    // Alternative: find the last significant point before a large drop
    const threshold = utsPoint.stress * 0.7; // 70% of UTS
    
    for (let i = utsPoint.index; i < data.length - 1; i++) {
        if (data[i].stress < threshold) {
            break;
        }
        fracturePoint = { ...data[i], index: i };
    }
    
    // Use the last data point if it's significant
    fracturePoint = { ...data[data.length - 1], index: data.length - 1 };
    
    return fracturePoint;
}

// Generate Plot
function generatePlot() {
    if (!csvData) {
        alert('Please upload a CSV file first.');
        return;
    }
    
    const offsetPercent = parseFloat(offsetStrainInput.value);
    
    // Calculate key points
    const yieldPoint = calculateYieldStrength(csvData, offsetPercent);
    const utsPoint = findUTS(csvData);
    const fracturePoint = findFracturePoint(csvData, utsPoint);
    
    // Store results
    analysisResults = {
        yieldPoint,
        utsPoint,
        fracturePoint,
        offsetPercent
    };
    
    // Display results
    displayResults();
    
    // Create chart
    createChart();
    
    // Show chart container
    chartContainer.style.display = 'block';
    
    // Scroll to chart
    chartContainer.scrollIntoView({ behavior: 'smooth' });
}

// Display Analysis Results
function displayResults() {
    const resultsInfo = document.getElementById('resultsInfo');
    const { yieldPoint, utsPoint, fracturePoint } = analysisResults;
    
    resultsInfo.innerHTML = `
        <div class="result-item">
            <span class="result-label">Yield Strength (${offsetStrainInput.value}% offset):</span>
            <span class="result-value">${yieldPoint.stress.toFixed(6)} MPa at ${yieldPoint.strain.toFixed(6)} strain</span>
        </div>
        <div class="result-item">
            <span class="result-label">Ultimate Tensile Strength (UTS):</span>
            <span class="result-value">${utsPoint.stress.toFixed(6)} MPa at ${utsPoint.strain.toFixed(6)} strain</span>
        </div>
        <div class="result-item">
            <span class="result-label">Fracture Point:</span>
            <span class="result-value">${fracturePoint.stress.toFixed(6)} MPa at ${fracturePoint.strain.toFixed(6)} strain</span>
        </div>
        <div class="result-item">
            <span class="result-label">Total Data Points:</span>
            <span class="result-value">${csvData.length}</span>
        </div>
    `;
}

// Create Chart with Chart.js
function createChart() {
    const ctx = document.getElementById('stressStrainChart').getContext('2d');
    
    // Destroy previous chart if exists
    if (chart) {
        chart.destroy();
    }
    
    const { yieldPoint, utsPoint, fracturePoint } = analysisResults;
    
    // Prepare data
    const strainData = csvData.map(d => d.strain); // Direct strain values
    const stressData = csvData.map(d => d.stress);
    
    // Calculate offset line for visualization
    const offsetLine = calculateOffsetLine();
    
    // Create chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: strainData,
            datasets: [
                {
                    label: 'Stress-Strain Curve',
                    data: stressData,
                    borderColor: '#2c3e50',
                    backgroundColor: 'rgba(44, 62, 80, 0.1)',
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 5,
                    tension: 9,
                    fill: false
                },
                {
                    label: `${offsetStrainInput.value}% Offset Line`,
                    data: offsetLine,
                    borderColor: '#e74c3c',
                    borderWidth: 2,
                    borderDash: [10, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Yield Strength',
                    data: [{ x: yieldPoint.strain, y: yieldPoint.stress }],
                    pointBackgroundColor: '#f39c12',
                    pointBorderColor: '#000',
                    pointBorderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    showLine: false
                },
                {
                    label: 'Ultimate Tensile Strength',
                    data: [{ x: utsPoint.strain, y: utsPoint.stress }],
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#000',
                    pointBorderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    showLine: false
                },
                {
                    label: 'Fracture Point',
                    data: [{ x: fracturePoint.strain, y: fracturePoint.stress }],
                    pointBackgroundColor: '#9b59b6',
                    pointBorderColor: '#000',
                    pointBorderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Stress-Strain Curve - Aluminium Tensile Test',
                    font: {
                        size: 20,
                        weight: 'bold'
                    },
                    padding: 20
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(6) + ' MPa';
                            }
                            return label;
                        },
                        title: function(context) {
                            return 'Strain: ' + context[0].parsed.x.toFixed(6);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Strain',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 10
                    },
                    grid: {
                        display: true,
                        color: '#e0e0e0',
                        lineWidth: 1
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return value.toFixed(6);
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Stress (MPa)',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 10
                    },
                    min: 0,
                    max: utsPoint.stress * 1.05, // Set max to 5% above UTS
                    grid: {
                        display: true,
                        color: '#e0e0e0',
                        lineWidth: 1
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return value.toFixed(6);
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'scaleIndicator',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                
                // Calculate scale (stress per unit strain)
                const xScale = chart.scales.x;
                const yScale = chart.scales.y;
                
                const xRange = xScale.max - xScale.min;
                const yRange = yScale.max - yScale.min;
                
                const xPixels = chartArea.right - chartArea.left;
                const yPixels = chartArea.bottom - chartArea.top;
                
                const xUnitsPerPixel = xRange / xPixels;
                const yUnitsPerPixel = yRange / yPixels;
                
                // Draw projection lines for key points
                const points = [
                    { ...yieldPoint, color: '#f39c12', label: 'YS' },
                    { ...utsPoint, color: '#e74c3c', label: 'UTS' },
                    { ...fracturePoint, color: '#9b59b6', label: 'FP' }
                ];
                
                ctx.save();
                
                points.forEach(point => {
                    const xPos = xScale.getPixelForValue(point.strain);
                    const yPos = yScale.getPixelForValue(point.stress);
                    
                    // Draw dashed lines to axes
                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = point.color;
                    ctx.lineWidth = 1.5;
                    
                    // Vertical line to x-axis
                    ctx.beginPath();
                    ctx.moveTo(xPos, yPos);
                    ctx.lineTo(xPos, chartArea.bottom);
                    ctx.stroke();
                    
                    // Horizontal line to y-axis
                    ctx.beginPath();
                    ctx.moveTo(xPos, yPos);
                    ctx.lineTo(chartArea.left, yPos);
                    ctx.stroke();
                    
                    ctx.setLineDash([]);
                    
                    // Draw value labels on x-axis
                    ctx.fillStyle = point.color;
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${point.strain.toFixed(6)}`, xPos, chartArea.bottom + 25);
                    ctx.font = '9px Arial';
                    ctx.fillText(point.label, xPos, chartArea.bottom + 38);
                    
                    // Draw value labels on y-axis
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'right';
                    ctx.fillText(`${point.stress.toFixed(6)}`, chartArea.left - 10, yPos + 4);
                });
                
                ctx.restore();
            }
        }]
    });
}

// Calculate offset line for visualization
function calculateOffsetLine() {
    // Calculate elastic modulus as slope of line joining first two points
    const elasticModulus = (csvData[1].stress - csvData[0].stress) / (csvData[1].strain - csvData[0].strain);
    const offset = parseFloat(offsetStrainInput.value) / 100;
    
    // Generate offset line data
    const offsetLineData = [];
    const maxStrain = Math.max(...csvData.map(d => d.strain));
    
    for (let strain = offset; strain <= maxStrain; strain += maxStrain / 100) {
        const stress = elasticModulus * (strain - offset);
        if (stress >= 0) {
            offsetLineData.push({ x: strain, y: stress });
        }
    }
    
    return offsetLineData;
}

// Open Fullscreen View
function openFullscreen() {
    if (!chart) {
        alert('Please generate the plot first.');
        return;
    }
    
    const { yieldPoint, utsPoint, fracturePoint } = analysisResults;
    
    // Prepare data for new window
    const strainData = csvData.map(d => d.strain);
    const stressData = csvData.map(d => d.stress);
    const offsetLineData = calculateOffsetLine();
    
    // Create a new window
    const fullscreenWindow = window.open('', 'Stress-Strain Plot', 'width=' + screen.width + ',height=' + screen.height);
    
    // Write HTML for fullscreen view
    fullscreenWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stress-Strain Curve - Fullscreen</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: white;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden;
                }
                #chartContainer {
                    flex: 1;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                }
                #fullscreenChart {
                    flex: 1;
                    width: 100%;
                }
                .controls {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 1000;
                    display: flex;
                    gap: 10px;
                }
                button {
                    background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    font-size: 1em;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.4);
                }
                button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.5);
                }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        </head>
        <body>
            <div class="controls">
                <button onclick="downloadChart()">Download Plot</button>
                <button onclick="window.close()">Close</button>
            </div>
            <div id="chartContainer">
                <canvas id="fullscreenChart"></canvas>
            </div>
            <script>
                window.onload = function() {
                    const ctx = document.getElementById('fullscreenChart').getContext('2d');
                    
                    const strainData = ${JSON.stringify(strainData)};
                    const stressData = ${JSON.stringify(stressData)};
                    const offsetLineData = ${JSON.stringify(offsetLineData)};
                    const yieldPoint = ${JSON.stringify(yieldPoint)};
                    const utsPoint = ${JSON.stringify(utsPoint)};
                    const fracturePoint = ${JSON.stringify(fracturePoint)};
                    const offsetValue = ${offsetStrainInput.value};
                    
                    const fullChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: strainData,
                            datasets: [
                                {
                                    label: 'Stress-Strain Curve',
                                    data: stressData,
                                    borderColor: '#2c3e50',
                                    backgroundColor: 'rgba(44, 62, 80, 0.1)',
                                    borderWidth: 2,
                                    pointRadius: 1,
                                    pointHoverRadius: 5,
                                    tension: 0,
                                    fill: false
                                },
                                {
                                    label: offsetValue + '% Offset Line',
                                    data: offsetLineData,
                                    borderColor: '#e74c3c',
                                    borderWidth: 2,
                                    borderDash: [10, 5],
                                    pointRadius: 0,
                                    fill: false
                                },
                                {
                                    label: 'Yield Strength',
                                    data: [{ x: yieldPoint.strain, y: yieldPoint.stress }],
                                    pointBackgroundColor: '#f39c12',
                                    pointBorderColor: '#000',
                                    pointBorderWidth: 2,
                                    pointRadius: 8,
                                    pointHoverRadius: 10,
                                    showLine: false
                                },
                                {
                                    label: 'Ultimate Tensile Strength',
                                    data: [{ x: utsPoint.strain, y: utsPoint.stress }],
                                    pointBackgroundColor: '#e74c3c',
                                    pointBorderColor: '#000',
                                    pointBorderWidth: 2,
                                    pointRadius: 8,
                                    pointHoverRadius: 10,
                                    showLine: false
                                },
                                {
                                    label: 'Fracture Point',
                                    data: [{ x: fracturePoint.strain, y: fracturePoint.stress }],
                                    pointBackgroundColor: '#9b59b6',
                                    pointBorderColor: '#000',
                                    pointBorderWidth: 2,
                                    pointRadius: 8,
                                    pointHoverRadius: 10,
                                    showLine: false
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Stress-Strain Curve - Aluminium Tensile Test',
                                    font: { size: 20, weight: 'bold' },
                                    padding: 20
                                },
                                legend: {
                                    display: true,
                                    position: 'bottom',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 15,
                                        font: { size: 12 }
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) label += ': ';
                                            if (context.parsed.y !== null) {
                                                label += context.parsed.y.toFixed(6) + ' MPa';
                                            }
                                            return label;
                                        },
                                        title: function(context) {
                                            return 'Strain: ' + context[0].parsed.x.toFixed(6);
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    type: 'linear',
                                    title: {
                                        display: true,
                                        text: 'Strain',
                                        font: { size: 16, weight: 'bold' },
                                        padding: 10
                                    },
                                    grid: {
                                        display: true,
                                        color: '#e0e0e0',
                                        lineWidth: 1
                                    },
                                    ticks: { 
                                        font: { size: 12 },
                                        callback: function(value) {
                                            return value.toFixed(6);
                                        }
                                    }
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: 'Stress (MPa)',
                                        font: { size: 16, weight: 'bold' },
                                        padding: 10
                                    },
                                    min: 0,
                                    max: utsPoint.stress * 1.05,
                                    grid: {
                                        display: true,
                                        color: '#e0e0e0',
                                        lineWidth: 1
                                    },
                                    ticks: { 
                                        font: { size: 12 },
                                        callback: function(value) {
                                            return value.toFixed(6);
                                        }
                                    }
                                }
                            }
                        },
                        plugins: [{
                            id: 'scaleIndicator',
                            afterDraw: (chart) => {
                                const ctx = chart.ctx;
                                const chartArea = chart.chartArea;
                                const xScale = chart.scales.x;
                                const yScale = chart.scales.y;
                                const xRange = xScale.max - xScale.min;
                                const yRange = yScale.max - yScale.min;
                                const xPixels = chartArea.right - chartArea.left;
                                const yPixels = chartArea.bottom - chartArea.top;
                                const xUnitsPerPixel = xRange / xPixels;
                                const yUnitsPerPixel = yRange / yPixels;
                                
                                // Draw projection lines for key points
                                const points = [
                                    { ...yieldPoint, color: '#f39c12', label: 'YS' },
                                    { ...utsPoint, color: '#e74c3c', label: 'UTS' },
                                    { ...fracturePoint, color: '#9b59b6', label: 'FP' }
                                ];
                                
                                ctx.save();
                                
                                points.forEach(point => {
                                    const xPos = xScale.getPixelForValue(point.strain);
                                    const yPos = yScale.getPixelForValue(point.stress);
                                    
                                    // Draw dashed lines to axes
                                    ctx.setLineDash([5, 5]);
                                    ctx.strokeStyle = point.color;
                                    ctx.lineWidth = 1.5;
                                    
                                    // Vertical line to x-axis
                                    ctx.beginPath();
                                    ctx.moveTo(xPos, yPos);
                                    ctx.lineTo(xPos, chartArea.bottom);
                                    ctx.stroke();
                                    
                                    // Horizontal line to y-axis
                                    ctx.beginPath();
                                    ctx.moveTo(xPos, yPos);
                                    ctx.lineTo(chartArea.left, yPos);
                                    ctx.stroke();
                                    
                                    ctx.setLineDash([]);
                                    
                                    // Draw value labels on x-axis
                                    ctx.fillStyle = point.color;
                                    ctx.font = 'bold 11px Arial';
                                    ctx.textAlign = 'center';
                                    ctx.fillText(point.strain.toFixed(6), xPos, chartArea.bottom + 25);
                                    ctx.font = '9px Arial';
                                    ctx.fillText(point.label, xPos, chartArea.bottom + 38);
                                    
                                    // Draw value labels on y-axis
                                    ctx.font = 'bold 11px Arial';
                                    ctx.textAlign = 'right';
                                    ctx.fillText(point.stress.toFixed(6), chartArea.left - 10, yPos + 4);
                                });
                                
                                ctx.restore();
                            }
                        }]
                    });
                    
                    window.fullChart = fullChart;
                };
                
                function downloadChart() {
                    const canvas = document.getElementById('fullscreenChart');
                    const tempCanvas = document.createElement('canvas');
                    const scale = 3;
                    
                    tempCanvas.width = canvas.width * scale;
                    tempCanvas.height = canvas.height * scale;
                    
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.scale(scale, scale);
                    tempCtx.fillStyle = 'white';
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    tempCtx.drawImage(canvas, 0, 0);
                    
                    tempCanvas.toBlob(function(blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = 'stress-strain-curve-fullscreen.png';
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }, 'image/png', 1.0);
                }
            </script>
        </body>
        </html>
    `);
    
    fullscreenWindow.document.close();
}

// Download Plot as High-Quality Image
function downloadPlot() {
    if (!chart) {
        alert('Please generate the plot first.');
        return;
    }
    
    // Create a temporary canvas with higher resolution
    const originalCanvas = document.getElementById('stressStrainChart');
    const tempCanvas = document.createElement('canvas');
    const scale = 3; // 3x resolution for high quality
    
    tempCanvas.width = originalCanvas.width * scale;
    tempCanvas.height = originalCanvas.height * scale;
    
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.scale(scale, scale);
    
    // Set white background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the chart on the temporary canvas
    tempCtx.drawImage(originalCanvas, 0, 0);
    
    // Convert to blob and download
    tempCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'stress-strain-curve.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png', 1.0);
}

// ========== Graph Sheet View Functions ==========

// Generate Graph Sheet with 1mm grid
function generateGraphSheet() {
    if (!csvData) {
        alert('Please upload a CSV file first.');
        return;
    }
    
    // A4 size in mm (landscape)
    const a4WidthMM = 297;
    const a4HeightMM = 210;
    
    // High quality rendering: Use 300 DPI for print quality (1mm = 11.811 pixels at 300 DPI)
    const scale = 4; // 4x resolution for ultra-high quality
    const mmToPixel = 3.7795275591 * scale; // Base DPI scaled up
    const canvasWidth = Math.floor(a4WidthMM * mmToPixel);
    const canvasHeight = Math.floor(a4HeightMM * mmToPixel);
    
    // Set canvas size
    graphCanvas.width = canvasWidth;
    graphCanvas.height = canvasHeight;
    
    // Set display size (smaller than actual canvas for crisp rendering)
    graphCanvas.style.width = Math.floor(a4WidthMM * 3.7795275591) + 'px';
    graphCanvas.style.height = Math.floor(a4HeightMM * 3.7795275591) + 'px';
    
    const ctx = graphCanvas.getContext('2d');
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Define margins in mm
    const marginLeft = 20;
    const marginRight = 10;
    const marginTop = 20;
    const marginBottom = 20;
    
    // Calculate plot area in pixels
    const plotAreaLeft = marginLeft * mmToPixel;
    const plotAreaRight = (a4WidthMM - marginRight) * mmToPixel;
    const plotAreaTop = marginTop * mmToPixel;
    const plotAreaBottom = (a4HeightMM - marginBottom) * mmToPixel;
    const plotAreaWidth = plotAreaRight - plotAreaLeft;
    const plotAreaHeight = plotAreaBottom - plotAreaTop;
    
    // Get scales from inputs
    const scaleX = parseFloat(graphScaleXInput.value); // strain units per 10mm
    const scaleY = parseFloat(graphScaleYInput.value); // stress MPa per 10mm
    
    // Calculate data range
    const maxStrain = Math.max(...csvData.map(d => d.strain));
    const maxStress = Math.max(...csvData.map(d => d.stress));
    
    // Calculate how many units fit in the plot area
    const plotWidthMM = (a4WidthMM - marginLeft - marginRight);
    const plotHeightMM = (a4HeightMM - marginTop - marginBottom);
    
    const maxDisplayStrain = (plotWidthMM / 10) * scaleX;
    const maxDisplayStress = (plotHeightMM / 10) * scaleY;
    
    // Draw 1mm grid
    drawGrid(ctx, plotAreaLeft, plotAreaTop, plotAreaWidth, plotAreaHeight, mmToPixel);
    
    // Draw axes
    drawAxes(ctx, plotAreaLeft, plotAreaTop, plotAreaWidth, plotAreaHeight, scaleX, scaleY, mmToPixel);
    
    // Draw offset line BEFORE plotting data points
    drawOffsetLine(ctx, plotAreaLeft, plotAreaTop, plotAreaWidth, plotAreaHeight, 
                   maxDisplayStrain, maxDisplayStress, mmToPixel, scaleX, scaleY);
    
    // Plot data points
    plotDataPoints(ctx, plotAreaLeft, plotAreaTop, plotAreaWidth, plotAreaHeight, 
                   maxDisplayStrain, maxDisplayStress);
    
    // Draw title (scaled for high resolution)
    ctx.fillStyle = '#2c3e50';
    ctx.font = `bold ${20 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Stress-Strain Curve - Graph Sheet', canvasWidth / 2, 15 * mmToPixel);
    
    // Calculate and display toughness (area under the stress-strain curve)
    const toughness = calculateToughness(csvData);
    displayGraphSheetInfo(toughness);
    
    // Show container
    graphContainer.style.display = 'block';
    graphContainer.scrollIntoView({ behavior: 'smooth' });
}

// Calculate Toughness (Area under stress-strain curve)
function calculateToughness(data) {
    if (!data || data.length < 2) return 0;
    
    // Use trapezoidal rule to calculate area under the curve
    let area = 0;
    for (let i = 1; i < data.length; i++) {
        const width = data[i].strain - data[i-1].strain;
        const avgHeight = (data[i].stress + data[i-1].stress) / 2;
        area += width * avgHeight;
    }
    
    return area;
}

// Display Graph Sheet Info
function displayGraphSheetInfo(toughness) {
    const graphSheetInfo = document.getElementById('graphSheetInfo');
    
    if (!graphSheetInfo) return;
    
    graphSheetInfo.innerHTML = `
        <div class="result-item">
            <span class="result-label">Toughness (Area under curve):</span>
            <span class="result-value">${toughness.toFixed(6)} MPa·mm</span>
        </div>
        <div class="result-item">
            <span class="result-label">Total Data Points:</span>
            <span class="result-value">${csvData.length}</span>
        </div>
    `;
}

// Draw 1mm grid
function drawGrid(ctx, left, top, width, height, mmToPixel) {
    const gridSpacing = 1 * mmToPixel; // 1mm
    const majorGridSpacing = 10 * mmToPixel; // 10mm
    const gridScale = mmToPixel / 3.7795275591; // Get the scale factor
    
    ctx.save();
    
    // Enable anti-aliasing for smooth lines
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Draw vertical lines
    for (let x = 0; x <= width; x += gridSpacing) {
        const xPos = left + x;
        const isMajor = Math.round(x / gridSpacing) % 10 === 0;
        
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, top + height);
        ctx.strokeStyle = isMajor ? '#999' : '#ddd';
        ctx.lineWidth = isMajor ? (1.2 * gridScale) : (0.5 * gridScale);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= height; y += gridSpacing) {
        const yPos = top + y;
        const isMajor = Math.round(y / gridSpacing) % 10 === 0;
        
        ctx.beginPath();
        ctx.moveTo(left, yPos);
        ctx.lineTo(left + width, yPos);
        ctx.strokeStyle = isMajor ? '#999' : '#ddd';
        ctx.lineWidth = isMajor ? (1.2 * gridScale) : (0.5 * gridScale);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Draw axes with labels
function drawAxes(ctx, left, top, width, height, scaleX, scaleY, mmToPixel) {
    const majorGridSpacing = 10 * mmToPixel; // 10mm
    const axisScale = mmToPixel / 3.7795275591; // Get the scale factor
    
    ctx.save();
    
    // Enable high-quality text rendering
    ctx.textRendering = 'geometricPrecision';
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5 * axisScale;
    ctx.lineCap = 'square';
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(left, top + height);
    ctx.lineTo(left + width, top + height);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, top + height);
    ctx.stroke();
    
    // X-axis labels (strain)
    ctx.fillStyle = '#000';
    ctx.font = `${10 * axisScale}px Arial`;
    ctx.textAlign = 'center';
    
    let xValue = 0;
    for (let x = 0; x <= width; x += majorGridSpacing) {
        const xPos = left + x;
        ctx.fillText(xValue.toFixed(3), xPos, top + height + (12 * axisScale));
        xValue += scaleX;
    }
    
    // X-axis title
    ctx.font = `bold ${12 * axisScale}px Arial`;
    ctx.fillText('Strain', left + width / 2, top + height + (25 * axisScale));
    
    // Y-axis labels (stress)
    ctx.textAlign = 'right';
    ctx.font = `${10 * axisScale}px Arial`;
    
    let yValue = 0;
    for (let y = height; y >= 0; y -= majorGridSpacing) {
        const yPos = top + y;
        ctx.fillText(yValue.toFixed(1), left - (5 * axisScale), yPos + (3 * axisScale));
        yValue += scaleY;
    }
    
    // Y-axis title
    ctx.fillText('Stress (MPa)', 0, 0);
    ctx.restore();
    
    ctx.restore();
}

// Draw offset line on graph sheet
function drawOffsetLine(ctx, left, top, width, height, maxStrain, maxStress, mmToPixel, scaleX, scaleY) {
    // Get offset percentage - use from input directly
    const offsetPercent = parseFloat(offsetStrainInput.value) || 0.2;
    const offset = offsetPercent / 100;
    
    // Calculate elastic modulus from first two points
    if (!csvData || csvData.length < 2) return;
    
    const elasticModulus = (csvData[1].stress - csvData[0].stress) / (csvData[1].strain - csvData[0].strain);
    
    const plotScale = ctx.canvas.width / (ctx.canvas.style.width ? parseFloat(ctx.canvas.style.width) : ctx.canvas.width);
    
    ctx.save();
    
    // Set line style for offset line
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5 * plotScale;
    ctx.setLineDash([8 * plotScale, 4 * plotScale]);
    
    ctx.beginPath();
    
    // Draw the offset line with correct slope accounting for different X and Y scales
    // The line starts at (offset, 0) and has slope = elasticModulus in data units
    // But we need to convert this to canvas pixels accounting for scaleX and scaleY
    
    const startStrain = offset;
    const startStress = 0;
    
    // Find end point - go to the max displayable values
    let endStrain = maxStrain;
    let endStress = elasticModulus * (endStrain - offset);
    
    // If endStress exceeds maxStress, clip it
    if (endStress > maxStress) {
        endStress = maxStress;
        endStrain = offset + (maxStress / elasticModulus);
    }
    
    // Convert to canvas coordinates
    // Each unit of strain corresponds to (width / maxStrain) pixels
    // Each unit of stress corresponds to (height / maxStress) pixels
    const x1 = left + (startStrain / maxStrain) * width;
    const y1 = top + height - (startStress / maxStress) * height;
    const x2 = left + (endStrain / maxStrain) * width;
    const y2 = top + height - (endStress / maxStress) * height;
    
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Reset line dash
    ctx.setLineDash([]);
    
    ctx.restore();
}

// Plot data points on graph sheet
function plotDataPoints(ctx, left, top, width, height, maxStrain, maxStress) {
    // Calculate scale factor for high-quality rendering
    const plotScale = ctx.canvas.width / (ctx.canvas.style.width ? parseFloat(ctx.canvas.style.width) : ctx.canvas.width);
    
    ctx.save();
    
    // Enable anti-aliasing
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Draw smooth curve connecting points
    ctx.beginPath();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.5 * plotScale;
    
    // Filter points that are within range
    const filteredPoints = csvData.filter(point => 
        point.strain <= maxStrain && point.stress <= maxStress
    ).map(point => ({
        x: left + (point.strain / maxStrain) * width,
        y: top + height - (point.stress / maxStress) * height
    }));
    
    if (filteredPoints.length > 0) {
        ctx.moveTo(filteredPoints[0].x, filteredPoints[0].y);
        
        // Draw smooth curve using cardinal spline interpolation for all points except last two
        const smoothUntil = filteredPoints.length - 2;
        
        for (let i = 0; i < filteredPoints.length - 1; i++) {
            if (i < smoothUntil) {
                // Draw smooth Bezier curve
                const p0 = filteredPoints[Math.max(i - 1, 0)];
                const p1 = filteredPoints[i];
                const p2 = filteredPoints[i + 1];
                const p3 = filteredPoints[Math.min(i + 2, filteredPoints.length - 1)];
                
                // Calculate control points for Bezier curve
                const tension = 0.5;
                const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
                const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
                const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
                const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
                
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            } else {
                // Draw straight line for last two points
                const p2 = filteredPoints[i + 1];
                ctx.lineTo(p2.x, p2.y);
            }
        }
    }
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = '#000';
    csvData.forEach((point, index) => {
        // Skip points outside the range
        if (point.strain > maxStrain || point.stress > maxStress) return;
        
        const x = left + (point.strain / maxStrain) * width;
        const y = top + height - (point.stress / maxStress) * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 3 * plotScale, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Highlight yield point (intersection of offset line and curve)
    // Calculate it here if not already calculated
    const offsetPercent = parseFloat(offsetStrainInput.value) || 0.2;
    let yieldPoint = analysisResults.yieldPoint;
    
    // If no analysis results, calculate yield point now
    if (!yieldPoint && csvData.length >= 2) {
        yieldPoint = calculateYieldStrength(csvData, offsetPercent);
    }
    
    if (yieldPoint && 
        yieldPoint.strain <= maxStrain && 
        yieldPoint.stress <= maxStress) {
        const yp = yieldPoint;
        const x = left + (yp.strain / maxStrain) * width;
        const y = top + height - (yp.stress / maxStress) * height;
        
        // Draw yield point marker
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2 * plotScale;
        
        // Draw a square marker
        const markerSize = 5 * plotScale;
        ctx.fillRect(x - markerSize, y - markerSize, markerSize * 2, markerSize * 2);
        
        // Draw projection lines to axes
        ctx.setLineDash([5 * plotScale, 3 * plotScale]);
        ctx.lineWidth = 1 * plotScale;
        ctx.strokeStyle = '#666';
        
        // Vertical projection to X-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, top + height);
        ctx.stroke();
        
        // Horizontal projection to Y-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(left, y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Add label
        ctx.fillStyle = '#000';
        ctx.font = `bold ${10 * plotScale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('Yield Point', x + 10 * plotScale, y - 5 * plotScale);
        
        // Add coordinates
        ctx.font = `${9 * plotScale}px Arial`;
        ctx.fillText(`(${yp.strain.toFixed(4)}, ${yp.stress.toFixed(2)})`, x + 10 * plotScale, y + 10 * plotScale);
    }
    
    // Highlight UTS point
    let utsPoint = analysisResults.utsPoint;
    if (!utsPoint && csvData.length > 0) {
        utsPoint = findUTS(csvData);
    }
    
    if (utsPoint && 
        utsPoint.strain <= maxStrain && 
        utsPoint.stress <= maxStress) {
        const uts = utsPoint;
        const x = left + (uts.strain / maxStrain) * width;
        const y = top + height - (uts.stress / maxStress) * height;
        
        // Draw UTS marker (circle)
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2 * plotScale;
        ctx.beginPath();
        ctx.arc(x, y, 6 * plotScale, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw projection lines to axes
        ctx.setLineDash([5 * plotScale, 3 * plotScale]);
        ctx.lineWidth = 1 * plotScale;
        ctx.strokeStyle = '#666';
        
        // Vertical projection to X-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, top + height);
        ctx.stroke();
        
        // Horizontal projection to Y-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(left, y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Add label
        ctx.fillStyle = '#000';
        ctx.font = `bold ${10 * plotScale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('UTS', x + 10 * plotScale, y - 5 * plotScale);
        
        // Add coordinates
        ctx.font = `${9 * plotScale}px Arial`;
        ctx.fillText(`(${uts.strain.toFixed(4)}, ${uts.stress.toFixed(2)})`, x + 10 * plotScale, y + 10 * plotScale);
    }
    
    // Highlight Fracture point
    let fracturePoint = analysisResults.fracturePoint;
    if (!fracturePoint && utsPoint && csvData.length > 0) {
        fracturePoint = findFracturePoint(csvData, utsPoint);
    }
    
    if (fracturePoint && 
        fracturePoint.strain <= maxStrain && 
        fracturePoint.stress <= maxStress) {
        const fp = fracturePoint;
        const x = left + (fp.strain / maxStrain) * width;
        const y = top + height - (fp.stress / maxStress) * height;
        
        // Draw fracture point marker (triangle)
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2 * plotScale;
        
        const triangleSize = 6 * plotScale;
        ctx.beginPath();
        ctx.moveTo(x, y - triangleSize);
        ctx.lineTo(x - triangleSize, y + triangleSize);
        ctx.lineTo(x + triangleSize, y + triangleSize);
        ctx.closePath();
        ctx.stroke();
        
        // Draw projection lines to axes
        ctx.setLineDash([5 * plotScale, 3 * plotScale]);
        ctx.lineWidth = 1 * plotScale;
        ctx.strokeStyle = '#666';
        
        // Vertical projection to X-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, top + height);
        ctx.stroke();
        
        // Horizontal projection to Y-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(left, y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Add label
        ctx.fillStyle = '#000';
        ctx.font = `bold ${10 * plotScale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('Fracture', x + 10 * plotScale, y - 5 * plotScale);
        
        // Add coordinates
        ctx.font = `${9 * plotScale}px Arial`;
        ctx.fillText(`(${fp.strain.toFixed(4)}, ${fp.stress.toFixed(2)})`, x + 10 * plotScale, y + 10 * plotScale);
    }
    
    ctx.restore();
}

// Download graph as PDF
function downloadGraphPdf() {
    if (!graphCanvas || graphCanvas.width === 0) {
        alert('Please generate the graph sheet first.');
        return;
    }
    
    // Import jsPDF from the global window object
    const { jsPDF } = window.jspdf;
    
    // Create PDF in A4 landscape format
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });
    
    // Get canvas as image
    const imgData = graphCanvas.toDataURL('image/png', 1.0);
    
    // Add image to PDF (A4 landscape size: 297 x 210 mm)
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
    
    // Save PDF
    pdf.save('stress-strain-graph-sheet.pdf');
}

// Download graph as image
function downloadGraphImage() {
    if (!graphCanvas || graphCanvas.width === 0) {
        alert('Please generate the graph sheet first.');
        return;
    }
    
    graphCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'stress-strain-graph-sheet.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png', 1.0);
}

// ========== Exx-Eyy Plot Functions ==========

// Calculate linear regression line for exx-eyy data
function calculateLinearRegressionLine(data) {
    if (!data || data.length < 2) return null;
    
    const n = data.length;
    
    // Sums for linear regression (x = eyy, y = exx)
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
        const x = data[i].eyy;
        const y = data[i].exx;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }
    
    // Calculate slope and intercept using least squares method
    // slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
    // intercept = (Σy - slope*Σx) / n
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate first and last points on the regression line
    const firstX = data[0].eyy;
    const lastX = data[data.length - 1].eyy;
    
    const firstY = slope * firstX + intercept;
    const lastY = slope * lastX + intercept;
    
    return {
        firstPoint: { x: firstX, y: firstY },
        lastPoint: { x: lastX, y: lastY },
        slope: slope,
        intercept: intercept
    };
}

// Generate Exx-Eyy Plot
function generateExxEyyPlot() {
    if (!csvData) {
        alert('Please upload a CSV file first.');
        return;
    }
    
    // Check if exx and eyy data exists
    if (!csvData[0].exx || !csvData[0].eyy) {
        alert('The uploaded CSV does not contain exx and eyy columns. Please upload a file with exx and eyy data.');
        return;
    }
    
    // Calculate linear regression line
    const regressionLine = calculateLinearRegressionLine(csvData);
    
    // Get slope from regression
    const slope = regressionLine.slope;
    
    // Prepare data (swapped: eyy on x-axis, exx on y-axis)
    const eyyData = csvData.map(d => d.eyy);
    const exxData = csvData.map(d => d.exx);
    
    // Create chart
    const ctx = exxEyyCanvas.getContext('2d');
    
    // Destroy previous chart if exists
    if (exxEyyChart) {
        exxEyyChart.destroy();
    }
    
    // Custom plugin to draw slope label
    const slopeLabelPlugin = {
        id: 'slopeLabel',
        afterDatasetsDraw: function(chart) {
            const ctx = chart.ctx;
            
            // Calculate midpoint of the regression line for label placement
            const midX = (regressionLine.firstPoint.x + regressionLine.lastPoint.x) / 2;
            const midY = (regressionLine.firstPoint.y + regressionLine.lastPoint.y) / 2;
            
            // Convert data coordinates to pixel coordinates
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            const xPos = xScale.getPixelForValue(midX);
            const yPos = yScale.getPixelForValue(midY);
            
            // Draw label
            ctx.save();
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#e74c3c';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            const text = `Slope: ${slope.toFixed(4)}`;
            
            // Draw background box for better visibility
            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(xPos - textWidth/2 - 5, yPos - 22, textWidth + 10, 20);
            
            // Draw text
            ctx.fillStyle = '#e74c3c';
            ctx.fillText(text, xPos, yPos - 5);
            ctx.restore();
        }
    };
    
    exxEyyChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Eyy-Exx Curve',
                    data: csvData.map(d => ({ x: d.eyy, y: d.exx })),
                    borderColor: '#2c3e50',
                    backgroundColor: 'rgba(44, 62, 80, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#2c3e50',
                    showLine: true,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Linear Regression Line',
                    data: [
                        { x: regressionLine.firstPoint.x, y: regressionLine.firstPoint.y },
                        { x: regressionLine.lastPoint.x, y: regressionLine.lastPoint.y }
                    ],
                    borderColor: '#e74c3c',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [10, 5],
                    pointRadius: 5,
                    pointBackgroundColor: '#e74c3c',
                    showLine: true,
                    tension: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                slopeLabel: true,
                title: {
                    display: true,
                    text: 'Eyy vs Exx Plot with Linear Regression',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += '(' + context.parsed.x.toFixed(6) + ', ' + context.parsed.y.toFixed(6) + ')';
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Eyy (Strain)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(4);
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Exx (Strain)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(4);
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        },
        plugins: [slopeLabelPlugin]
    });
    
    // Display linear regression info
    const exxEyyInfo = document.getElementById('exxEyyInfo');
    
    exxEyyInfo.innerHTML = `
        <div class="result-item">
            <span class="result-label">Regression slope (Exx/Eyy):</span>
            <span class="result-value">${regressionLine.slope.toFixed(6)}</span>
        </div>
        <div class="result-item">
            <span class="result-label">Regression intercept:</span>
            <span class="result-value">${regressionLine.intercept.toFixed(6)}</span>
        </div>
        <div class="result-item">
            <span class="result-label">Regression line start:</span>
            <span class="result-value">(${regressionLine.firstPoint.x.toFixed(6)}, ${regressionLine.firstPoint.y.toFixed(6)})</span>
        </div>
        <div class="result-item">
            <span class="result-label">Regression line end:</span>
            <span class="result-value">(${regressionLine.lastPoint.x.toFixed(6)}, ${regressionLine.lastPoint.y.toFixed(6)})</span>
        </div>
    `;
    
    // Show chart container
    exxEyyContainer.style.display = 'block';
    
    // Scroll to chart
    exxEyyContainer.scrollIntoView({ behavior: 'smooth' });
}

// Download Exx-Eyy Plot
function downloadExxEyyPlot() {
    if (!exxEyyChart) {
        alert('Please generate the Exx-Eyy plot first.');
        return;
    }
    
    // Create temporary canvas with higher resolution
    const tempCanvas = document.createElement('canvas');
    const scale = 3;
    tempCanvas.width = exxEyyCanvas.width * scale;
    tempCanvas.height = exxEyyCanvas.height * scale;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Scale context
    tempCtx.scale(scale, scale);
    
    // White background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw current chart
    tempCtx.drawImage(exxEyyCanvas, 0, 0);
    
    // Download
    tempCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'exx-eyy-plot.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png', 1.0);
}
