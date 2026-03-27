// Global state
let gpxData = null;
let map = null;
let routeLayers = [];
let elevationChart = null;
let gradientChart = null;
let segments = []; // Stores segment data with terrain type
let currentMode = 'manual'; // 'manual' or 'target'
let aidStations = []; // Stores AID station data
let useMetric = true; // true = km, false = miles
let surfaceData = []; // Stores surface data from OSM
let surfaceEnabled = true; // Whether to use surface multipliers

// Constants
const GRADE_THRESHOLD = 2; // percentage grade to determine uphill/downhill
const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;

// Surface type categories and their pace multipliers
// Multipliers are applied on top of terrain (flat/uphill/downhill) paces
const SURFACE_TYPES = {
    road: { name: 'Road', color: '#4CAF50', multiplier: { flat: 1.0, uphill: 1.0, downhill: 1.0 } },
    trail: { name: 'Trail', color: '#FF9800', multiplier: { flat: 1.05, uphill: 1.08, downhill: 1.10 } },
    technical: { name: 'Technical', color: '#9C27B0', multiplier: { flat: 1.15, uphill: 1.20, downhill: 1.25 } },
    unknown: { name: 'Unknown', color: '#9E9E9E', multiplier: { flat: 1.0, uphill: 1.0, downhill: 1.0 } }
};

// OSM surface tag to category mapping
const OSM_SURFACE_MAP = {
    // Road surfaces
    'asphalt': 'road', 'concrete': 'road', 'paved': 'road', 'concrete:plates': 'road',
    'concrete:lanes': 'road', 'paving_stones': 'road', 'sett': 'road', 'cobblestone': 'road',
    // Trail surfaces
    'compacted': 'trail', 'fine_gravel': 'trail', 'gravel': 'trail', 'dirt': 'trail',
    'earth': 'trail', 'ground': 'trail', 'grass': 'trail', 'unpaved': 'trail',
    'sand': 'trail', 'woodchips': 'trail', 'mud': 'trail',
    // Technical surfaces
    'rock': 'technical', 'rocks': 'technical', 'pebblestone': 'technical', 'stepping_stones': 'technical',
    'stone': 'technical', 'boulders': 'technical'
};

// OSM highway type fallback mapping (when no surface tag)
const OSM_HIGHWAY_MAP = {
    'motorway': 'road', 'trunk': 'road', 'primary': 'road', 'secondary': 'road',
    'tertiary': 'road', 'residential': 'road', 'service': 'road', 'unclassified': 'road',
    'path': 'trail', 'footway': 'trail', 'cycleway': 'trail', 'bridleway': 'trail',
    'track': 'trail', 'steps': 'technical'
};

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
    setupUnitToggle();
    setupSaveLoad();
    setupPrintRaceCard();
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
    
    // Display everything (initial view)
    showSections();
    displayStats();
    displayMap();
    displayElevationChart();
    displayGradientChart();
    
    // Fetch surface data from OSM (async, will update display when done)
    fetchSurfaceData();
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
                surfaceType: 'unknown', // Will be updated by fetchSurfaceData
                startPoint: points[segments.length > 0 ? segments[segments.length - 1].endIndex : 0],
                endPoint: points[i]
            });
            
            currentSegmentStart = points[i].distance;
            segmentStartElevation = currentElevation;
        }
    }
}

// Fetch surface data from OpenStreetMap via Overpass API
async function fetchSurfaceData() {
    if (!gpxData || segments.length === 0) return;
    
    // Show loading indicator
    updateSurfaceStatus('Loading surface data from OpenStreetMap...');
    
    try {
        // Sample points along the route (every ~200m to avoid too many queries)
        const samplePoints = [];
        const SAMPLE_INTERVAL = 0.2; // km
        let lastSampleDist = -SAMPLE_INTERVAL;
        
        for (const point of gpxData.points) {
            if (point.distance - lastSampleDist >= SAMPLE_INTERVAL) {
                samplePoints.push({
                    lat: point.lat,
                    lon: point.lon,
                    distance: point.distance
                });
                lastSampleDist = point.distance;
            }
        }
        
        // Build Overpass query for all sample points
        // Query ways near sample points in a single batch
        const bbox = calculateBoundingBox(gpxData.points);
        const overpassQuery = buildOverpassQuery(bbox);
        
        // Try multiple Overpass API endpoints (some may be rate-limited or down)
        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
        ];
        
        let response = null;
        let lastError = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`Trying Overpass endpoint: ${endpoint}`);
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'data=' + encodeURIComponent(overpassQuery)
                });
                
                if (response.ok) {
                    console.log(`Success with endpoint: ${endpoint}`);
                    break;
                } else {
                    lastError = new Error(`HTTP ${response.status}`);
                    response = null;
                }
            } catch (e) {
                console.warn(`Endpoint ${endpoint} failed:`, e.message);
                lastError = e;
            }
        }
        
        if (!response) {
            throw lastError || new Error('All Overpass endpoints failed');
        }
        
        const data = await response.json();
        
        // Process OSM ways and build spatial index
        const ways = processOSMWays(data);
        
        if (ways.length === 0) {
            updateSurfaceStatus('No OSM data found for this area. Using default surfaces.');
            return;
        }
        
        // Match sample points to nearest ways
        const surfaceResults = matchPointsToWays(samplePoints, ways);
        
        // Apply surface data to segments
        applySurfaceToSegments(surfaceResults);
        
        // Update display with surface info
        displayMap(); // Redraw map with surface colors
        displaySurfaceChart();
        updateSurfaceStatus(`Surface data loaded: ${countSurfaces()}`);
        
    } catch (error) {
        console.error('Error fetching surface data:', error);
        updateSurfaceStatus(`Could not load surface data: ${error.message}. Using default surfaces.`);
    }
}

// Calculate bounding box for GPX points
function calculateBoundingBox(points) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    for (const point of points) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLon = Math.min(minLon, point.lon);
        maxLon = Math.max(maxLon, point.lon);
    }
    
    // Add small buffer (~100m)
    const buffer = 0.001;
    return {
        south: minLat - buffer,
        north: maxLat + buffer,
        west: minLon - buffer,
        east: maxLon + buffer
    };
}

// Build Overpass API query
function buildOverpassQuery(bbox) {
    return `[out:json][timeout:30];
(
  way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out body geom;`;
}

// Process OSM ways from Overpass response
function processOSMWays(data) {
    const ways = [];
    
    for (const element of data.elements) {
        if (element.type !== 'way' || !element.geometry) continue;
        
        const tags = element.tags || {};
        const surface = tags.surface || null;
        const highway = tags.highway || null;
        
        // Determine surface category
        let surfaceType = 'unknown';
        if (surface && OSM_SURFACE_MAP[surface]) {
            surfaceType = OSM_SURFACE_MAP[surface];
        } else if (highway && OSM_HIGHWAY_MAP[highway]) {
            surfaceType = OSM_HIGHWAY_MAP[highway];
        }
        
        // Store way with its geometry
        ways.push({
            id: element.id,
            surfaceType,
            surfaceTag: surface,
            highway,
            geometry: element.geometry.map(g => ({ lat: g.lat, lon: g.lon }))
        });
    }
    
    return ways;
}

// Match sample points to nearest OSM ways
function matchPointsToWays(samplePoints, ways) {
    const results = [];
    
    for (const point of samplePoints) {
        let nearestWay = null;
        let minDistance = Infinity;
        
        for (const way of ways) {
            // Find minimum distance from point to any segment of the way
            for (let i = 0; i < way.geometry.length - 1; i++) {
                const dist = pointToLineDistance(
                    point.lat, point.lon,
                    way.geometry[i].lat, way.geometry[i].lon,
                    way.geometry[i + 1].lat, way.geometry[i + 1].lon
                );
                
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestWay = way;
                }
            }
        }
        
        // Only accept matches within ~30 meters
        const MAX_MATCH_DISTANCE = 0.03; // km
        results.push({
            distance: point.distance,
            surfaceType: (nearestWay && minDistance < MAX_MATCH_DISTANCE) ? nearestWay.surfaceType : 'unknown',
            matchDistance: minDistance,
            surfaceTag: nearestWay?.surfaceTag || null
        });
    }
    
    return results;
}

// Calculate perpendicular distance from point to line segment (in km)
function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1; yy = y1;
    } else if (param > 1) {
        xx = x2; yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    return calculateDistance(px, py, xx, yy);
}

// Apply surface results to segments
function applySurfaceToSegments(surfaceResults) {
    surfaceData = surfaceResults;
    
    for (const segment of segments) {
        // Find surface samples within this segment
        const samplesInSegment = surfaceResults.filter(s => 
            s.distance >= segment.startDistance && s.distance <= segment.endDistance
        );
        
        if (samplesInSegment.length > 0) {
            // Use most common surface type in segment
            const counts = {};
            for (const sample of samplesInSegment) {
                counts[sample.surfaceType] = (counts[sample.surfaceType] || 0) + 1;
            }
            
            let maxCount = 0;
            let dominantSurface = 'unknown';
            for (const [type, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxCount = count;
                    dominantSurface = type;
                }
            }
            
            segment.surfaceType = dominantSurface;
        }
    }
}

// Count surfaces for status display
function countSurfaces() {
    const counts = { road: 0, trail: 0, technical: 0, unknown: 0 };
    let totalDist = 0;
    
    for (const segment of segments) {
        counts[segment.surfaceType] += segment.distance;
        totalDist += segment.distance;
    }
    
    const parts = [];
    for (const [type, dist] of Object.entries(counts)) {
        if (dist > 0) {
            const pct = Math.round((dist / totalDist) * 100);
            parts.push(`${SURFACE_TYPES[type].name}: ${pct}%`);
        }
    }
    
    return parts.join(', ');
}

// Update surface status display
function updateSurfaceStatus(message) {
    const statusEl = document.getElementById('surfaceStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

// Display surface type chart
function displaySurfaceChart() {
    const ctx = document.getElementById('surfaceChart');
    if (!ctx) return;
    
    const surfaceDistances = { road: 0, trail: 0, technical: 0, unknown: 0 };
    for (const segment of segments) {
        surfaceDistances[segment.surfaceType] += segment.distance;
    }
    
    const labels = [];
    const data = [];
    const colors = [];
    
    for (const [type, dist] of Object.entries(surfaceDistances)) {
        if (dist > 0) {
            labels.push(SURFACE_TYPES[type].name);
            data.push(dist.toFixed(2));
            colors.push(SURFACE_TYPES[type].color);
        }
    }
    
    new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff' }
                },
                title: {
                    display: true,
                    text: 'Surface Distribution (km)',
                    color: '#fff'
                }
            }
        }
    });
}

// Show hidden sections
function showSections() {
    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('mapSection').style.display = 'block';
    document.getElementById('elevationSection').style.display = 'block';
    document.getElementById('gradientSection').style.display = 'block';
    document.getElementById('surfaceSection').style.display = 'block';
    document.getElementById('paceSection').style.display = 'block';
}

// Display statistics
function displayStats() {
    const distanceKm = gpxData.totalDistance;
    const distanceMiles = distanceKm * KM_TO_MILES;
    
    if (useMetric) {
        document.getElementById('totalDistance').textContent = `${distanceKm.toFixed(2)} km`;
    } else {
        document.getElementById('totalDistance').textContent = `${distanceMiles.toFixed(2)} mi`;
    }
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
    
    // Draw route segments with colors based on terrain AND surface
    const terrainColors = {
        flat: '#4CAF50',
        uphill: '#f44336',
        downhill: '#2196F3'
    };
    
    const points = gpxData.points;
    
    // Check if we have surface data
    const hasSurfaceData = segments.some(s => s.surfaceType !== 'unknown');
    
    // Draw each segment individually for accurate surface/terrain representation
    segments.forEach((segment) => {
        const segmentPoints = [];
        for (let i = segment.startIndex; i <= segment.endIndex; i++) {
            segmentPoints.push([points[i].lat, points[i].lon]);
        }
        
        if (segmentPoints.length < 2) return;
        
        // Create tooltip content
        const tooltipContent = `
            ${segment.terrainType.charAt(0).toUpperCase() + segment.terrainType.slice(1)}
            ${hasSurfaceData ? ' | ' + SURFACE_TYPES[segment.surfaceType].name : ''}
            | ${segment.grade.toFixed(1)}% grade
        `;
        
        // Use surface color if available, otherwise terrain color
        let color;
        if (hasSurfaceData && segment.surfaceType !== 'unknown') {
            color = SURFACE_TYPES[segment.surfaceType].color;
        } else {
            color = terrainColors[segment.terrainType];
        }
        
        const polyline = L.polyline(segmentPoints, {
            color: color,
            weight: 5,
            opacity: 0.8
        }).addTo(map);
        
        polyline.bindTooltip(tooltipContent, { sticky: true });
        routeLayers.push(polyline);
    });
    
    // Add start marker
    L.marker([points[0].lat, points[0].lon])
        .addTo(map)
        .bindPopup('Start');
    
    // Add end marker
    L.marker([points[points.length - 1].lat, points[points.length - 1].lon])
        .addTo(map)
        .bindPopup('Finish');
    
    // Update map legend based on surface data availability
    updateMapLegend(hasSurfaceData);
    
    // Fit map to route bounds
    const latLngs = points.map(p => [p.lat, p.lon]);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [20, 20] });
}

// Update map legend to show either terrain or surface colors
function updateMapLegend(showSurfaceColors) {
    const legendEl = document.querySelector('.map-legend');
    if (!legendEl) return;
    
    if (showSurfaceColors) {
        legendEl.innerHTML = `
            <span class="legend-item"><span class="legend-color" style="background: #4CAF50;"></span> Road</span>
            <span class="legend-item"><span class="legend-color" style="background: #FF9800;"></span> Trail</span>
            <span class="legend-item"><span class="legend-color" style="background: #9C27B0;"></span> Technical</span>
            <span class="legend-item"><span class="legend-color" style="background: #9E9E9E;"></span> Unknown</span>
        `;
    } else {
        legendEl.innerHTML = `
            <span class="legend-item"><span class="legend-color flat"></span> Flat</span>
            <span class="legend-item"><span class="legend-color uphill"></span> Uphill</span>
            <span class="legend-item"><span class="legend-color downhill"></span> Downhill</span>
        `;
    }
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

// Display gradient chart
function displayGradientChart() {
    const ctx = document.getElementById('gradientChart').getContext('2d');
    
    // Destroy existing chart
    if (gradientChart) {
        gradientChart.destroy();
    }
    
    // Calculate gradients from segments
    const labels = [];
    const gradients = [];
    const colors = [];
    
    segments.forEach((segment, index) => {
        const midDistance = (segment.startDistance + segment.endDistance) / 2;
        labels.push(midDistance.toFixed(2));
        gradients.push(segment.grade);
        
        // Color based on gradient
        if (segment.grade > GRADE_THRESHOLD) {
            colors.push('rgba(244, 67, 54, 0.8)'); // red for uphill
        } else if (segment.grade < -GRADE_THRESHOLD) {
            colors.push('rgba(33, 150, 243, 0.8)'); // blue for downhill
        } else {
            colors.push('rgba(76, 175, 80, 0.8)'); // green for flat
        }
    });
    
    gradientChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gradient (%)',
                data: gradients,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1
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
                            return `Gradient: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: useMetric ? 'Distance (km)' : 'Distance (mi)',
                        color: '#888'
                    },
                    ticks: {
                        color: '#888',
                        maxTicksLimit: 15
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Gradient (%)',
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
    const containers = document.querySelectorAll('.chart-container');
    containers.forEach(c => c.style.height = '300px');
}

// Unit Toggle (KM / Miles)
function setupUnitToggle() {
    const kmBtn = document.getElementById('kmBtn');
    const milesBtn = document.getElementById('milesBtn');
    
    if (!kmBtn || !milesBtn) return;
    
    kmBtn.addEventListener('click', () => {
        useMetric = true;
        kmBtn.classList.add('active');
        milesBtn.classList.remove('active');
        updateDistanceHeader();
        if (gpxData) {
            displayStats();
            // Recalculate if plan was already calculated
            const paceResults = document.getElementById('paceResults');
            if (paceResults && paceResults.style.display !== 'none') {
                calculateRacePlan();
            }
        }
    });
    
    milesBtn.addEventListener('click', () => {
        useMetric = false;
        milesBtn.classList.add('active');
        kmBtn.classList.remove('active');
        updateDistanceHeader();
        if (gpxData) {
            displayStats();
            const paceResults = document.getElementById('paceResults');
            if (paceResults && paceResults.style.display !== 'none') {
                calculateRacePlan();
            }
        }
    });
}

function updateDistanceHeader() {
    const header = document.getElementById('distanceHeader');
    if (header) {
        header.textContent = useMetric ? 'KM' : 'Mile';
    }
}

// Save/Load Plan functionality
function setupSaveLoad() {
    const saveBtn = document.getElementById('savePlanBtn');
    const loadBtn = document.getElementById('loadPlanBtn');
    
    if (!saveBtn || !loadBtn) return;
    
    saveBtn.addEventListener('click', savePlan);
    loadBtn.addEventListener('click', loadPlan);
}

function savePlan() {
    const plan = {
        aidStations: aidStations,
        mode: currentMode,
        useMetric: useMetric,
        startTime: document.getElementById('raceStartTime')?.value || '09:00',
        flatPaceMin: document.getElementById('flatPaceMin')?.value || '5',
        flatPaceSec: document.getElementById('flatPaceSec')?.value || '30',
        uphillPaceMin: document.getElementById('uphillPaceMin')?.value || '6',
        uphillPaceSec: document.getElementById('uphillPaceSec')?.value || '30',
        downhillPaceMin: document.getElementById('downhillPaceMin')?.value || '5',
        downhillPaceSec: document.getElementById('downhillPaceSec')?.value || '0',
        targetHours: document.getElementById('targetHours')?.value || '0',
        targetMinutes: document.getElementById('targetMinutes')?.value || '45',
        targetSeconds: document.getElementById('targetSeconds')?.value || '0',
        uphillRatio: document.getElementById('uphillRatio')?.value || '1.2',
        downhillRatio: document.getElementById('downhillRatio')?.value || '0.9'
    };
    
    localStorage.setItem('gpxray_plan', JSON.stringify(plan));
    alert('Plan saved successfully!');
}

function loadPlan() {
    const saved = localStorage.getItem('gpxray_plan');
    if (!saved) {
        alert('No saved plan found.');
        return;
    }
    
    try {
        const plan = JSON.parse(saved);
        
        // Restore AID stations
        aidStations = plan.aidStations || [];
        renderAidStations();
        
        // Restore mode
        currentMode = plan.mode || 'manual';
        const manualBtn = document.getElementById('manualModeBtn');
        const targetBtn = document.getElementById('targetModeBtn');
        const manualMode = document.getElementById('manualMode');
        const targetMode = document.getElementById('targetMode');
        
        if (currentMode === 'manual') {
            manualBtn?.classList.add('active');
            targetBtn?.classList.remove('active');
            if (manualMode) manualMode.style.display = 'block';
            if (targetMode) targetMode.style.display = 'none';
        } else {
            targetBtn?.classList.add('active');
            manualBtn?.classList.remove('active');
            if (targetMode) targetMode.style.display = 'block';
            if (manualMode) manualMode.style.display = 'none';
        }
        
        // Restore unit
        useMetric = plan.useMetric !== false;
        const kmBtn = document.getElementById('kmBtn');
        const milesBtn = document.getElementById('milesBtn');
        if (useMetric) {
            kmBtn?.classList.add('active');
            milesBtn?.classList.remove('active');
        } else {
            milesBtn?.classList.add('active');
            kmBtn?.classList.remove('active');
        }
        
        // Restore values
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('raceStartTime', plan.startTime);
        setVal('flatPaceMin', plan.flatPaceMin);
        setVal('flatPaceSec', plan.flatPaceSec);
        setVal('uphillPaceMin', plan.uphillPaceMin);
        setVal('uphillPaceSec', plan.uphillPaceSec);
        setVal('downhillPaceMin', plan.downhillPaceMin);
        setVal('downhillPaceSec', plan.downhillPaceSec);
        setVal('targetHours', plan.targetHours);
        setVal('targetMinutes', plan.targetMinutes);
        setVal('targetSeconds', plan.targetSeconds);
        setVal('uphillRatio', plan.uphillRatio);
        setVal('downhillRatio', plan.downhillRatio);
        
        alert('Plan loaded successfully!');
    } catch (e) {
        alert('Error loading plan.');
        console.error(e);
    }
}

// Print Race Card functionality
function setupPrintRaceCard() {
    const printBtn = document.getElementById('printRaceCard');
    if (!printBtn) return;
    
    printBtn.addEventListener('click', printRaceCard);
}

function printRaceCard() {
    if (!gpxData) {
        alert('Please load a GPX file first.');
        return;
    }
    
    const splitsBody = document.getElementById('splitsBody');
    if (!splitsBody || splitsBody.children.length === 0) {
        alert('Please calculate a race plan first.');
        return;
    }
    
    // Prepare print content
    const distanceUnit = useMetric ? 'km' : 'mi';
    const distance = useMetric ? gpxData.totalDistance : gpxData.totalDistance * KM_TO_MILES;
    
    document.getElementById('printTitle').textContent = 'Race Plan';
    document.getElementById('printDistance').textContent = `${distance.toFixed(2)} ${distanceUnit}`;
    document.getElementById('printElevation').textContent = `↑${gpxData.elevationGain.toFixed(0)}m ↓${gpxData.elevationLoss.toFixed(0)}m`;
    document.getElementById('printTime').textContent = document.getElementById('totalTime')?.textContent || '-';
    
    // Update print table header for units
    const printDistHeader = document.getElementById('printDistanceHeader');
    if (printDistHeader) {
        printDistHeader.textContent = useMetric ? 'KM' : 'Mile';
    }
    
    // Copy splits to print table
    const printBody = document.getElementById('printSplitsBody');
    printBody.innerHTML = '';
    
    const rows = splitsBody.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const printRow = document.createElement('tr');
        
        // Check if it's an AID station row
        if (row.classList.contains('aid-station-row')) {
            printRow.classList.add('aid-row');
        }
        
        // KM, AID, Pace, Race Time, Clock (columns 0, 3, 4, 6, 7)
        const indices = [0, 3, 4, 6, 7];
        indices.forEach(i => {
            const td = document.createElement('td');
            td.textContent = cells[i]?.textContent || '-';
            printRow.appendChild(td);
        });
        
        printBody.appendChild(printRow);
    });
    
    // Trigger print
    window.print();
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
    
    // Check if surface multipliers are enabled
    const surfaceToggle = document.getElementById('surfaceEnabled');
    const applySurface = surfaceToggle ? surfaceToggle.checked : false;
    
    segments.forEach(segment => {
        // Get surface multiplier if enabled
        const surfaceMultiplier = applySurface && SURFACE_TYPES[segment.surfaceType] 
            ? SURFACE_TYPES[segment.surfaceType].multiplier[segment.terrainType]
            : 1.0;
        
        switch (segment.terrainType) {
            case 'flat':
                flatDistance += segment.distance;
                flatTime += segment.distance * flatPace * surfaceMultiplier;
                break;
            case 'uphill':
                uphillDistance += segment.distance;
                uphillTime += segment.distance * uphillPace * surfaceMultiplier;
                break;
            case 'downhill':
                downhillDistance += segment.distance;
                downhillTime += segment.distance * downhillPace * surfaceMultiplier;
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
    
    // Determine unit system and total distance
    const totalDistanceKm = gpxData.totalDistance;
    const unitLabel = useMetric ? 'km' : 'mi';
    const totalUnits = useMetric ? Math.ceil(totalDistanceKm) : Math.ceil(totalDistanceKm * KM_TO_MILES);
    
    // Pace conversion: input paces are in min/km, convert to min/mi if needed
    const paceMultiplier = useMetric ? 1 : MILES_TO_KM;
    const displayFlatPace = flatPace * paceMultiplier;
    const displayUphillPace = uphillPace * paceMultiplier;
    const displayDownhillPace = downhillPace * paceMultiplier;
    
    // Get start time
    const startTimeInput = document.getElementById('raceStartTime');
    const startTimeValue = startTimeInput ? startTimeInput.value : '09:00';
    const [startHours, startMinutes] = startTimeValue.split(':').map(Number);
    const startTimeInMinutes = startHours * 60 + startMinutes;
    
    let cumulativeTime = 0;
    
    // Get average pace for AID station time calculations
    const avgPace = (flatPace + uphillPace + downhillPace) / 3;
    
    // Calculate splits per unit (km or mile)
    for (let unit = 1; unit <= totalUnits; unit++) {
        // Convert unit boundaries to km for internal calculations
        const unitStartKm = useMetric ? (unit - 1) : ((unit - 1) * MILES_TO_KM);
        const unitEndKm = useMetric ? Math.min(unit, totalDistanceKm) : Math.min(unit * MILES_TO_KM, totalDistanceKm);
        
        // Find elevation change for this unit
        let startElevation = 0, endElevation = 0;
        let dominantTerrain = { flat: 0, uphill: 0, downhill: 0 };
        
        // Find points within this unit range (using km internally)
        for (const segment of segments) {
            if (segment.endDistance >= unitStartKm && segment.startDistance < unitEndKm) {
                const overlapStart = Math.max(segment.startDistance, unitStartKm);
                const overlapEnd = Math.min(segment.endDistance, unitEndKm);
                const overlapDistance = overlapEnd - overlapStart;
                
                dominantTerrain[segment.terrainType] += overlapDistance;
                
                if (startElevation === 0) {
                    startElevation = segment.startPoint.elevation;
                }
                endElevation = segment.endPoint.elevation;
            }
        }
        
        // Determine dominant terrain for this unit
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
        const distanceKm = unitEndKm - unitStartKm;
        
        // Check if surface multipliers are enabled
        const surfaceToggle = document.getElementById('surfaceEnabled');
        const applySurface = surfaceToggle ? surfaceToggle.checked : false;
        
        // Calculate pace for this unit based on terrain and surface distribution (using km internally)
        let unitTime = 0;
        let dominantSurface = 'unknown';
        let maxSurfaceDist = 0;
        
        // Calculate time with surface multipliers if enabled
        for (const segment of segments) {
            if (segment.endDistance >= unitStartKm && segment.startDistance < unitEndKm) {
                const overlapStart = Math.max(segment.startDistance, unitStartKm);
                const overlapEnd = Math.min(segment.endDistance, unitEndKm);
                const overlapDistance = overlapEnd - overlapStart;
                
                // Track dominant surface for this unit
                if (applySurface && segment.surfaceType !== 'unknown') {
                    // Simple tracking - could be improved with proper counting
                    if (overlapDistance > maxSurfaceDist) {
                        maxSurfaceDist = overlapDistance;
                        dominantSurface = segment.surfaceType;
                    }
                }
                
                // Get surface multiplier
                const surfaceMultiplier = applySurface && SURFACE_TYPES[segment.surfaceType]
                    ? SURFACE_TYPES[segment.surfaceType].multiplier[segment.terrainType]
                    : 1.0;
                
                // Calculate time for this overlap
                let basePace;
                switch (segment.terrainType) {
                    case 'uphill': basePace = uphillPace; break;
                    case 'downhill': basePace = downhillPace; break;
                    default: basePace = flatPace;
                }
                
                unitTime += overlapDistance * basePace * surfaceMultiplier;
            }
        }
        
        // Check for AID stations within this unit (before adding main row)
        const aidStationsInUnit = aidStations.filter(station => {
            // AID stations are stored in km, convert if needed
            const stationInUnit = useMetric ? station.km : station.km * KM_TO_MILES;
            return stationInUnit > (unit - 1) && stationInUnit < unit && stationInUnit % 1 !== 0;
        });
        
        // Add AID station rows for fractional positions
        for (const station of aidStationsInUnit) {
            const stationKm = station.km;
            // Calculate time to station based on km distance
            const fractionOfUnit = (stationKm - unitStartKm) / distanceKm;
            const timeToStation = cumulativeTime + (unitTime * fractionOfUnit);
            const clockTimeMinutes = startTimeInMinutes + timeToStation;
            const clockTime = formatClockTime(clockTimeMinutes);
            const displayDistance = useMetric ? station.km : station.km * KM_TO_MILES;

            const aidRow = document.createElement('tr');
            aidRow.classList.add('aid-station-row');
            aidRow.innerHTML = `
                <td>${displayDistance.toFixed(1)}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td class="aid-station-cell">${station.name}</td>
                <td>-</td>
                <td>-</td>
                <td>${formatTime(timeToStation)}</td>
                <td>${clockTime}</td>
            `;
            splitsBody.appendChild(aidRow);
        }
        
        // Update cumulative time
        cumulativeTime += unitTime;
        
        // Get target pace for dominant terrain (display pace for selected unit)
        let targetPace;
        switch (terrain) {
            case 'uphill': targetPace = displayUphillPace; break;
            case 'downhill': targetPace = displayDownhillPace; break;
            default: targetPace = displayFlatPace;
        }
        
        // Calculate clock time
        const clockTimeMinutes = startTimeInMinutes + cumulativeTime;
        const clockTime = formatClockTime(clockTimeMinutes);
        
        // Split time is the time for this unit
        const splitTime = unitTime;
        
        // Check for AID station at this unit
        const aidStation = aidStations.find(s => {
            const stationInUnit = useMetric ? s.km : s.km * KM_TO_MILES;
            return Math.floor(stationInUnit) === unit || Math.round(stationInUnit) === unit;
        });
        const aidStationText = aidStation ? aidStation.name : '-';
        const hasAidStation = aidStation !== undefined;
        
        const row = document.createElement('tr');
        if (hasAidStation) {
            row.classList.add('aid-station-row');
        }
        
        // Get surface display name
        const surfaceDisplay = SURFACE_TYPES[dominantSurface] ? SURFACE_TYPES[dominantSurface].name : 'Unknown';
        
        row.innerHTML = `
            <td>${unit}</td>
            <td>${elevationChange >= 0 ? '+' : ''}${elevationChange.toFixed(0)} m</td>
            <td class="terrain-${terrain}">${terrain.charAt(0).toUpperCase() + terrain.slice(1)}</td>
            <td class="surface-${dominantSurface}">${surfaceDisplay}</td>
            <td class="${hasAidStation ? 'aid-station-cell' : ''}">${aidStationText}</td>
            <td>${formatPace(targetPace)} /${unitLabel}</td>
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
    
    // Unit settings
    const unitLabel = useMetric ? 'km' : 'mi';
    const distanceDisplay = useMetric ? gpxData.totalDistance.toFixed(2) : (gpxData.totalDistance * KM_TO_MILES).toFixed(2);

    // Add summary section
    csvContent += 'GPX RACE PLAN EXPORT\n';
    csvContent += `Mode,${currentMode === 'manual' ? 'Manual Pace' : 'Target Time'}\n`;
    csvContent += `Race Start Time,${startTimeValue}\n`;
    csvContent += `Units,${useMetric ? 'Metric (km)' : 'Imperial (miles)'}\n`;
    csvContent += '\n';
    csvContent += 'ROUTE STATISTICS\n';
    csvContent += `Total Distance,${distanceDisplay} ${unitLabel}\n`;
    csvContent += `Elevation Gain,${gpxData.elevationGain.toFixed(0)} m\n`;
    csvContent += `Elevation Loss,${gpxData.elevationLoss.toFixed(0)} m\n`;
    csvContent += `Min Elevation,${gpxData.minElevation.toFixed(0)} m\n`;
    csvContent += `Max Elevation,${gpxData.maxElevation.toFixed(0)} m\n`;
    csvContent += '\n';
    csvContent += 'PACE SETTINGS\n';
    const displayFlatPace = useMetric ? flatPace : flatPace * MILES_TO_KM;
    const displayUphillPace = useMetric ? uphillPace : uphillPace * MILES_TO_KM;
    const displayDownhillPace = useMetric ? downhillPace : downhillPace * MILES_TO_KM;
    csvContent += `Flat Pace,${formatPace(displayFlatPace)} /${unitLabel}\n`;
    csvContent += `Uphill Pace,${formatPace(displayUphillPace)} /${unitLabel}\n`;
    csvContent += `Downhill Pace,${formatPace(displayDownhillPace)} /${unitLabel}\n`;
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
        csvContent += `${unitLabel.toUpperCase()},Name\n`;
        aidStations.forEach(station => {
            const stationDist = useMetric ? station.km : station.km * KM_TO_MILES;
            csvContent += `${stationDist.toFixed(1)},${station.name}\n`;
        });
        csvContent += '\n';
    }

    // Add splits table
    csvContent += `${useMetric ? 'KILOMETER' : 'MILE'} SPLITS\n`;
    
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
