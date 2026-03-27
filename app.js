// Global state
let gpxData = null;
let map = null;
let routeLayers = [];
let elevationChart = null;
let segments = []; // Stores segment data with terrain type
let currentMode = 'manual'; // 'manual' or 'target'
let aidStations = []; // Stores AID station data

// Constants
const GRADE_THRESHOLD = 2; // percentage grade to determine uphill/downhill

// DOM Elements
const dropZone = document.getElementById('dropZone');
const gpxInput = document.getElementById('gpxInput');
const browseBtn = document.getElementById('browseBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    setupFileInput();
    setupPaceCalculation();
    setupModeSelector();
    setupAidStations();
    setupExport();
});

// Drag and Drop functionality
function setupDragAndDrop() {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.gpx')) {
            processFile(file);
        } else {
            alert('Please drop a valid GPX file.');
        }
    });
}

function setupFileInput() {
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gpxInput.click();
    });

    dropZone.addEventListener('click', () => {
        gpxInput.click();
    });

    gpxInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        }
    });
}

// Process GPX file
function processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const gpxContent = e.target.result;
        parseGPX(gpxContent);
    };
    reader.readAsText(file);
}

// Parse GPX XML
function parseGPX(gpxContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        alert('Error parsing GPX file. Please check the file format.');
        return;
    }

    // Extract track points
    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    if (trackPoints.length === 0) {
        // Try route points if no track points
        const routePoints = xmlDoc.querySelectorAll('rtept');
        if (routePoints.length === 0) {
            alert('No track or route points found in the GPX file.');
            return;
        }
        gpxData = extractPoints(routePoints);
    } else {
        gpxData = extractPoints(trackPoints);
    }

    if (gpxData.points.length < 2) {
        alert('Not enough points in the GPX file for analysis.');
        return;
    }

    // Calculate derived data
    calculateSegments();
    
    // Display everything
    showSections();
    displayStats();
    displayMap();
    displayElevationChart();
}

// Extract points from XML nodes
function extractPoints(nodes) {
    const points = [];
    let totalDistance = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    // First pass: extract all points
    nodes.forEach((node, index) => {
        const lat = parseFloat(node.getAttribute('lat'));
        const lon = parseFloat(node.getAttribute('lon'));
        const eleNode = node.querySelector('ele');
        const elevation = eleNode ? parseFloat(eleNode.textContent) : null;

        const point = { lat, lon, elevation, distance: 0 };

        if (index > 0) {
            const prevPoint = points[index - 1];
            const segmentDistance = calculateDistance(
                prevPoint.lat, prevPoint.lon,
                lat, lon
            );
            totalDistance += segmentDistance;
            point.distance = totalDistance;
        }

        if (elevation !== null) {
            minElevation = Math.min(minElevation, elevation);
            maxElevation = Math.max(maxElevation, elevation);
        }

        points.push(point);
    });

    // Calculate elevation gain/loss with smoothing to filter GPS noise
    const { elevationGain, elevationLoss } = calculateElevationWithSmoothing(points);

    return {
        points,
        totalDistance,
        elevationGain,
        elevationLoss,
        minElevation: minElevation === Infinity ? 0 : minElevation,
        maxElevation: maxElevation === -Infinity ? 0 : maxElevation
    };
}

// Calculate elevation gain/loss with smoothing to reduce GPS noise
function calculateElevationWithSmoothing(points) {
    // Use distance-based segmentation to smooth out GPS noise
    // Calculate average elevation every 50 meters, then measure gain/loss between averages
    const SEGMENT_DISTANCE = 0.05; // km (50 meters)
    const MIN_CHANGE_THRESHOLD = 1; // minimum meters to count
    
    if (points.length < 2) return { elevationGain: 0, elevationLoss: 0 };
    
    // Group points into 50m segments and average their elevation
    const segmentElevations = [];
    let segmentStart = 0;
    let segmentSum = 0;
    let segmentCount = 0;
    
    for (const point of points) {
        if (point.elevation === null) continue;
        
        segmentSum += point.elevation;
        segmentCount++;
        
        // Check if we've covered enough distance for a new segment
        if (point.distance - segmentStart >= SEGMENT_DISTANCE && segmentCount > 0) {
            segmentElevations.push(segmentSum / segmentCount);
            segmentStart = point.distance;
            segmentSum = 0;
            segmentCount = 0;
        }
    }
    
    // Don't forget the last segment
    if (segmentCount > 0) {
        segmentElevations.push(segmentSum / segmentCount);
    }
    
    // Now calculate gain/loss between smoothed segment averages
    let elevationGain = 0;
    let elevationLoss = 0;
    
    for (let i = 1; i < segmentElevations.length; i++) {
        const change = segmentElevations[i] - segmentElevations[i - 1];
        
        if (Math.abs(change) >= MIN_CHANGE_THRESHOLD) {
            if (change > 0) {
                elevationGain += change;
            } else {
                elevationLoss += Math.abs(change);
            }
        }
    }
    
    return { elevationGain, elevationLoss };
}

// Haversine formula for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

// Calculate segments with terrain classification
function calculateSegments() {
    segments = [];
    const points = gpxData.points;
    
    // Create segments every 100m or so for smooth gradient calculation
    const segmentLength = 0.1; // km
    let currentSegmentStart = 0;
    let segmentStartElevation = points[0].elevation || 0;
    
    for (let i = 1; i < points.length; i++) {
        const distanceFromSegmentStart = points[i].distance - (segments.length * segmentLength);
        
        if (distanceFromSegmentStart >= segmentLength || i === points.length - 1) {
            const segmentDistance = points[i].distance - currentSegmentStart;
            const currentElevation = points[i].elevation || 0;
            const elevationChange = currentElevation - segmentStartElevation;
            
            // Calculate grade percentage
            const grade = segmentDistance > 0 ? (elevationChange / (segmentDistance * 1000)) * 100 : 0;
            
            let terrainType;
            if (grade > GRADE_THRESHOLD) {
                terrainType = 'uphill';
            } else if (grade < -GRADE_THRESHOLD) {
                terrainType = 'downhill';
            } else {
                terrainType = 'flat';
            }
            
            segments.push({
                startIndex: currentSegmentStart === 0 ? 0 : segments.length > 0 ? segments[segments.length - 1].endIndex : 0,
                endIndex: i,
                startDistance: currentSegmentStart,
                endDistance: points[i].distance,
                distance: segmentDistance,
                elevationChange,
                grade,
                terrainType,
                startPoint: points[segments.length > 0 ? segments[segments.length - 1].endIndex : 0],
                endPoint: points[i]
            });
            
            currentSegmentStart = points[i].distance;
            segmentStartElevation = currentElevation;
        }
    }
}

// Show hidden sections
function showSections() {
    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('mapSection').style.display = 'block';
    document.getElementById('elevationSection').style.display = 'block';
    document.getElementById('paceSection').style.display = 'block';
}

// Display statistics
function displayStats() {
    document.getElementById('totalDistance').textContent = `${gpxData.totalDistance.toFixed(2)} km`;
    document.getElementById('elevationGain').textContent = `${gpxData.elevationGain.toFixed(0)} m`;
    document.getElementById('elevationLoss').textContent = `${gpxData.elevationLoss.toFixed(0)} m`;
    document.getElementById('minElevation').textContent = `${gpxData.minElevation.toFixed(0)} m`;
    document.getElementById('maxElevation').textContent = `${gpxData.maxElevation.toFixed(0)} m`;
}

// Display map with colored route
function displayMap() {
    // Clear existing map
    if (map) {
        map.remove();
    }
    
    // Clear layer references
    routeLayers = [];
    
    // Initialize map
    map = L.map('map');
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Draw route segments with colors based on terrain
    const colors = {
        flat: '#4CAF50',
        uphill: '#f44336',
        downhill: '#2196F3'
    };
    
    const points = gpxData.points;
    
    // Group consecutive segments of the same type for smoother rendering
    let currentType = null;
    let currentPath = [];
    
    segments.forEach((segment, index) => {
        if (segment.terrainType !== currentType && currentPath.length > 0) {
            // Draw the previous path
            const polyline = L.polyline(currentPath, {
                color: colors[currentType],
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            routeLayers.push(polyline);
            currentPath = [currentPath[currentPath.length - 1]]; // Start new path from last point
        }
        
        currentType = segment.terrainType;
        
        // Add points for this segment
        for (let i = segment.startIndex; i <= segment.endIndex; i++) {
            currentPath.push([points[i].lat, points[i].lon]);
        }
        
        // Draw final segment
        if (index === segments.length - 1 && currentPath.length > 0) {
            const polyline = L.polyline(currentPath, {
                color: colors[currentType],
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            routeLayers.push(polyline);
        }
    });
    
    // Add start marker
    L.marker([points[0].lat, points[0].lon])
        .addTo(map)
        .bindPopup('Start');
    
    // Add end marker
    L.marker([points[points.length - 1].lat, points[points.length - 1].lon])
        .addTo(map)
        .bindPopup('Finish');
    
    // Fit map to route bounds
    const latLngs = points.map(p => [p.lat, p.lon]);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [20, 20] });
}

// Display elevation chart
function displayElevationChart() {
    const ctx = document.getElementById('elevationChart').getContext('2d');
    
    // Destroy existing chart
    if (elevationChart) {
        elevationChart.destroy();
    }
    
    const points = gpxData.points;
    
    // Prepare data with colors (handle null elevations)
    const labels = points.map(p => p.distance.toFixed(2));
    const elevations = points.map(p => p.elevation !== null ? p.elevation : 0);
    
    // Create gradient colors based on terrain
    const colors = points.map((p, i) => {
        if (i === 0) return 'rgba(76, 175, 80, 0.8)';
        
        // Find which segment this point belongs to
        for (const segment of segments) {
            if (p.distance <= segment.endDistance) {
                switch (segment.terrainType) {
                    case 'uphill': return 'rgba(244, 67, 54, 0.8)';
                    case 'downhill': return 'rgba(33, 150, 243, 0.8)';
                    default: return 'rgba(76, 175, 80, 0.8)';
                }
            }
        }
        return 'rgba(76, 175, 80, 0.8)';
    });
    
    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Elevation (m)',
                data: elevations,
                borderColor: '#00d4ff',
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return;
                    
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.1)');
                    gradient.addColorStop(1, 'rgba(0, 212, 255, 0.4)');
                    return gradient;
                },
                fill: true,
                tension: 0.3,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Distance: ${context[0].label} km`;
                        },
                        label: function(context) {
                            return `Elevation: ${context.raw.toFixed(0)} m`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Distance (km)',
                        color: '#888'
                    },
                    ticks: {
                        color: '#888',
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Elevation (m)',
                        color: '#888'
                    },
                    ticks: {
                        color: '#888'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
    
    // Make chart container responsive
    document.querySelector('.chart-container').style.height = '300px';
}

// Pace calculation
function setupPaceCalculation() {
    document.getElementById('calculatePace').addEventListener('click', calculateRacePlan);
}

// Mode selector setup
function setupModeSelector() {
    const manualBtn = document.getElementById('manualModeBtn');
    const targetBtn = document.getElementById('targetModeBtn');
    const manualMode = document.getElementById('manualMode');
    const targetMode = document.getElementById('targetMode');
    
    if (!manualBtn || !targetBtn || !manualMode || !targetMode) {
        console.error('Mode selector elements not found');
        return;
    }
    
    manualBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = 'manual';
        manualBtn.classList.add('active');
        targetBtn.classList.remove('active');
        manualMode.style.display = 'block';
        targetMode.style.display = 'none';
    });
    
    targetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = 'target';
        targetBtn.classList.add('active');
        manualBtn.classList.remove('active');
        targetMode.style.display = 'block';
        manualMode.style.display = 'none';
    });
}

// AID Stations setup
function setupAidStations() {
    const addBtn = document.getElementById('addAidStation');
    const kmInput = document.getElementById('aidStationKm');
    const nameInput = document.getElementById('aidStationName');
    
    if (!addBtn) {
        console.error('AID station button not found');
        return;
    }
    
    // Remove any existing listeners by cloning
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);
    
    newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const km = parseFloat(kmInput.value);
        const name = nameInput.value.trim() || `AID ${aidStations.length + 1}`;
        
        if (isNaN(km) || km < 0) {
            alert('Please enter a valid kilometer position.');
            return;
        }
        
        // Add to array
        aidStations.push({ km, name });
        
        // Sort by km
        aidStations.sort((a, b) => a.km - b.km);
        
        // Render list
        renderAidStations();
        
        // Clear inputs
        kmInput.value = '';
        nameInput.value = '';
    });
}

function renderAidStations() {
    const list = document.getElementById('aidStationsList');
    if (!list) return;
    
    list.innerHTML = aidStations.map((station, index) => `
        <div class="aid-station-item">
            <div class="aid-station-info">
                <span class="aid-station-km">KM ${station.km}</span>
                <span class="aid-station-name">${station.name}</span>
            </div>
            <button type="button" class="remove-aid-btn" onclick="removeAidStation(${index})">×</button>
        </div>
    `).join('');
}

function removeAidStation(index) {
    aidStations.splice(index, 1);
    renderAidStations();
}

// Make removeAidStation available globally
window.removeAidStation = removeAidStation;

function getAidStationForKm(km) {
    // Find AID station that falls within or at this km
    return aidStations.find(station => 
        Math.floor(station.km) === km || 
        (station.km > km - 1 && station.km <= km)
    );
}

function getPaceInMinutes(minInput, secInput) {
    const min = parseInt(minInput.value) || 0;
    const sec = parseInt(secInput.value) || 0;
    return min + sec / 60;
}

function formatTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes % 1) * 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatPace(paceMinutes) {
    const min = Math.floor(paceMinutes);
    const sec = Math.round((paceMinutes % 1) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatClockTime(totalMinutes) {
    // Handle overflow past 24 hours
    let hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes % 1) * 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function calculateTerrainDistances() {
    let flatDistance = 0, uphillDistance = 0, downhillDistance = 0;
    
    segments.forEach(segment => {
        switch (segment.terrainType) {
            case 'flat':
                flatDistance += segment.distance;
                break;
            case 'uphill':
                uphillDistance += segment.distance;
                break;
            case 'downhill':
                downhillDistance += segment.distance;
                break;
        }
    });
    
    return { flatDistance, uphillDistance, downhillDistance };
}

function calculatePacesFromTargetTime() {
    // Get target time in minutes
    const hours = parseInt(document.getElementById('targetHours').value) || 0;
    const minutes = parseInt(document.getElementById('targetMinutes').value) || 0;
    const seconds = parseInt(document.getElementById('targetSeconds').value) || 0;
    const targetTimeMinutes = hours * 60 + minutes + seconds / 60;
    
    // Get ratios
    const uphillRatio = parseFloat(document.getElementById('uphillRatio').value) || 1.2;
    const downhillRatio = parseFloat(document.getElementById('downhillRatio').value) || 0.9;
    
    // Get terrain distances
    const { flatDistance, uphillDistance, downhillDistance } = calculateTerrainDistances();
    
    // Calculate base (flat) pace
    // Total time = flatDist * flatPace + uphillDist * (flatPace * uphillRatio) + downhillDist * (flatPace * downhillRatio)
    // Total time = flatPace * (flatDist + uphillDist * uphillRatio + downhillDist * downhillRatio)
    const weightedDistance = flatDistance + (uphillDistance * uphillRatio) + (downhillDistance * downhillRatio);
    const flatPace = targetTimeMinutes / weightedDistance;
    const uphillPace = flatPace * uphillRatio;
    const downhillPace = flatPace * downhillRatio;
    
    return { flatPace, uphillPace, downhillPace };
}

function calculateRacePlan() {
    if (!gpxData || segments.length === 0) {
        alert('Please load a GPX file first.');
        return;
    }
    
    let flatPace, uphillPace, downhillPace;
    
    if (currentMode === 'manual') {
        // Get pace values from manual inputs
        flatPace = getPaceInMinutes(
            document.getElementById('flatPaceMin'),
            document.getElementById('flatPaceSec')
        );
        uphillPace = getPaceInMinutes(
            document.getElementById('uphillPaceMin'),
            document.getElementById('uphillPaceSec')
        );
        downhillPace = getPaceInMinutes(
            document.getElementById('downhillPaceMin'),
            document.getElementById('downhillPaceSec')
        );
    } else {
        // Calculate paces from target time
        const paces = calculatePacesFromTargetTime();
        flatPace = paces.flatPace;
        uphillPace = paces.uphillPace;
        downhillPace = paces.downhillPace;
        
        // Display calculated paces
        document.getElementById('calculatedPaces').style.display = 'block';
        document.getElementById('calcFlatPace').textContent = formatPace(flatPace) + ' /km';
        document.getElementById('calcUphillPace').textContent = formatPace(uphillPace) + ' /km';
        document.getElementById('calcDownhillPace').textContent = formatPace(downhillPace) + ' /km';
    }
    
    // Calculate distances and times for each terrain type
    let flatDistance = 0, uphillDistance = 0, downhillDistance = 0;
    let flatTime = 0, uphillTime = 0, downhillTime = 0;
    
    segments.forEach(segment => {
        switch (segment.terrainType) {
            case 'flat':
                flatDistance += segment.distance;
                flatTime += segment.distance * flatPace;
                break;
            case 'uphill':
                uphillDistance += segment.distance;
                uphillTime += segment.distance * uphillPace;
                break;
            case 'downhill':
                downhillDistance += segment.distance;
                downhillTime += segment.distance * downhillPace;
                break;
        }
    });
    
    const totalTime = flatTime + uphillTime + downhillTime;
    
    // Display results
    document.getElementById('paceResults').style.display = 'block';
    document.getElementById('flatDistance').textContent = `${flatDistance.toFixed(2)} km`;
    document.getElementById('uphillDistance').textContent = `${uphillDistance.toFixed(2)} km`;
    document.getElementById('downhillDistance').textContent = `${downhillDistance.toFixed(2)} km`;
    
    document.getElementById('flatTime').textContent = formatTime(flatTime);
    document.getElementById('uphillTime').textContent = formatTime(uphillTime);
    document.getElementById('downhillTime').textContent = formatTime(downhillTime);
    
    document.getElementById('totalTime').textContent = formatTime(totalTime);
    document.getElementById('estimatedTime').textContent = formatTime(totalTime);
    
    // Generate splits table
    generateSplitsTable(flatPace, uphillPace, downhillPace);
}

// Generate kilometer splits table
function generateSplitsTable(flatPace, uphillPace, downhillPace) {
    const splitsBody = document.getElementById('splitsBody');
    splitsBody.innerHTML = '';
    
    const points = gpxData.points;
    const totalKm = Math.ceil(gpxData.totalDistance);
    
    // Get start time
    const startTimeInput = document.getElementById('raceStartTime');
    const startTimeValue = startTimeInput ? startTimeInput.value : '09:00';
    const [startHours, startMinutes] = startTimeValue.split(':').map(Number);
    const startTimeInMinutes = startHours * 60 + startMinutes;
    
    let cumulativeTime = 0;
    let currentKm = 1;
    
    // Calculate splits per kilometer
    for (let km = 1; km <= totalKm; km++) {
        const kmStart = km - 1;
        const kmEnd = Math.min(km, gpxData.totalDistance);
        
        // Find elevation change for this km
        let startElevation = 0, endElevation = 0;
        let segmentDistance = 0;
        let dominantTerrain = { flat: 0, uphill: 0, downhill: 0 };
        
        // Find points within this km range
        for (const segment of segments) {
            if (segment.endDistance >= kmStart && segment.startDistance < kmEnd) {
                const overlapStart = Math.max(segment.startDistance, kmStart);
                const overlapEnd = Math.min(segment.endDistance, kmEnd);
                const overlapDistance = overlapEnd - overlapStart;
                
                dominantTerrain[segment.terrainType] += overlapDistance;
                
                if (startElevation === 0) {
                    startElevation = segment.startPoint.elevation;
                }
                endElevation = segment.endPoint.elevation;
            }
        }
        
        // Determine dominant terrain for this km
        let terrain = 'flat';
        let maxDist = dominantTerrain.flat;
        if (dominantTerrain.uphill > maxDist) {
            terrain = 'uphill';
            maxDist = dominantTerrain.uphill;
        }
        if (dominantTerrain.downhill > maxDist) {
            terrain = 'downhill';
        }
        
        // Calculate elevation change
        const elevationChange = endElevation - startElevation;
        const distance = kmEnd - kmStart;
        
        // Calculate pace for this km based on terrain distribution
        let kmTime = 0;
        kmTime += dominantTerrain.flat * flatPace;
        kmTime += dominantTerrain.uphill * uphillPace;
        kmTime += dominantTerrain.downhill * downhillPace;
        
        // If it's a partial km (last one), adjust
        if (distance < 1) {
            const avgPace = kmTime / distance;
            cumulativeTime += kmTime;
        } else {
            cumulativeTime += kmTime;
        }
        
        // Get target pace for dominant terrain
        let targetPace;
        switch (terrain) {
            case 'uphill': targetPace = uphillPace; break;
            case 'downhill': targetPace = downhillPace; break;
            default: targetPace = flatPace;
        }
        
        // Calculate clock time
        const clockTimeMinutes = startTimeInMinutes + cumulativeTime;
        const clockTime = formatClockTime(clockTimeMinutes);
        
        // Split time is the time for this km
        const splitTime = kmTime;
        
        // Check for AID station at this km
        const aidStation = getAidStationForKm(km);
        const aidStationText = aidStation ? aidStation.name : '-';
        const hasAidStation = aidStation !== undefined;
        
        const row = document.createElement('tr');
        if (hasAidStation) {
            row.classList.add('aid-station-row');
        }
        row.innerHTML = `
            <td>${km}</td>
            <td>${elevationChange >= 0 ? '+' : ''}${elevationChange.toFixed(0)} m</td>
            <td class="terrain-${terrain}">${terrain.charAt(0).toUpperCase() + terrain.slice(1)}</td>
            <td class="${hasAidStation ? 'aid-station-cell' : ''}">${aidStationText}</td>
            <td>${formatPace(targetPace)} /km</td>
            <td>${formatTime(splitTime)}</td>
            <td>${formatTime(cumulativeTime)}</td>
            <td>${clockTime}</td>
        `;
        splitsBody.appendChild(row);
    }
    
    // Show splits section
    document.getElementById('splitsSection').style.display = 'block';
}

// CSV Export functionality
function setupExport() {
    document.getElementById('exportCsv').addEventListener('click', exportToCsv);
}

function exportToCsv() {
    if (!gpxData || segments.length === 0) {
        alert('Please load a GPX file and calculate a race plan first.');
        return;
    }

    const splitsTable = document.getElementById('splitsTable');
    if (!splitsTable || splitsTable.rows.length <= 1) {
        alert('Please calculate a race plan first to generate splits.');
        return;
    }

    // Get pace values based on current mode
    let flatPace, uphillPace, downhillPace;
    
    if (currentMode === 'manual') {
        flatPace = getPaceInMinutes(
            document.getElementById('flatPaceMin'),
            document.getElementById('flatPaceSec')
        );
        uphillPace = getPaceInMinutes(
            document.getElementById('uphillPaceMin'),
            document.getElementById('uphillPaceSec')
        );
        downhillPace = getPaceInMinutes(
            document.getElementById('downhillPaceMin'),
            document.getElementById('downhillPaceSec')
        );
    } else {
        const paces = calculatePacesFromTargetTime();
        flatPace = paces.flatPace;
        uphillPace = paces.uphillPace;
        downhillPace = paces.downhillPace;
    }

    let csvContent = '';

    // Get start time
    const startTimeInput = document.getElementById('raceStartTime');
    const startTimeValue = startTimeInput ? startTimeInput.value : '09:00';

    // Add summary section
    csvContent += 'GPX RACE PLAN EXPORT\n';
    csvContent += `Mode,${currentMode === 'manual' ? 'Manual Pace' : 'Target Time'}\n`;
    csvContent += `Race Start Time,${startTimeValue}\n`;
    csvContent += '\n';
    csvContent += 'ROUTE STATISTICS\n';
    csvContent += `Total Distance,${gpxData.totalDistance.toFixed(2)} km\n`;
    csvContent += `Elevation Gain,${gpxData.elevationGain.toFixed(0)} m\n`;
    csvContent += `Elevation Loss,${gpxData.elevationLoss.toFixed(0)} m\n`;
    csvContent += `Min Elevation,${gpxData.minElevation.toFixed(0)} m\n`;
    csvContent += `Max Elevation,${gpxData.maxElevation.toFixed(0)} m\n`;
    csvContent += '\n';
    csvContent += 'PACE SETTINGS\n';
    csvContent += `Flat Pace,${formatPace(flatPace)} /km\n`;
    csvContent += `Uphill Pace,${formatPace(uphillPace)} /km\n`;
    csvContent += `Downhill Pace,${formatPace(downhillPace)} /km\n`;
    csvContent += '\n';
    csvContent += 'TERRAIN BREAKDOWN\n';
    csvContent += `Flat Distance,${document.getElementById('flatDistance').textContent}\n`;
    csvContent += `Uphill Distance,${document.getElementById('uphillDistance').textContent}\n`;
    csvContent += `Downhill Distance,${document.getElementById('downhillDistance').textContent}\n`;
    csvContent += `Flat Time,${document.getElementById('flatTime').textContent}\n`;
    csvContent += `Uphill Time,${document.getElementById('uphillTime').textContent}\n`;
    csvContent += `Downhill Time,${document.getElementById('downhillTime').textContent}\n`;
    csvContent += `Total Estimated Time,${document.getElementById('totalTime').textContent}\n`;
    csvContent += '\n';

    // Add AID stations if any
    if (aidStations.length > 0) {
        csvContent += 'AID STATIONS\n';
        csvContent += 'KM,Name\n';
        aidStations.forEach(station => {
            csvContent += `${station.km},${station.name}\n`;
        });
        csvContent += '\n';
    }

    // Add splits table
    csvContent += 'KILOMETER SPLITS\n';
    
    // Get table headers
    const headers = [];
    const headerCells = splitsTable.querySelectorAll('thead th');
    headerCells.forEach(cell => {
        headers.push(cell.textContent);
    });
    csvContent += headers.join(',') + '\n';

    // Get table rows
    const rows = splitsTable.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            // Escape commas and quotes in cell content
            let content = cell.textContent.trim();
            if (content.includes(',') || content.includes('"')) {
                content = '"' + content.replace(/"/g, '""') + '"';
            }
            rowData.push(content);
        });
        csvContent += rowData.join(',') + '\n';
    });

    // Create and download the file using data URI (more compatible)
    const encodedContent = encodeURIComponent(csvContent);
    const dataUri = 'data:text/csv;charset=utf-8,' + encodedContent;
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'gpx_race_plan.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
