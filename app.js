// Global state
let gpxData = null;
let map = null;
let routeLayers = [];
let elevationChart = null;
let gradientChart = null;
let segments = []; // Stores segment data with terrain type
let currentMode = 'target'; // 'manual', 'target', or 'itra'
let aidStations = []; // Stores AID station data
let useMetric = true; // true = km, false = miles
let surfaceData = []; // Stores surface data from OSM
let surfaceEnabled = true; // Whether to use surface multipliers
let currentRouteName = ''; // Name of current loaded route
let sunTimes = null; // Sunrise/sunset times for race day

// Constants
const GRADE_THRESHOLD = 2; // percentage grade to determine uphill/downhill
const HISTORY_KEY = 'gpxray_history'; // localStorage key for history
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
    setupChartSelector();
    setupHistory();
    setupFeedback();
    setupDemo();
    setupSunTimes();
    setupRaceBrowser();
});

// Sun times setup
function setupSunTimes() {
    const dateInput = document.getElementById('raceStartDate');
    const timeInput = document.getElementById('raceStartTime');
    
    if (dateInput) {
        // Set default to today's date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        dateInput.value = dateStr;
        
        // Update sun times when date changes
        dateInput.addEventListener('change', updateSunTimesDisplay);
    }
    
    // Update splits table when time changes (for night section highlighting)
    if (timeInput) {
        timeInput.addEventListener('change', () => {
            if (segments.length > 0) {
                generateSplitsTable();
            }
        });
    }
}

// Demo GPX loading
function setupDemo() {
    const demoBtn = document.getElementById('loadDemoBtn');
    if (!demoBtn) return;
    
    demoBtn.addEventListener('click', loadDemoGpx);
}

async function loadDemoGpx() {
    const demoBtn = document.getElementById('loadDemoBtn');
    const originalText = demoBtn.textContent;
    
    try {
        demoBtn.disabled = true;
        demoBtn.textContent = '⏳ Loading...';
        
        const response = await fetch('races/demo.gpx');
        if (!response.ok) {
            throw new Error('Failed to load demo file');
        }
        
        const gpxContent = await response.text();
        currentRouteName = 'ZUT Garmisch-Partenkirchen Trail';
        parseGPX(gpxContent);
        
        // Add sample AID stations for demo
        aidStations = [
            { km: 5.2, name: 'VP1 Hammersbach', stopMin: 3 },
            { km: 12.8, name: 'VP2 Kreuzeck', stopMin: 5 },
            { km: 18.5, name: 'VP3 Hausberg', stopMin: 3 }
        ];
        renderAidStations();
        
        demoBtn.textContent = '✅ Demo Loaded!';
        setTimeout(() => {
            demoBtn.textContent = originalText;
            demoBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error loading demo:', error);
        alert('Failed to load demo GPX file.');
        demoBtn.textContent = originalText;
        demoBtn.disabled = false;
    }
}

// Race Database
const raceDatabase = [
    // ===== AVAILABLE RACES =====
    
    // ZUT - Zugspitz Ultratrail (Germany)
    { id: 'zut-grainau', name: 'ZUT Grainau Trail', country: '🇩🇪', distance: 16, elevation: 800, category: 'short', gpxUrl: 'races/Grainau_Trail_ZUT_2025_01bfa09fb6.gpx', available: true },
    { id: 'zut-mittenwald', name: 'ZUT Mittenwald Trail', country: '🇩🇪', distance: 43, elevation: 2100, category: 'marathon', gpxUrl: 'races/Mittenwald_Trail_ZUT_2025_fa6c0d4010.gpx', available: true },
    { id: 'zut-leutasch', name: 'ZUT Leutasch Trail', country: '🇩🇪', distance: 68, elevation: 3500, category: 'marathon', gpxUrl: 'races/Leutasch_Trail_ZUT_2025_620e36ae36.gpx', available: true },
    { id: 'zut-ehrwald', name: 'ZUT Ehrwald Trail', country: '🇩🇪', distance: 85, elevation: 4500, category: 'marathon', gpxUrl: 'races/Ehrwald_Trail_ZUT_2025_85a841b963.gpx', available: true },
    { id: 'zut-ultratrail', name: 'ZUT Ultratrail', country: '🇩🇪', distance: 106, elevation: 5400, category: 'ultra', gpxUrl: 'races/Ultratrail_ZUT_2025_3b6cbaa510.gpx', available: true },
    { id: 'zut-100', name: 'ZUT 100', country: '🇩🇪', distance: 164, elevation: 8500, category: 'ultra', gpxUrl: 'races/ZUT_100_2025_71c0e173fd.gpx', available: true },
    
    // Rureifel Trail (Germany)
    { id: 'ret-44', name: 'Rureifel Trail RET 44', country: '🇩🇪', distance: 46, elevation: 1200, category: 'marathon', gpxUrl: 'races/rureifel-trail-2026-ret44.gpx', available: true },
    { id: 'ret-77', name: 'Rureifel Trail RET 77', country: '🇩🇪', distance: 76, elevation: 2000, category: 'marathon', gpxUrl: 'races/rureifel-trail-2026-ret77.gpx', available: true },
    
    // ===== COMING SOON =====
    
    // Ultra Trail (100km+)
    { id: 'utmb', name: 'UTMB - Ultra-Trail du Mont-Blanc', country: '🇫🇷', distance: 171, elevation: 10000, category: 'ultra', available: false },
    { id: 'wser', name: 'Western States 100', country: '🇺🇸', distance: 161, elevation: 5500, category: 'ultra', available: false },
    { id: 'hardrock', name: 'Hardrock 100', country: '🇺🇸', distance: 161, elevation: 10000, category: 'ultra', available: false },
    { id: 'lavaredo', name: 'Lavaredo Ultra Trail', country: '🇮🇹', distance: 120, elevation: 5800, category: 'ultra', available: false },
    { id: 'transgrancanaria', name: 'Transgrancanaria', country: '🇪🇸', distance: 128, elevation: 7500, category: 'ultra', available: false },
    { id: 'eiger', name: 'Eiger Ultra Trail E101', country: '🇨🇭', distance: 101, elevation: 6700, category: 'ultra', available: false },
    { id: 'madeira', name: 'Madeira Island Ultra Trail', country: '🇵🇹', distance: 115, elevation: 7200, category: 'ultra', available: false },
    { id: 'penyagolosa', name: 'Penyagolosa Trails MiM', country: '🇪🇸', distance: 109, elevation: 5700, category: 'ultra', available: false },
    
    // Marathon Trail (42-100km)
    { id: 'ccc', name: 'CCC - Courmayeur-Champex-Chamonix', country: '🇫🇷', distance: 101, elevation: 6100, category: 'marathon', available: false },
    { id: 'tds', name: 'TDS - Sur les Traces des Ducs de Savoie', country: '🇫🇷', distance: 145, elevation: 9100, category: 'ultra', available: false },
    { id: 'occ', name: 'OCC - Orsières-Champex-Chamonix', country: '🇫🇷', distance: 55, elevation: 3500, category: 'marathon', available: false },
    { id: 'zermatt', name: 'Matterhorn Ultraks 46K', country: '🇨🇭', distance: 46, elevation: 3600, category: 'marathon', available: false },
    { id: 'sierre-zinal', name: 'Sierre-Zinal', country: '🇨🇭', distance: 31, elevation: 2200, category: 'short', available: false },
    { id: 'gorge', name: 'Columbia River Gorge 50', country: '🇺🇸', distance: 80, elevation: 2700, category: 'marathon', available: false },
    { id: 'dolomiti', name: 'Dolomiti Extreme Trail', country: '🇮🇹', distance: 52, elevation: 3900, category: 'marathon', available: false },
    
    // Short Trail (<42km)
    { id: 'mont-blanc-marathon', name: 'Marathon du Mont-Blanc', country: '🇫🇷', distance: 42, elevation: 2700, category: 'marathon', available: false },
    { id: 'jungfrau', name: 'Jungfrau Marathon', country: '🇨🇭', distance: 42, elevation: 1800, category: 'marathon', available: false },
    { id: 'pikes', name: "Pikes Peak Marathon", country: '🇺🇸', distance: 42, elevation: 2400, category: 'marathon', available: false },
    { id: 'innsbruck', name: 'Innsbruck Alpine K42', country: '🇦🇹', distance: 42, elevation: 2500, category: 'marathon', available: false },
    { id: 'ben-nevis', name: 'Ben Nevis Ultra 23K', country: '🇬🇧', distance: 23, elevation: 1400, category: 'short', available: false },
    { id: 'val-daran', name: 'Val d\'Aran by UTMB 21K', country: '🇪🇸', distance: 21, elevation: 1200, category: 'short', available: false }
];

function setupRaceBrowser() {
    const browseBtn = document.getElementById('browseRacesBtn');
    const panel = document.getElementById('raceBrowserPanel');
    const overlay = document.getElementById('raceBrowserOverlay');
    const closeBtn = document.getElementById('raceBrowserClose');
    const searchInput = document.getElementById('raceSearchInput');
    const filterBtns = document.querySelectorAll('.race-filter-btn');
    
    if (!browseBtn || !panel) return;
    
    let currentFilter = 'all';
    
    // Open panel
    browseBtn.addEventListener('click', () => {
        panel.classList.add('active');
        overlay.classList.add('active');
        renderRaceList(currentFilter, '');
        searchInput.focus();
    });
    
    // Close panel
    const closePanel = () => {
        panel.classList.remove('active');
        overlay.classList.remove('active');
    };
    
    closeBtn?.addEventListener('click', closePanel);
    overlay?.addEventListener('click', closePanel);
    
    // Search
    searchInput?.addEventListener('input', (e) => {
        renderRaceList(currentFilter, e.target.value);
    });
    
    // Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderRaceList(currentFilter, searchInput?.value || '');
        });
    });
}

function renderRaceList(filter, searchText) {
    const list = document.getElementById('raceBrowserList');
    if (!list) return;
    
    const query = searchText.toLowerCase();
    
    const filtered = raceDatabase.filter(race => {
        // Filter by category
        if (filter !== 'all' && race.category !== filter) return false;
        
        // Filter by search text
        if (query && !race.name.toLowerCase().includes(query) && !race.country.includes(query)) {
            return false;
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-races-found">No races found matching your criteria.</div>';
        return;
    }
    
    list.innerHTML = filtered.map(race => {
        if (race.available) {
            return `
                <div class="race-item" onclick="loadRace('${race.id}')">
                    <span class="race-item-flag">${race.country}</span>
                    <div class="race-item-info">
                        <div class="race-item-name">${race.name}</div>
                        <div class="race-item-details">
                            <span>📏 ${race.distance} km</span>
                            <span>⛰️ ${race.elevation.toLocaleString()}m D+</span>
                        </div>
                    </div>
                    <button class="race-item-load" onclick="event.stopPropagation(); loadRace('${race.id}')">Load</button>
                </div>
            `;
        } else {
            return `
                <div class="race-item race-item-unavailable">
                    <span class="race-item-flag">${race.country}</span>
                    <div class="race-item-info">
                        <div class="race-item-name">${race.name}</div>
                        <div class="race-item-details">
                            <span>📏 ${race.distance} km</span>
                            <span>⛰️ ${race.elevation.toLocaleString()}m D+</span>
                        </div>
                    </div>
                    <span class="race-item-coming-soon">Coming Soon</span>
                </div>
            `;
        }
    }).join('');
}

async function loadRace(raceId) {
    const race = raceDatabase.find(r => r.id === raceId);
    if (!race) return;
    
    const panel = document.getElementById('raceBrowserPanel');
    const overlay = document.getElementById('raceBrowserOverlay');
    
    try {
        // Show loading state
        const loadBtns = document.querySelectorAll('.race-item-load');
        loadBtns.forEach(btn => btn.disabled = true);
        
        const response = await fetch(race.gpxUrl);
        if (!response.ok) {
            throw new Error('GPX file not available');
        }
        
        const gpxContent = await response.text();
        currentRouteName = race.name;
        parseGPX(gpxContent);
        
        // Clear AID stations for new race (user can add their own)
        aidStations = [];
        renderAidStations();
        
        // Close panel
        panel?.classList.remove('active');
        overlay?.classList.remove('active');
        
    } catch (error) {
        console.error('Error loading race:', error);
        alert(`Sorry, the GPX file for "${race.name}" is not available yet. We're working on adding more races!`);
        
        const loadBtns = document.querySelectorAll('.race-item-load');
        loadBtns.forEach(btn => btn.disabled = false);
    }
}

// Make loadRace globally available
window.loadRace = loadRace;

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

    // Mobile browse button
    const browseBtnMobile = document.getElementById('browseBtnMobile');
    if (browseBtnMobile) {
        browseBtnMobile.addEventListener('click', (e) => {
            e.stopPropagation();
            gpxInput.click();
        });
    }

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
    // Store filename (without extension) as default route name
    currentRouteName = file.name.replace(/\.gpx$/i, '');
    
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
    
    // Try to extract route name from GPX metadata
    const nameTag = xmlDoc.querySelector('metadata > name') || 
                    xmlDoc.querySelector('trk > name') || 
                    xmlDoc.querySelector('rte > name');
    if (nameTag && nameTag.textContent.trim()) {
        currentRouteName = nameTag.textContent.trim();
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
    
    // Update ITRA effort display
    updateItraEffortDisplay();
    
    // Re-render AID stations to show leg info with GPX data
    renderAidStations();
    
    // Show surface loading state and fetch data from OSM
    showSurfaceLoading();
    fetchSurfaceData();
    
    // Update sun times display based on route center
    updateSunTimesDisplay();
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
        const overpassQuery = buildOverpassQuery(bbox, samplePoints);
        
        console.log(`Route bbox area: ${(bbox.north - bbox.south) * (bbox.east - bbox.west).toFixed(6)}`);
        console.log(`Sample points: ${samplePoints.length}`);
        
        // Try multiple Overpass API endpoints (some may be rate-limited or down)
        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://z.overpass-api.de/api/interpreter'
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
                    // Check content-type to ensure it's JSON, not an error page
                    const contentType = response.headers.get('content-type') || '';
                    if (!contentType.includes('application/json')) {
                        console.warn(`Endpoint ${endpoint} returned non-JSON: ${contentType}`);
                        lastError = new Error(`Non-JSON response: ${contentType}`);
                        response = null;
                        continue;
                    }
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
        
        // Read response text first to validate it's actually JSON
        const responseText = await response.text();
        if (responseText.startsWith('<?xml') || responseText.startsWith('<')) {
            throw new Error('API returned XML error page instead of JSON');
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error('Invalid JSON response from API');
        }
        
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
        displaySurfaceStats();
        
        // If race plan was already calculated, recalculate to show surface data
        const splitsSection = document.getElementById('splitsSection');
        if (splitsSection && splitsSection.style.display !== 'none') {
            calculateRacePlan();
        }
        
    } catch (error) {
        console.error('Error fetching surface data:', error);
        // Show stats with default/unknown surfaces
        displaySurfaceStats();
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

// Build Overpass API query - use around filter for better performance on long routes
function buildOverpassQuery(bbox, samplePoints) {
    // For large routes, query around sample points instead of full bbox
    // This is much faster than querying the entire bounding box
    
    // Calculate bbox area (rough approximation)
    const latDiff = bbox.north - bbox.south;
    const lonDiff = bbox.east - bbox.west;
    const bboxArea = latDiff * lonDiff;
    
    // If bbox is small (< ~10km x 10km), use simple bbox query
    if (bboxArea < 0.01) {
        return `[out:json][timeout:60];
(
  way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out body geom;`;
    }
    
    // For larger areas, use "around" query with sample points (much faster)
    // Limit to ~20 points to keep query manageable
    const step = Math.max(1, Math.floor(samplePoints.length / 20));
    const queryPoints = samplePoints.filter((_, i) => i % step === 0);
    
    // Build around filter - format: around:radius,lat1,lon1,lat2,lon2,...
    const coordString = queryPoints.map(p => `${p.lat},${p.lon}`).join(',');
    
    console.log(`Using around query with ${queryPoints.length} points`);
    
    return `[out:json][timeout:60];
(
  way["highway"](around:50,${coordString});
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
    
    // Sort results by distance for efficient lookup
    const sortedSamples = [...surfaceResults].sort((a, b) => a.distance - b.distance);
    
    for (const segment of segments) {
        const segmentMidpoint = (segment.startDistance + segment.endDistance) / 2;
        
        // Find surface samples within this segment
        const samplesInSegment = sortedSamples.filter(s => 
            s.distance >= segment.startDistance && s.distance <= segment.endDistance
        );
        
        if (samplesInSegment.length > 0) {
            // Use most common non-unknown surface type in segment
            const counts = {};
            for (const sample of samplesInSegment) {
                if (sample.surfaceType !== 'unknown') {
                    counts[sample.surfaceType] = (counts[sample.surfaceType] || 0) + 1;
                }
            }
            
            let maxCount = 0;
            let dominantSurface = 'unknown';
            for (const [type, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxCount = count;
                    dominantSurface = type;
                }
            }
            
            if (dominantSurface !== 'unknown') {
                segment.surfaceType = dominantSurface;
                continue;
            }
        }
        
        // No samples in segment - find nearest sample by distance
        let nearestSample = null;
        let minDist = Infinity;
        
        for (const sample of sortedSamples) {
            if (sample.surfaceType === 'unknown') continue;
            
            const dist = Math.abs(sample.distance - segmentMidpoint);
            if (dist < minDist) {
                minDist = dist;
                nearestSample = sample;
            }
        }
        
        // Only use interpolation within reasonable distance (500m)
        if (nearestSample && minDist < 0.5) {
            segment.surfaceType = nearestSample.surfaceType;
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

// Display surface stats under map (replacing pie chart)
// Show surface loading state
function showSurfaceLoading() {
    const statsContainer = document.getElementById('surfaceStats');
    const loadingEl = document.getElementById('surfaceLoading');
    const statsRow = document.getElementById('surfaceStatsRow');
    const toggleLabel = document.getElementById('surfaceToggleLabel');
    
    if (statsContainer) statsContainer.style.display = 'block';
    if (loadingEl) loadingEl.style.display = 'flex';
    if (statsRow) statsRow.style.display = 'none';
    if (toggleLabel) toggleLabel.style.display = 'none';
}

// Display surface stats under map
function displaySurfaceStats() {
    const statsContainer = document.getElementById('surfaceStats');
    const statsRow = document.getElementById('surfaceStatsRow');
    const loadingEl = document.getElementById('surfaceLoading');
    const toggleLabel = document.getElementById('surfaceToggleLabel');
    
    if (!statsContainer || !statsRow) return;
    
    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';
    
    const surfaceDistances = { road: 0, trail: 0, technical: 0, unknown: 0 };
    let totalDistance = 0;
    
    for (const segment of segments) {
        surfaceDistances[segment.surfaceType] += segment.distance;
        totalDistance += segment.distance;
    }
    
    if (totalDistance === 0) {
        statsContainer.style.display = 'none';
        return;
    }
    
    // Build stats HTML
    let html = '';
    for (const [type, dist] of Object.entries(surfaceDistances)) {
        if (dist > 0) {
            const pct = ((dist / totalDistance) * 100).toFixed(0);
            html += `
                <span class="surface-stat-item">
                    <span class="surface-color ${type}"></span>
                    <span class="surface-pct">${pct}%</span>
                    <span class="surface-name">${SURFACE_TYPES[type].name}</span>
                </span>
            `;
        }
    }
    
    statsRow.innerHTML = html;
    statsRow.style.display = 'flex';
    statsContainer.style.display = 'block';
    if (toggleLabel) toggleLabel.style.display = 'flex';
}

// Show hidden sections
function showSections() {
    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('mapSection').style.display = 'block';
    document.getElementById('elevationSection').style.display = 'block';
    document.getElementById('paceSection').style.display = 'block';
}

// Setup chart selector for elevation/gradient toggle
function setupChartSelector() {
    const selector = document.getElementById('chartSelector');
    if (!selector) return;
    
    selector.addEventListener('change', () => {
        const elevationContainer = document.getElementById('elevationChartContainer');
        const gradientContainer = document.getElementById('gradientChartContainer');
        
        if (selector.value === 'elevation') {
            elevationContainer.style.display = 'block';
            gradientContainer.style.display = 'none';
        } else {
            elevationContainer.style.display = 'none';
            gradientContainer.style.display = 'block';
        }
    });
}

// Display statistics
function displayStats() {
    // Display route name
    const routeNameEl = document.getElementById('routeName');
    if (routeNameEl) {
        routeNameEl.textContent = currentRouteName || 'Unknown Route';
    }
    
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
    if (!gpxData) {
        alert('Please load a GPX file first.');
        return;
    }
    
    // Prompt for name
    const name = prompt('Save as:', currentRouteName || 'My Race Strategy');
    if (name === null) return; // Cancelled
    
    const entry = saveToHistory(name.trim() || currentRouteName || 'My Race Strategy');
    
    // Also save to legacy single-plan storage for backward compatibility
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
    alert('Plan saved to history! Click the History button to view all saved plans.');
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

// History Panel functionality
function setupHistory() {
    const historyBtn = document.getElementById('historyBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyOverlay = document.getElementById('historyOverlay');
    const historyClose = document.getElementById('historyClose');
    const historyExportBtn = document.getElementById('historyExportBtn');
    const historyImportBtn = document.getElementById('historyImportBtn');
    const historyImportInput = document.getElementById('historyImportInput');
    
    if (!historyBtn || !historyPanel) return;
    
    // Open panel
    historyBtn.addEventListener('click', () => {
        historyPanel.classList.add('active');
        historyOverlay.classList.add('active');
        renderHistory();
    });
    
    // Close panel
    const closePanel = () => {
        historyPanel.classList.remove('active');
        historyOverlay.classList.remove('active');
    };
    
    historyClose?.addEventListener('click', closePanel);
    historyOverlay?.addEventListener('click', closePanel);
    
    // Export all history
    historyExportBtn?.addEventListener('click', exportHistory);
    
    // Import history
    historyImportBtn?.addEventListener('click', () => historyImportInput?.click());
    historyImportInput?.addEventListener('change', importHistory);
}

// Feedback Panel functionality
function setupFeedback() {
    const feedbackBtn = document.getElementById('feedbackBtn');
    const feedbackPanel = document.getElementById('feedbackPanel');
    const feedbackOverlay = document.getElementById('feedbackOverlay');
    const feedbackClose = document.getElementById('feedbackClose');
    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackSuccess = document.getElementById('feedbackSuccess');
    
    if (!feedbackBtn || !feedbackPanel) return;
    
    // Open panel
    feedbackBtn.addEventListener('click', () => {
        feedbackPanel.classList.add('active');
        feedbackOverlay.classList.add('active');
        // Reset form when opening
        feedbackForm.style.display = 'flex';
        feedbackSuccess.style.display = 'none';
        feedbackForm.reset();
    });
    
    // Close panel
    const closePanel = () => {
        feedbackPanel.classList.remove('active');
        feedbackOverlay.classList.remove('active');
    };
    
    feedbackClose?.addEventListener('click', closePanel);
    feedbackOverlay?.addEventListener('click', closePanel);
    
    // Handle form submission
    feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(feedbackForm);
        const data = {
            like: formData.get('like'),
            missing: formData.get('missing'),
            bugs: formData.get('bugs'),
            email: formData.get('email'),
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
        
        // Submit to Formspree
        const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqegeeap';
        
        try {
            const response = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                feedbackForm.style.display = 'none';
                feedbackSuccess.style.display = 'flex';
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            // Fallback to mailto on error
            const subject = encodeURIComponent('GPXray Beta Feedback');
            const body = encodeURIComponent(
                `What I like:\n${data.like || 'N/A'}\n\n` +
                `Missing features:\n${data.missing || 'N/A'}\n\n` +
                `Bugs/Issues:\n${data.bugs || 'N/A'}\n\n` +
                `Email: ${data.email || 'N/A'}`
            );
            window.open(`mailto:gpxrayrun@gmail.com?subject=${subject}&body=${body}`, '_blank');
            feedbackForm.style.display = 'none';
            feedbackSuccess.style.display = 'flex';
        }
    });
}

function getHistory() {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error reading history:', e);
        return [];
    }
}

function saveToHistory(name) {
    if (!gpxData) {
        alert('Please load a GPX file first.');
        return;
    }
    
    const history = getHistory();
    
    const entry = {
        id: Date.now(),
        name: name || currentRouteName || 'Unnamed Route',
        date: new Date().toISOString(),
        distance: gpxData.totalDistance,
        elevation: gpxData.elevationGain,
        plan: {
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
            downhillRatio: document.getElementById('downhillRatio')?.value || '0.9',
            itraScore: document.getElementById('itraScore')?.value || '550',
            itraUphillRatio: document.getElementById('itraUphillRatio')?.value || '1.3',
            itraDownhillRatio: document.getElementById('itraDownhillRatio')?.value || '0.85'
        }
    };
    
    // Add to beginning of history
    history.unshift(entry);
    
    // Limit to 50 entries
    if (history.length > 50) {
        history.splice(50);
    }
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return entry;
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    const history = getHistory();
    
    if (!historyList) return;
    
    if (history.length === 0) {
        historyEmpty.style.display = 'block';
        historyList.innerHTML = '';
        return;
    }
    
    historyEmpty.style.display = 'none';
    
    historyList.innerHTML = history.map(entry => {
        const date = new Date(entry.date);
        const dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
        
        return `
            <div class="history-item" data-id="${entry.id}">
                <div class="history-item-header">
                    <span class="history-item-name">${escapeHtml(entry.name)}</span>
                    <span class="history-item-date">${dateStr}</span>
                </div>
                <div class="history-item-stats">
                    <span>📏 ${entry.distance.toFixed(1)} km</span>
                    <span>⛰️ ${Math.round(entry.elevation)} m</span>
                </div>
                <div class="history-item-actions">
                    <button type="button" class="history-item-btn history-load-btn" onclick="loadFromHistory(${entry.id})">Load Plan</button>
                    <button type="button" class="history-item-btn history-delete-btn" onclick="deleteFromHistory(${entry.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadFromHistory(id) {
    const history = getHistory();
    const entry = history.find(e => e.id === id);
    
    if (!entry || !entry.plan) {
        alert('Could not load this plan.');
        return;
    }
    
    const plan = entry.plan;
    
    // Restore AID stations
    aidStations = plan.aidStations || [];
    renderAidStations();
    
    // Restore mode
    currentMode = plan.mode || 'target';
    const manualBtn = document.getElementById('manualModeBtn');
    const targetBtn = document.getElementById('targetModeBtn');
    const itraBtn = document.getElementById('itraModeBtn');
    const manualMode = document.getElementById('manualMode');
    const targetMode = document.getElementById('targetMode');
    const itraMode = document.getElementById('itraMode');
    
    // Reset all modes
    [manualBtn, targetBtn, itraBtn].forEach(btn => btn?.classList.remove('active'));
    [manualMode, targetMode, itraMode].forEach(mode => { if (mode) mode.style.display = 'none'; });
    
    // Activate current mode
    if (currentMode === 'manual') {
        manualBtn?.classList.add('active');
        if (manualMode) manualMode.style.display = 'block';
    } else if (currentMode === 'itra') {
        itraBtn?.classList.add('active');
        if (itraMode) itraMode.style.display = 'block';
    } else {
        targetBtn?.classList.add('active');
        if (targetMode) targetMode.style.display = 'block';
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
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
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
    setVal('itraScore', plan.itraScore);
    setVal('itraUphillRatio', plan.itraUphillRatio);
    setVal('itraDownhillRatio', plan.itraDownhillRatio);
    
    // Close panel
    document.getElementById('historyPanel')?.classList.remove('active');
    document.getElementById('historyOverlay')?.classList.remove('active');
    
    alert(`Loaded plan: ${entry.name}\n\nNote: You'll need to load the same GPX file to recalculate your race strategy.`);
}

function deleteFromHistory(id) {
    if (!confirm('Delete this saved analysis?')) return;
    
    let history = getHistory();
    history = history.filter(e => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function exportHistory() {
    const history = getHistory();
    if (history.length === 0) {
        alert('No history to export.');
        return;
    }
    
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpxray-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importHistory(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (!Array.isArray(imported)) {
                throw new Error('Invalid format');
            }
            
            const history = getHistory();
            const existingIds = new Set(history.map(h => h.id));
            
            // Add non-duplicate entries
            let added = 0;
            for (const entry of imported) {
                if (entry.id && !existingIds.has(entry.id)) {
                    history.push(entry);
                    existingIds.add(entry.id);
                    added++;
                }
            }
            
            // Sort by date (newest first)
            history.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Limit to 50
            if (history.length > 50) {
                history.splice(50);
            }
            
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            renderHistory();
            alert(`Imported ${added} new entries.`);
        } catch (err) {
            alert('Error importing history: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for re-import
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
        alert('Please calculate your race strategy first.');
        return;
    }
    
    // Prepare print content
    const distanceUnit = useMetric ? 'km' : 'mi';
    const distance = useMetric ? gpxData.totalDistance : gpxData.totalDistance * KM_TO_MILES;
    
    document.getElementById('printTitle').textContent = 'Race Strategy';
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
    const itraBtn = document.getElementById('itraModeBtn');
    const manualMode = document.getElementById('manualMode');
    const targetMode = document.getElementById('targetMode');
    const itraMode = document.getElementById('itraMode');
    
    if (!manualBtn || !targetBtn || !manualMode || !targetMode) {
        console.error('Mode selector elements not found');
        return;
    }
    
    manualBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = 'manual';
        manualBtn.classList.add('active');
        targetBtn.classList.remove('active');
        if (itraBtn) itraBtn.classList.remove('active');
        manualMode.style.display = 'block';
        targetMode.style.display = 'none';
        if (itraMode) itraMode.style.display = 'none';
    });
    
    targetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = 'target';
        targetBtn.classList.add('active');
        manualBtn.classList.remove('active');
        if (itraBtn) itraBtn.classList.remove('active');
        targetMode.style.display = 'block';
        manualMode.style.display = 'none';
        if (itraMode) itraMode.style.display = 'none';
    });
    
    if (itraBtn && itraMode) {
        itraBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentMode = 'itra';
            itraBtn.classList.add('active');
            manualBtn.classList.remove('active');
            targetBtn.classList.remove('active');
            itraMode.style.display = 'block';
            manualMode.style.display = 'none';
            targetMode.style.display = 'none';
            updateItraEffortDisplay();
        });
    }
    
    // Setup ITRA mode specific handlers
    setupItraMode();
}

// ITRA Mode setup and functions
function setupItraMode() {
    // Tab switching
    const directTab = document.getElementById('itraDirectTab');
    const calcTab = document.getElementById('itraCalcTab');
    const directInput = document.getElementById('itraDirectInput');
    const calcInput = document.getElementById('itraCalcInput');
    
    if (directTab && calcTab) {
        directTab.addEventListener('click', () => {
            directTab.classList.add('active');
            calcTab.classList.remove('active');
            directInput.style.display = 'block';
            calcInput.style.display = 'none';
        });
        
        calcTab.addEventListener('click', () => {
            calcTab.classList.add('active');
            directTab.classList.remove('active');
            calcInput.style.display = 'block';
            directInput.style.display = 'none';
        });
    }
    
    // ITRA score input - update level indicator
    const itraScoreInput = document.getElementById('itraScore');
    if (itraScoreInput) {
        itraScoreInput.addEventListener('input', () => {
            updateItraLevel(parseInt(itraScoreInput.value));
            updateItraEstimate();
        });
    }
    
    // Calculate ITRA from past race
    const calcItraBtn = document.getElementById('calcItraBtn');
    if (calcItraBtn) {
        calcItraBtn.addEventListener('click', calculateItraFromRace);
    }
    
    // Use calculated ITRA button
    const useCalcItra = document.getElementById('useCalcItra');
    if (useCalcItra) {
        useCalcItra.addEventListener('click', () => {
            const calcValue = document.getElementById('calcItraValue').textContent;
            if (calcValue && calcValue !== '-') {
                document.getElementById('itraScore').value = parseInt(calcValue);
                updateItraLevel(parseInt(calcValue));
                updateItraEstimate();
                // Switch to direct input tab
                document.getElementById('itraDirectTab').click();
            }
        });
    }
    
    // Update estimate when ratios change
    const uphillRatio = document.getElementById('itraUphillRatio');
    const downhillRatio = document.getElementById('itraDownhillRatio');
    if (uphillRatio) uphillRatio.addEventListener('input', updateItraEstimate);
    if (downhillRatio) downhillRatio.addEventListener('input', updateItraEstimate);
}

// Update ITRA effort display when GPX is loaded
function updateItraEffortDisplay() {
    if (!gpxData) return;
    
    const distanceEl = document.getElementById('itraDistance');
    const elevationEl = document.getElementById('itraElevation');
    const effortEl = document.getElementById('itraEffortPoints');
    
    if (!distanceEl || !elevationEl || !effortEl) return;
    
    const distance = gpxData.totalDistance;
    const elevation = gpxData.elevationGain;
    const effortPoints = calculateEffortPoints(distance, elevation);
    
    distanceEl.textContent = `${distance.toFixed(2)} km`;
    elevationEl.textContent = `${elevation.toFixed(0)} m`;
    effortEl.textContent = effortPoints.toFixed(0);
    
    // Update estimate
    updateItraEstimate();
}

// Calculate ITRA effort points: distance + (elevation / 100)
function calculateEffortPoints(distanceKm, elevationM) {
    return distanceKm + (elevationM / 100);
}

// Update ITRA level indicator text
function updateItraLevel(score) {
    const levelText = document.getElementById('itraLevelText');
    if (!levelText) return;
    
    let level, color;
    if (score >= 800) {
        level = 'Elite';
        color = '#ffd700';
    } else if (score >= 700) {
        level = 'Competitive';
        color = '#00d4ff';
    } else if (score >= 600) {
        level = 'Advanced';
        color = '#4CAF50';
    } else if (score >= 500) {
        level = 'Intermediate';
        color = '#ffa500';
    } else {
        level = 'Beginner';
        color = '#9E9E9E';
    }
    
    levelText.textContent = level;
    levelText.style.color = color;
}

// Calculate ITRA score from past race
function calculateItraFromRace() {
    const distance = parseFloat(document.getElementById('pastRaceDistance').value);
    const elevation = parseFloat(document.getElementById('pastRaceElevation').value);
    const hours = parseInt(document.getElementById('pastRaceHours').value) || 0;
    const minutes = parseInt(document.getElementById('pastRaceMinutes').value) || 0;
    
    if (isNaN(distance) || distance <= 0 || isNaN(elevation) || elevation < 0) {
        alert('Please enter valid distance and elevation values.');
        return;
    }
    
    if (hours === 0 && minutes === 0) {
        alert('Please enter your finish time.');
        return;
    }
    
    const timeInHours = hours + (minutes / 60);
    const effortPoints = calculateEffortPoints(distance, elevation);
    
    // ITRA formula approximation:
    // Reference: ~550 index corresponds to ~5.5 min/effort point
    // Higher score = faster (less time per effort point)
    const minutesPerPoint = (timeInHours * 60) / effortPoints;
    
    // Inverse relationship: faster runners have higher scores
    // Calibration: 550 score ≈ 5.5 min/point, 700 score ≈ 4.3 min/point, 800 score ≈ 3.7 min/point
    // Score ≈ 3000 / minutesPerPoint (rough approximation)
    let estimatedScore = Math.round(3000 / minutesPerPoint);
    
    // Clamp to realistic range
    estimatedScore = Math.max(350, Math.min(950, estimatedScore));
    
    // Display result
    document.getElementById('calcItraValue').textContent = estimatedScore;
    document.getElementById('calculatedItra').style.display = 'flex';
}

// Update ITRA estimated time
function updateItraEstimate() {
    if (!gpxData) return;
    
    const itraScore = parseInt(document.getElementById('itraScore')?.value) || 550;
    const distance = gpxData.totalDistance;
    const elevation = gpxData.elevationGain;
    const effortPoints = calculateEffortPoints(distance, elevation);
    
    // Calculate time based on ITRA score
    // Higher score = less minutes per effort point
    const minutesPerPoint = 3000 / itraScore;
    const totalMinutes = effortPoints * minutesPerPoint;
    
    // Add stop times from AID stations
    const totalStopTime = aidStations.reduce((sum, s) => sum + (s.stopMin || 0), 0);
    const finalTime = totalMinutes + totalStopTime;
    
    // Display
    const resultDiv = document.getElementById('itraResult');
    const timeEl = document.getElementById('itraEstimatedTime');
    const paceEl = document.getElementById('itraAvgPace');
    
    if (resultDiv && timeEl && paceEl) {
        resultDiv.style.display = 'block';
        timeEl.textContent = formatTime(finalTime);
        
        const avgPace = totalMinutes / distance;
        paceEl.textContent = `${formatPace(avgPace)} /km`;
    }
}

// Calculate paces from ITRA score
function calculatePacesFromItra() {
    if (!gpxData) return null;
    
    const itraScore = parseInt(document.getElementById('itraScore')?.value) || 550;
    const uphillRatio = parseFloat(document.getElementById('itraUphillRatio')?.value) || 1.3;
    const downhillRatio = parseFloat(document.getElementById('itraDownhillRatio')?.value) || 0.85;
    
    const distance = gpxData.totalDistance;
    const elevation = gpxData.elevationGain;
    const effortPoints = calculateEffortPoints(distance, elevation);
    
    const minutesPerPoint = 3000 / itraScore;
    const totalRunningMinutes = effortPoints * minutesPerPoint;
    
    // Calculate terrain breakdown
    let flatDist = 0, uphillDist = 0, downhillDist = 0;
    for (const segment of segments) {
        switch (segment.terrainType) {
            case 'flat': flatDist += segment.distance; break;
            case 'uphill': uphillDist += segment.distance; break;
            case 'downhill': downhillDist += segment.distance; break;
        }
    }
    
    // Calculate base flat pace that achieves target time with ratios
    // totalTime = flatDist * flatPace + uphillDist * flatPace * uphillRatio + downhillDist * flatPace * downhillRatio
    const weightedDistance = flatDist + (uphillDist * uphillRatio) + (downhillDist * downhillRatio);
    const flatPace = totalRunningMinutes / weightedDistance;
    
    return {
        flatPace: flatPace,
        uphillPace: flatPace * uphillRatio,
        downhillPace: flatPace * downhillRatio
    };
}

// AID Stations setup
function setupAidStations() {
    const addBtn = document.getElementById('addAidStation');
    const kmInput = document.getElementById('aidStationKm');
    const nameInput = document.getElementById('aidStationName');
    const stopTimeInput = document.getElementById('aidStationStopTime');
    
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
        const stopMin = parseInt(stopTimeInput.value) || 2; // Default 2 min stop
        
        if (isNaN(km) || km < 0) {
            alert('Please enter a valid kilometer position.');
            return;
        }
        
        // Add to array with stop time
        aidStations.push({ km, name, stopMin });
        
        // Sort by km
        aidStations.sort((a, b) => a.km - b.km);
        
        // Render list
        renderAidStations();
        
        // Clear inputs (keep default stop time)
        kmInput.value = '';
        nameInput.value = '';
        stopTimeInput.value = '2';
    });
}

function renderAidStations() {
    const list = document.getElementById('aidStationsList');
    if (!list) return;
    
    // Sort AID stations by km for proper leg calculation
    const sortedStations = [...aidStations].sort((a, b) => a.km - b.km);
    
    // Build legs between stations (including start and finish)
    const legs = [];
    if (gpxData && sortedStations.length > 0) {
        // Start → First AID
        const firstStation = sortedStations[0];
        legs.push({
            from: 'Start',
            to: firstStation.name,
            fromKm: 0,
            toKm: firstStation.km
        });
        
        // Between AID stations
        for (let i = 0; i < sortedStations.length - 1; i++) {
            legs.push({
                from: sortedStations[i].name,
                to: sortedStations[i + 1].name,
                fromKm: sortedStations[i].km,
                toKm: sortedStations[i + 1].km
            });
        }
        
        // Last AID → Finish
        const lastStation = sortedStations[sortedStations.length - 1];
        legs.push({
            from: lastStation.name,
            to: 'Finish',
            fromKm: lastStation.km,
            toKm: gpxData.totalDistance
        });
    }
    
    // Render stations with leg info
    list.innerHTML = aidStations.map((station, index) => {
        // Find the leg ending at this station
        const legIndex = sortedStations.findIndex(s => s.km === station.km);
        let legInfo = '';
        
        if (gpxData && legIndex >= 0 && legIndex < legs.length) {
            const leg = legs[legIndex];
            const distance = leg.toKm - leg.fromKm;
            const elevFrom = getElevationAtDistance(leg.fromKm);
            const elevTo = getElevationAtDistance(leg.toKm);
            const elevGain = calculateElevationGainBetween(leg.fromKm, leg.toKm);
            const elevLoss = calculateElevationLossBetween(leg.fromKm, leg.toKm);
            
            legInfo = `
                <div class="aid-station-leg">
                    <span class="leg-distance">↔ ${distance.toFixed(1)} km from ${leg.from}</span>
                    <span class="leg-elevation">⬆️ ${elevGain.toFixed(0)}m ⬇️ ${elevLoss.toFixed(0)}m</span>
                </div>
            `;
        }
        
        return `
            <div class="aid-station-item" id="aid-station-${index}">
                <div class="aid-station-info">
                    <span class="aid-station-km">KM ${station.km}</span>
                    <span class="aid-station-name">${station.name}</span>
                    <span class="aid-station-stop">(${station.stopMin || 0} min stop)</span>
                </div>
                ${legInfo}
                <div class="aid-station-actions">
                    <button type="button" class="edit-aid-btn" onclick="editAidStation(${index})" title="Edit">✏️</button>
                    <button type="button" class="remove-aid-btn" onclick="removeAidStation(${index})" title="Remove">×</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Render final leg summary (last AID → Finish)
    if (gpxData && legs.length > 0) {
        const finalLeg = legs[legs.length - 1];
        const distance = finalLeg.toKm - finalLeg.fromKm;
        const elevGain = calculateElevationGainBetween(finalLeg.fromKm, finalLeg.toKm);
        const elevLoss = calculateElevationLossBetween(finalLeg.fromKm, finalLeg.toKm);
        
        list.innerHTML += `
            <div class="aid-station-item final-leg">
                <div class="aid-station-info">
                    <span class="aid-station-km">🏁 Finish</span>
                    <span class="aid-station-name">${gpxData.totalDistance.toFixed(1)} km</span>
                </div>
                <div class="aid-station-leg">
                    <span class="leg-distance">↔ ${distance.toFixed(1)} km from ${finalLeg.from}</span>
                    <span class="leg-elevation">⬆️ ${elevGain.toFixed(0)}m ⬇️ ${elevLoss.toFixed(0)}m</span>
                </div>
            </div>
        `;
    }
}

// Get elevation at a specific distance along the route
function getElevationAtDistance(distanceKm) {
    if (!gpxData || gpxData.points.length === 0) return 0;
    
    // Find the two points surrounding this distance
    for (let i = 0; i < gpxData.points.length - 1; i++) {
        const p1 = gpxData.points[i];
        const p2 = gpxData.points[i + 1];
        
        if (p1.distance <= distanceKm && p2.distance >= distanceKm) {
            // Interpolate elevation
            const ratio = (distanceKm - p1.distance) / (p2.distance - p1.distance);
            return (p1.elevation || 0) + ratio * ((p2.elevation || 0) - (p1.elevation || 0));
        }
    }
    
    // Return last point elevation if beyond route
    return gpxData.points[gpxData.points.length - 1].elevation || 0;
}

// Calculate elevation gain between two distances
function calculateElevationGainBetween(fromKm, toKm) {
    if (!gpxData) return 0;
    
    let gain = 0;
    let prevElev = null;
    
    for (const point of gpxData.points) {
        if (point.distance >= fromKm && point.distance <= toKm) {
            if (prevElev !== null && point.elevation > prevElev) {
                gain += point.elevation - prevElev;
            }
            prevElev = point.elevation;
        } else if (point.distance > toKm) {
            break;
        }
    }
    
    return gain;
}

// Calculate elevation loss between two distances
function calculateElevationLossBetween(fromKm, toKm) {
    if (!gpxData) return 0;
    
    let loss = 0;
    let prevElev = null;
    
    for (const point of gpxData.points) {
        if (point.distance >= fromKm && point.distance <= toKm) {
            if (prevElev !== null && point.elevation < prevElev) {
                loss += prevElev - point.elevation;
            }
            prevElev = point.elevation;
        } else if (point.distance > toKm) {
            break;
        }
    }
    
    return loss;
}

function removeAidStation(index) {
    aidStations.splice(index, 1);
    renderAidStations();
}

function editAidStation(index) {
    const station = aidStations[index];
    if (!station) return;
    
    const item = document.getElementById(`aid-station-${index}`);
    if (!item) return;
    
    // Replace content with edit form
    item.innerHTML = `
        <div class="aid-station-edit-form">
            <div class="edit-row">
                <label>KM:</label>
                <input type="number" id="edit-km-${index}" value="${station.km}" step="0.1" min="0">
            </div>
            <div class="edit-row">
                <label>Name:</label>
                <input type="text" id="edit-name-${index}" value="${station.name}">
            </div>
            <div class="edit-row">
                <label>Stop (min):</label>
                <input type="number" id="edit-stop-${index}" value="${station.stopMin || 0}" min="0">
            </div>
            <div class="edit-actions">
                <button type="button" class="save-edit-btn" onclick="saveAidStation(${index})">Save</button>
                <button type="button" class="cancel-edit-btn" onclick="renderAidStations()">Cancel</button>
            </div>
        </div>
    `;
    
    // Focus on name input
    document.getElementById(`edit-name-${index}`).focus();
}

function saveAidStation(index) {
    const km = parseFloat(document.getElementById(`edit-km-${index}`).value);
    const name = document.getElementById(`edit-name-${index}`).value.trim();
    const stopMin = parseInt(document.getElementById(`edit-stop-${index}`).value) || 0;
    
    if (isNaN(km) || km < 0) {
        alert('Please enter a valid kilometer value.');
        return;
    }
    
    if (!name) {
        alert('Please enter a station name.');
        return;
    }
    
    aidStations[index] = { km, name, stopMin };
    renderAidStations();
}

// Make removeAidStation available globally
window.removeAidStation = removeAidStation;
window.editAidStation = editAidStation;
window.saveAidStation = saveAidStation;
window.renderAidStations = renderAidStations;

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

// Calculate sunrise/sunset times using solar position algorithm
function calculateSunTimes(lat, lon, date) {
    // Convert degrees to radians
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;
    
    // Get day of year
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Solar declination angle
    const declination = toRad(-23.45 * Math.cos(toRad(360 / 365 * (dayOfYear + 10))));
    
    // Hour angle at sunrise/sunset (when sun is at -0.833 degrees for atmospheric refraction)
    const latRad = toRad(lat);
    const zenith = toRad(90.833); // 90° + 50' for refraction
    
    const cosHourAngle = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination)) / 
                         (Math.cos(latRad) * Math.cos(declination));
    
    // Check for polar day/night
    if (cosHourAngle > 1) {
        // Sun never rises (polar night)
        return { sunrise: null, sunset: null, polarNight: true };
    }
    if (cosHourAngle < -1) {
        // Sun never sets (midnight sun)
        return { sunrise: null, sunset: null, midnightSun: true };
    }
    
    const hourAngle = toDeg(Math.acos(cosHourAngle));
    
    // Equation of time (approximation)
    const B = toRad(360 / 365 * (dayOfYear - 81));
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    
    // Time offset for longitude (4 minutes per degree)
    // Using standard time zones (15° per hour)
    const timezone = Math.round(lon / 15);
    const timeOffset = 4 * (lon - timezone * 15) + eot;
    
    // Solar noon in local time
    const solarNoon = 12 * 60 - timeOffset; // in minutes
    
    // Sunrise and sunset times in minutes from midnight (local time)
    const sunriseMinutes = solarNoon - hourAngle * 4;
    const sunsetMinutes = solarNoon + hourAngle * 4;
    
    return {
        sunrise: Math.max(0, Math.min(24 * 60, sunriseMinutes)),
        sunset: Math.max(0, Math.min(24 * 60, sunsetMinutes)),
        polarNight: false,
        midnightSun: false
    };
}

// Format minutes to HH:MM string
function formatSunTime(minutes) {
    if (minutes === null) return '--:--';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Update sun times display based on route center and selected date
function updateSunTimesDisplay() {
    const dateInput = document.getElementById('raceStartDate');
    const sunTimesContainer = document.getElementById('sunTimes');
    
    if (!dateInput || !sunTimesContainer || !gpxData) return;
    
    const dateValue = dateInput.value;
    if (!dateValue) {
        sunTimesContainer.style.display = 'none';
        sunTimes = null;
        return;
    }
    
    // Get center point of the route for sun calculations
    const points = gpxData.points;
    const midIndex = Math.floor(points.length / 2);
    const lat = points[midIndex].lat;
    const lon = points[midIndex].lon;
    
    // Parse the date (YYYY-MM-DD format)
    const [year, month, day] = dateValue.split('-').map(Number);
    const raceDate = new Date(year, month - 1, day);
    
    // Calculate sun times
    sunTimes = calculateSunTimes(lat, lon, raceDate);
    
    // Update display
    const sunriseSpan = document.getElementById('sunriseTime');
    const sunsetSpan = document.getElementById('sunsetTime');
    
    if (sunTimes.polarNight) {
        sunriseSpan.textContent = 'Polar night';
        sunsetSpan.textContent = '';
    } else if (sunTimes.midnightSun) {
        sunriseSpan.textContent = 'Midnight sun';
        sunsetSpan.textContent = '';
    } else {
        sunriseSpan.textContent = formatSunTime(sunTimes.sunrise);
        sunsetSpan.textContent = formatSunTime(sunTimes.sunset);
    }
    
    sunTimesContainer.style.display = 'flex';
    
    // Regenerate splits table to update night sections
    if (segments.length > 0) {
        generateSplitsTable();
    }
}

// Check if a given clock time (in minutes from midnight) is during night
function isNightTime(clockMinutes) {
    if (!sunTimes || sunTimes.polarNight) return true;
    if (sunTimes.midnightSun) return false;
    
    // Night is before sunrise or after sunset
    return clockMinutes < sunTimes.sunrise || clockMinutes > sunTimes.sunset;
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
    } else if (currentMode === 'target') {
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
    } else if (currentMode === 'itra') {
        // Calculate paces from ITRA score
        const paces = calculatePacesFromItra();
        if (!paces) return;
        flatPace = paces.flatPace;
        uphillPace = paces.uphillPace;
        downhillPace = paces.downhillPace;
        
        // Hide target mode calculated paces if visible
        const calcPacesDiv = document.getElementById('calculatedPaces');
        if (calcPacesDiv) calcPacesDiv.style.display = 'none';
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
    
    // Calculate total stop time from AID stations
    const totalStopTime = aidStations.reduce((sum, station) => sum + (station.stopMin || 0), 0);
    
    const totalTime = flatTime + uphillTime + downhillTime + totalStopTime;
    
    // Display results
    document.getElementById('paceResults').style.display = 'block';
    document.getElementById('flatDistance').textContent = `${flatDistance.toFixed(2)} km`;
    document.getElementById('uphillDistance').textContent = `${uphillDistance.toFixed(2)} km`;
    document.getElementById('downhillDistance').textContent = `${downhillDistance.toFixed(2)} km`;
    
    document.getElementById('flatTime').textContent = formatTime(flatTime);
    document.getElementById('uphillTime').textContent = formatTime(uphillTime);
    document.getElementById('downhillTime').textContent = formatTime(downhillTime);
    
    // Display total time (including stop time if any)
    if (totalStopTime > 0) {
        document.getElementById('totalTime').textContent = `${formatTime(totalTime)} (incl. ${totalStopTime} min stops)`;
    } else {
        document.getElementById('totalTime').textContent = formatTime(totalTime);
    }
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
    
    // Check if surface multipliers are enabled (defined here for use throughout)
    const surfaceToggle = document.getElementById('surfaceEnabled');
    const applySurface = surfaceToggle ? surfaceToggle.checked : false;
    
    let cumulativeTime = 0;
    
    // Track which AID stations have had their stop time added (to prevent double-counting)
    const processedStopTimes = new Set();
    
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
                
                // Track dominant surface for this unit (always track for display)
                if (segment.surfaceType && segment.surfaceType !== 'unknown') {
                    if (overlapDistance > maxSurfaceDist) {
                        maxSurfaceDist = overlapDistance;
                        dominantSurface = segment.surfaceType;
                    }
                }
                
                // Get surface multiplier (only applied if toggle is on)
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
            const stopTime = station.stopMin || 0;
            const clockTimeMinutes = startTimeInMinutes + timeToStation;
            const clockTime = formatClockTime(clockTimeMinutes);
            const displayDistance = useMetric ? station.km : station.km * KM_TO_MILES;

            const aidRow = document.createElement('tr');
            aidRow.classList.add('aid-station-row');
            if (isNightTime(clockTimeMinutes % (24 * 60))) {
                aidRow.classList.add('night-section');
            }
            aidRow.innerHTML = `
                <td>${displayDistance.toFixed(1)}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td class="aid-station-cell">${station.name}</td>
                <td class="stop-time">${stopTime > 0 ? '+' + stopTime + ' min' : '-'}</td>
                <td>-</td>
                <td>-</td>
                <td>${formatTime(timeToStation)}</td>
                <td>${clockTime}</td>
            `;
            splitsBody.appendChild(aidRow);
            
            // Add stop time to cumulative time (proportional to position in unit)
            // The full stop time will be added after the fraction passes
        }
        
        // Update cumulative time (including any fractional AID stop times)
        for (const station of aidStationsInUnit) {
            if (!processedStopTimes.has(station.km)) {
                cumulativeTime += station.stopMin || 0;
                processedStopTimes.add(station.km);
            }
        }
        cumulativeTime += unitTime;
        
        // Get target pace for dominant terrain (display pace for selected unit)
        let targetPace;
        switch (terrain) {
            case 'uphill': targetPace = displayUphillPace; break;
            case 'downhill': targetPace = displayDownhillPace; break;
            default: targetPace = displayFlatPace;
        }
        
        // Check for AID station at this unit (exact or rounded) - for display purposes
        const aidStation = aidStations.find(s => {
            const stationInUnit = useMetric ? s.km : s.km * KM_TO_MILES;
            return Math.floor(stationInUnit) === unit || Math.round(stationInUnit) === unit;
        });
        const aidStationText = aidStation ? aidStation.name : '-';
        const hasAidStation = aidStation !== undefined;
        
        // Add stop time only if not already processed (prevents double-counting)
        if (hasAidStation && !processedStopTimes.has(aidStation.km)) {
            cumulativeTime += aidStation.stopMin || 0;
            processedStopTimes.add(aidStation.km);
        }
        const stopTime = hasAidStation ? (aidStation.stopMin || 0) : 0;
        
        // Calculate clock time (after adding stop time)
        const clockTimeMinutes = startTimeInMinutes + cumulativeTime;
        const clockTime = formatClockTime(clockTimeMinutes);
        
        // Split time is the time for this unit (not including stop)
        const splitTime = unitTime;
        
        const row = document.createElement('tr');
        if (hasAidStation) {
            row.classList.add('aid-station-row');
        }
        if (isNightTime(clockTimeMinutes % (24 * 60))) {
            row.classList.add('night-section');
        }
        
        // Get surface display name
        const surfaceDisplay = SURFACE_TYPES[dominantSurface] ? SURFACE_TYPES[dominantSurface].name : 'Unknown';
        
        row.innerHTML = `
            <td>${unit}</td>
            <td>${elevationChange >= 0 ? '+' : ''}${elevationChange.toFixed(0)} m</td>
            <td class="terrain-${terrain}">${terrain.charAt(0).toUpperCase() + terrain.slice(1)}</td>
            <td class="surface-${dominantSurface}">${surfaceDisplay}</td>
            <td class="${hasAidStation ? 'aid-station-cell' : ''}">${aidStationText}</td>
            <td class="stop-time">${stopTime > 0 ? '+' + stopTime + ' min' : '-'}</td>
            <td>${formatPace(targetPace)} /${unitLabel}</td>
            <td>${formatTime(splitTime)}</td>
            <td>${formatTime(cumulativeTime)}</td>
            <td>${clockTime}</td>
        `;
        splitsBody.appendChild(row);
    }
    
    // Generate leg summary if AID stations exist
    renderLegSummary(flatPace, uphillPace, downhillPace, applySurface, startTimeInMinutes);
    
    // Show splits section
    document.getElementById('splitsSection').style.display = 'block';
}

// Render leg summary table
function renderLegSummary(flatPace, uphillPace, downhillPace, applySurface, startTimeInMinutes) {
    const legSummary = document.getElementById('legSummary');
    const legSummaryBody = document.getElementById('legSummaryBody');
    
    if (!legSummary || !legSummaryBody) return;
    
    // Need at least one AID station for leg summary
    if (aidStations.length === 0) {
        legSummary.style.display = 'none';
        return;
    }
    
    // Sort AID stations by km
    const sortedStations = [...aidStations].sort((a, b) => a.km - b.km);
    
    // Build legs
    const legs = [];
    
    // Start → First AID
    legs.push({
        name: `Start → ${sortedStations[0].name}`,
        fromKm: 0,
        toKm: sortedStations[0].km,
        stopMin: 0
    });
    
    // Between AID stations
    for (let i = 0; i < sortedStations.length - 1; i++) {
        legs.push({
            name: `${sortedStations[i].name} → ${sortedStations[i + 1].name}`,
            fromKm: sortedStations[i].km,
            toKm: sortedStations[i + 1].km,
            stopMin: sortedStations[i].stopMin || 0
        });
    }
    
    // Last AID → Finish
    const lastStation = sortedStations[sortedStations.length - 1];
    legs.push({
        name: `${lastStation.name} → Finish`,
        fromKm: lastStation.km,
        toKm: gpxData.totalDistance,
        stopMin: lastStation.stopMin || 0,
        isFinish: true
    });
    
    // Calculate times for each leg
    let cumulativeTime = 0;
    
    legSummaryBody.innerHTML = legs.map(leg => {
        const distance = leg.toKm - leg.fromKm;
        const elevGain = calculateElevationGainBetween(leg.fromKm, leg.toKm);
        const elevLoss = calculateElevationLossBetween(leg.fromKm, leg.toKm);
        
        // Calculate leg time based on segments
        let legTime = 0;
        for (const segment of segments) {
            if (segment.endDistance >= leg.fromKm && segment.startDistance < leg.toKm) {
                const overlapStart = Math.max(segment.startDistance, leg.fromKm);
                const overlapEnd = Math.min(segment.endDistance, leg.toKm);
                const overlapDistance = overlapEnd - overlapStart;
                
                const surfaceMultiplier = applySurface && SURFACE_TYPES[segment.surfaceType]
                    ? SURFACE_TYPES[segment.surfaceType].multiplier[segment.terrainType]
                    : 1.0;
                
                let basePace;
                switch (segment.terrainType) {
                    case 'uphill': basePace = uphillPace; break;
                    case 'downhill': basePace = downhillPace; break;
                    default: basePace = flatPace;
                }
                
                legTime += overlapDistance * basePace * surfaceMultiplier;
            }
        }
        
        // Add previous stop time to cumulative
        cumulativeTime += leg.stopMin;
        cumulativeTime += legTime;
        
        const arrivalTime = formatClockTime(startTimeInMinutes + cumulativeTime);
        
        return `
            <tr class="${leg.isFinish ? 'leg-finish' : ''}">
                <td class="leg-name">${leg.name}</td>
                <td>${distance.toFixed(1)} km</td>
                <td>⬆️${elevGain.toFixed(0)}m ⬇️${elevLoss.toFixed(0)}m</td>
                <td>${formatTime(legTime)}</td>
                <td>${arrivalTime}</td>
            </tr>
        `;
    }).join('');
    
    legSummary.style.display = 'block';
}

// CSV Export functionality
function setupExport() {
    document.getElementById('exportCsv').addEventListener('click', exportToCsv);
    document.getElementById('exportPdf').addEventListener('click', exportToPdf);
    document.getElementById('exportShareCard').addEventListener('click', exportShareCard);
    document.getElementById('exportCrewCard')?.addEventListener('click', exportCrewCard);
}

function exportToCsv() {
    if (!gpxData || segments.length === 0) {
        alert('Please load a GPX file and calculate your race strategy first.');
        return;
    }

    const splitsTable = document.getElementById('splitsTable');
    if (!splitsTable || splitsTable.rows.length <= 1) {
        alert('Please calculate your race strategy first to generate splits.');
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
    
    // Get race date
    const dateInput = document.getElementById('raceStartDate');
    const raceDateValue = dateInput ? dateInput.value : '';
    
    // Unit settings
    const unitLabel = useMetric ? 'km' : 'mi';
    const distanceDisplay = useMetric ? gpxData.totalDistance.toFixed(2) : (gpxData.totalDistance * KM_TO_MILES).toFixed(2);

    // Add summary section
    csvContent += 'GPX RACE STRATEGY EXPORT\n';
    csvContent += `Mode,${currentMode === 'manual' ? 'Manual Pace' : 'Target Time'}\n`;
    csvContent += `Race Date,${raceDateValue || 'Not set'}\n`;
    csvContent += `Race Start Time,${startTimeValue}\n`;
    if (sunTimes && !sunTimes.polarNight && !sunTimes.midnightSun) {
        csvContent += `Sunrise,${formatSunTime(sunTimes.sunrise)}\n`;
        csvContent += `Sunset,${formatSunTime(sunTimes.sunset)}\n`;
    } else if (sunTimes && sunTimes.polarNight) {
        csvContent += `Sun,Polar night (no sunrise)\n`;
    } else if (sunTimes && sunTimes.midnightSun) {
        csvContent += `Sun,Midnight sun (no sunset)\n`;
    }
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
        csvContent += `${unitLabel.toUpperCase()},Name,Stop Time (min)\n`;
        aidStations.forEach(station => {
            const stationDist = useMetric ? station.km : station.km * KM_TO_MILES;
            csvContent += `${stationDist.toFixed(1)},${station.name},${station.stopMin || 0}\n`;
        });
        
        // Add total stop time
        const totalStopTime = aidStations.reduce((sum, s) => sum + (s.stopMin || 0), 0);
        csvContent += `Total Stop Time,,${totalStopTime}\n`;
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

// PDF Race Card Export
async function exportToPdf() {
    if (!gpxData || segments.length === 0) {
        alert('Please load a GPX file and calculate your race strategy first.');
        return;
    }

    const splitsTable = document.getElementById('splitsTable');
    if (!splitsTable || splitsTable.rows.length <= 1) {
        alert('Please calculate your race strategy first to generate splits.');
        return;
    }

    const btn = document.getElementById('exportPdf');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Generating...';
    btn.disabled = true;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // Colors
        const primaryColor = [0, 212, 255];
        const darkBg = [30, 30, 50];
        const textColor = [255, 255, 255];
        const mutedColor = [150, 150, 150];

        // Background
        doc.setFillColor(...darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Header
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 20, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        let routeName = currentRouteName || 'Race Strategy';
        
        // Truncate long titles to fit header (max ~50 chars)
        const maxTitleLength = 50;
        if (routeName.length > maxTitleLength) {
            routeName = routeName.substring(0, maxTitleLength - 3) + '...';
        }
        doc.text(routeName, margin, 13);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const dateInput = document.getElementById('raceStartDate');
        const timeInput = document.getElementById('raceStartTime');
        const raceDate = dateInput?.value || '';
        const raceTime = timeInput?.value || '06:00';
        if (raceDate) {
            doc.text(`${raceDate} at ${raceTime}`, pageWidth - margin, 13, { align: 'right' });
        }

        y = 30;

        // Stats row
        doc.setTextColor(...textColor);
        doc.setFontSize(9);
        
        const unitLabel = useMetric ? 'km' : 'mi';
        const distance = useMetric ? gpxData.totalDistance : gpxData.totalDistance * KM_TO_MILES;
        let totalTimeText = document.getElementById('totalTime')?.textContent || '-';
        // Clean up time - remove "(incl. X min stops)" for cleaner display
        const timeMatch = totalTimeText.match(/^[\d:]+/);
        const estTime = timeMatch ? timeMatch[0] : totalTimeText;
        const stopsMatch = totalTimeText.match(/(\d+)\s*min\s*stop/);
        const stopsTime = stopsMatch ? `${stopsMatch[1]} min` : null;
        
        const stats = [
            { label: 'Distance', value: `${distance.toFixed(1)} ${unitLabel}` },
            { label: 'Elevation', value: `+${gpxData.elevationGain.toFixed(0)}m / -${gpxData.elevationLoss.toFixed(0)}m` },
            { label: 'Est. Time', value: estTime }
        ];
        
        // Add stops as separate stat if present
        if (stopsTime) {
            stats.push({ label: 'Stops', value: stopsTime });
        }
        
        // Add sun times if available
        if (sunTimes && !sunTimes.polarNight && !sunTimes.midnightSun) {
            stats.push({ label: 'Sunrise', value: formatSunTime(sunTimes.sunrise) });
            stats.push({ label: 'Sunset', value: formatSunTime(sunTimes.sunset) });
        }

        const statWidth = (pageWidth - 2 * margin) / stats.length;
        stats.forEach((stat, i) => {
            const x = margin + i * statWidth;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...mutedColor);
            doc.text(stat.label, x, y);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...textColor);
            doc.text(stat.value, x, y + 5);
        });

        y += 15;

        // Elevation chart capture
        const chartCanvas = document.getElementById('elevationChart');
        if (chartCanvas && chartCanvas.style.display !== 'none') {
            try {
                const chartImage = chartCanvas.toDataURL('image/png', 1.0);
                const chartWidth = pageWidth - 2 * margin;
                const chartHeight = 35;
                doc.addImage(chartImage, 'PNG', margin, y, chartWidth, chartHeight);
                y += chartHeight + 8;
            } catch (e) {
                console.warn('Could not capture chart:', e);
            }
        }

        // AID Stations / Leg Summary
        if (aidStations.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...primaryColor);
            doc.text('AID Stations', margin, y);
            y += 6;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...textColor);

            aidStations.forEach(station => {
                const stationDist = useMetric ? station.km : station.km * KM_TO_MILES;
                const stopText = station.stopMin > 0 ? ` (+${station.stopMin}min)` : '';
                doc.text(`• ${stationDist.toFixed(1)} ${unitLabel}: ${station.name}${stopText}`, margin + 2, y);
                y += 4;
            });
            y += 4;
        }

        // Splits table
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...primaryColor);
        doc.text('Splits', margin, y);
        y += 6;

        // Table header
        const cols = [
            { header: unitLabel.toUpperCase(), width: 12 },
            { header: 'Elev', width: 18 },
            { header: 'Terrain', width: 18 },
            { header: 'AID', width: 35 },
            { header: 'Pace', width: 22 },
            { header: 'Split', width: 18 },
            { header: 'Total', width: 18 },
            { header: 'Clock', width: 18 }
        ];

        doc.setFillColor(40, 40, 60);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...mutedColor);
        
        let colX = margin + 1;
        cols.forEach(col => {
            doc.text(col.header, colX, y);
            colX += col.width;
        });
        y += 5;

        // Table rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        
        const rows = splitsTable.querySelectorAll('tbody tr');
        rows.forEach((row, rowIndex) => {
            // Check if we need a new page
            if (y > pageHeight - 20) {
                doc.addPage();
                doc.setFillColor(...darkBg);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                y = margin;
            }

            const cells = row.querySelectorAll('td');
            const isAid = row.classList.contains('aid-station-row');
            const isNight = row.classList.contains('night-section');
            
            // Row background
            if (isAid) {
                doc.setFillColor(0, 100, 80);
                doc.rect(margin, y - 3, pageWidth - 2 * margin, 5, 'F');
            } else if (isNight) {
                doc.setFillColor(50, 30, 70);
                doc.rect(margin, y - 3, pageWidth - 2 * margin, 5, 'F');
            } else if (rowIndex % 2 === 0) {
                doc.setFillColor(35, 35, 55);
                doc.rect(margin, y - 3, pageWidth - 2 * margin, 5, 'F');
            }

            doc.setTextColor(...textColor);
            colX = margin + 1;
            
            // Columns: 0=km, 1=elev, 2=terrain, 4=aid, 6=pace, 7=split, 8=total, 9=clock
            const indices = [0, 1, 2, 4, 6, 7, 8, 9];
            indices.forEach((cellIndex, i) => {
                let text = cells[cellIndex]?.textContent?.trim() || '-';
                // Truncate long text
                if (text.length > 15) text = text.substring(0, 14) + '…';
                doc.text(text, colX, y);
                colX += cols[i].width;
            });
            y += 5;
        });

        // Footer
        y = pageHeight - 10;
        doc.setFontSize(7);
        doc.setTextColor(...mutedColor);
        doc.text('Generated by GPXray - gpxray.run', margin, y);
        doc.text(new Date().toLocaleDateString(), pageWidth - margin, y, { align: 'right' });

        // Save
        const fileName = (currentRouteName || 'race_plan').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${fileName}_race_card.pdf`);

    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Share Card Export (Phone format image)
async function exportShareCard() {
    if (!gpxData || segments.length === 0) {
        alert('Please load a GPX file and calculate your race strategy first.');
        return;
    }

    const btn = document.getElementById('exportShareCard');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Creating...';
    btn.disabled = true;

    try {
        // Create a hidden container for the share card
        const card = document.createElement('div');
        card.id = 'shareCardContainer';
        card.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: 540px;
            height: 960px;
            background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            padding: 30px;
            box-sizing: border-box;
        `;

        // Build card content
        const unitLabel = useMetric ? 'km' : 'mi';
        const distance = useMetric ? gpxData.totalDistance : gpxData.totalDistance * KM_TO_MILES;
        const totalTime = document.getElementById('totalTime')?.textContent || '-';
        const dateInput = document.getElementById('raceStartDate');
        const timeInput = document.getElementById('raceStartTime');
        const raceDate = dateInput?.value || '';
        const raceTime = timeInput?.value || '06:00';

        // Get finish clock time from the last row of splits table
        let finishClockTime = '';
        const splitsTable = document.getElementById('splitsTable');
        if (splitsTable) {
            const allRows = splitsTable.querySelectorAll('tbody tr');
            if (allRows.length > 0) {
                const lastRow = allRows[allRows.length - 1];
                const cells = lastRow.querySelectorAll('td');
                finishClockTime = cells[9]?.textContent || '';
            }
        }

        // Get AID station times from the splits table (only exact AID station rows)
        let aidStationsList = '';
        if (splitsTable && aidStations.length > 0) {
            // Sort AID stations by km and get their data
            const sortedStations = [...aidStations].sort((a, b) => a.km - b.km);
            
            // Collect matching rows with their data
            const stationData = [];
            const rows = splitsTable.querySelectorAll('tbody tr.aid-station-row');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const distCell = cells[0]?.textContent?.trim() || '';
                const aidName = cells[4]?.textContent || '';
                const raceTime = cells[8]?.textContent || '';
                const clockTime = cells[9]?.textContent || '';
                
                if (aidName && aidName !== '-') {
                    // Parse distance and find matching AID station (tolerance-based matching)
                    const rowDist = parseFloat(distCell);
                    const rowKm = useMetric ? rowDist : rowDist * MILES_TO_KM;
                    const matchingStation = sortedStations.find(s => Math.abs(s.km - rowKm) < 0.5);
                    
                    if (matchingStation) {
                        stationData.push({ dist: distCell, name: aidName, raceTime, clockTime });
                    }
                }
            });
            
            // Dynamic sizing based on station count
            const stationCount = stationData.length;
            let rowPadding, kmSize, nameSize, timeSize, clockSize, legInfoSize, showLegInfo;
            
            if (stationCount <= 4) {
                // Large mode
                rowPadding = '14px 0';
                kmSize = '20px';
                nameSize = '18px';
                timeSize = '16px';
                clockSize = '20px';
                legInfoSize = '14px';
                showLegInfo = true;
            } else if (stationCount <= 7) {
                // Medium mode
                rowPadding = '10px 0';
                kmSize = '17px';
                nameSize = '15px';
                timeSize = '14px';
                clockSize = '17px';
                legInfoSize = '12px';
                showLegInfo = true;
            } else {
                // Compact mode (8+ stations)
                rowPadding = '8px 0';
                kmSize = '15px';
                nameSize = '13px';
                timeSize = '12px';
                clockSize = '15px';
                legInfoSize = '11px';
                showLegInfo = false; // Hide leg info to save space
            }
            
            // Calculate leg info and build HTML
            let prevKm = 0;
            let prevElevation = gpxData.points[0]?.elevation || 0;
            
            stationData.forEach((station, index) => {
                const stationKm = parseFloat(station.dist);
                const legDist = (stationKm - prevKm).toFixed(1);
                
                // Find elevation at this station
                let stationElevation = prevElevation;
                let elevGain = 0;
                let elevLoss = 0;
                
                // Calculate elevation change for this leg
                for (const point of gpxData.points) {
                    if (point.distance >= prevKm && point.distance <= stationKm) {
                        if (point.elevation !== null) {
                            stationElevation = point.elevation;
                        }
                    }
                }
                
                // Sum up elevation changes in this leg
                let lastElev = null;
                for (const point of gpxData.points) {
                    if (point.distance >= prevKm && point.distance <= stationKm) {
                        if (point.elevation !== null) {
                            if (lastElev !== null) {
                                const diff = point.elevation - lastElev;
                                if (diff > 0) elevGain += diff;
                                else elevLoss += Math.abs(diff);
                            }
                            lastElev = point.elevation;
                        }
                    }
                }
                
                // Add station row
                aidStationsList += `
                    <div style="display: flex; align-items: center; padding: ${rowPadding}; border-bottom: 1px solid rgba(255,255,255,0.15);">
                        <span style="color: #00d4ff; min-width: 55px; font-size: ${kmSize}; font-weight: bold;">📍 ${station.dist}</span>
                        <span style="flex: 1; margin: 0 6px; font-size: ${nameSize}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${station.name}</span>
                        <span style="color: #ddd; font-size: ${timeSize}; font-weight: 600; margin-right: 10px;">${station.raceTime}</span>
                        <span style="font-weight: bold; color: #4CAF50; min-width: 75px; text-align: right; font-size: ${clockSize};">${station.clockTime}</span>
                    </div>
                `;
                
                // Add leg info row (if not last station and showLegInfo is true)
                if (index < stationData.length - 1) {
                    const nextKm = parseFloat(stationData[index + 1].dist);
                    const nextLegDist = (nextKm - stationKm).toFixed(1);
                    
                    // Calculate next leg elevation
                    let nextElevGain = 0;
                    let nextElevLoss = 0;
                    let nextLastElev = null;
                    for (const point of gpxData.points) {
                        if (point.distance >= stationKm && point.distance <= nextKm) {
                            if (point.elevation !== null) {
                                if (nextLastElev !== null) {
                                    const diff = point.elevation - nextLastElev;
                                    if (diff > 0) nextElevGain += diff;
                                    else nextElevLoss += Math.abs(diff);
                                }
                                nextLastElev = point.elevation;
                            }
                        }
                    }
                    
                    if (showLegInfo) {
                        aidStationsList += `
                            <div style="text-align: center; padding: 6px 0; color: #999; font-size: ${legInfoSize}; font-weight: 500;">
                                ↓ ${nextLegDist} ${unitLabel} · +${Math.round(nextElevGain)}m / -${Math.round(nextElevLoss)}m
                            </div>
                        `;
                    }
                }
                
                prevKm = stationKm;
                prevElevation = stationElevation;
            });
            
            // Add leg info to finish (if there are stations and showLegInfo)
            if (stationData.length > 0 && showLegInfo) {
                const lastStationKm = parseFloat(stationData[stationData.length - 1].dist);
                const finishKm = distance;
                const legToFinish = (finishKm - lastStationKm).toFixed(1);
                
                // Calculate elevation to finish
                let finishElevGain = 0;
                let finishElevLoss = 0;
                let lastElev = null;
                for (const point of gpxData.points) {
                    if (point.distance >= lastStationKm) {
                        if (point.elevation !== null) {
                            if (lastElev !== null) {
                                const diff = point.elevation - lastElev;
                                if (diff > 0) finishElevGain += diff;
                                else finishElevLoss += Math.abs(diff);
                            }
                            lastElev = point.elevation;
                        }
                    }
                }
                
                aidStationsList += `
                    <div style="text-align: center; padding: 6px 0; color: #999; font-size: ${legInfoSize}; font-weight: 500;">
                        ↓ ${legToFinish} ${unitLabel} · +${Math.round(finishElevGain)}m / -${Math.round(finishElevLoss)}m
                    </div>
                `;
            }
            
            // Add FINISH row
            aidStationsList += `
                <div style="display: flex; align-items: center; padding: ${rowPadding}; background: rgba(76,175,80,0.2); border-radius: 8px; margin-top: 4px;">
                    <span style="color: #4CAF50; min-width: 55px; font-size: ${kmSize}; font-weight: bold;">🏁 ${distance.toFixed(1)}</span>
                    <span style="flex: 1; margin: 0 6px; font-size: ${nameSize}; font-weight: 700; color: #4CAF50;">FINISH</span>
                    <span style="color: #4CAF50; font-size: ${timeSize}; font-weight: 700; margin-right: 10px;">${totalTime.split('(')[0].trim()}</span>
                    <span style="font-weight: bold; color: #4CAF50; min-width: 75px; text-align: right; font-size: ${clockSize};">${finishClockTime}</span>
                </div>
            `;
        } else {
            // No AID stations - show just FINISH row
            aidStationsList = `
                <div style="display: flex; align-items: center; padding: 14px 0; background: rgba(76,175,80,0.2); border-radius: 8px;">
                    <span style="color: #4CAF50; min-width: 55px; font-size: 20px; font-weight: bold;">🏁 ${distance.toFixed(1)}</span>
                    <span style="flex: 1; margin: 0 6px; font-size: 18px; font-weight: 700; color: #4CAF50;">FINISH</span>
                    <span style="color: #4CAF50; font-size: 16px; font-weight: 700; margin-right: 10px;">${totalTime.split('(')[0].trim()}</span>
                    <span style="font-weight: bold; color: #4CAF50; min-width: 75px; text-align: right; font-size: 20px;">${finishClockTime}</span>
                </div>
            `;
        }

        // Sun times
        let sunTimesHtml = '';
        if (sunTimes && !sunTimes.polarNight && !sunTimes.midnightSun) {
            sunTimesHtml = `
                <div style="display: flex; gap: 30px; justify-content: center; margin: 15px 0; font-size: 18px; font-weight: 600;">
                    <span>🌅 ${formatSunTime(sunTimes.sunrise)}</span>
                    <span>🌇 ${formatSunTime(sunTimes.sunset)}</span>
                </div>
            `;
        }

        let routeName = currentRouteName || 'Race Strategy';
        if (routeName.length > 35) {
            routeName = routeName.substring(0, 32) + '...';
        }

        card.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 28px; font-weight: bold; color: #00d4ff; margin-bottom: 5px;">GPXray</div>
                <div style="font-size: 14px; color: #aaa; text-transform: uppercase; letter-spacing: 2px; font-weight: 500;">Race Strategy</div>
            </div>
            
            <div style="background: rgba(0,212,255,0.15); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div style="font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 15px;">${routeName}</div>
                
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <div style="font-size: 32px; font-weight: bold;">${distance.toFixed(1)}</div>
                        <div style="font-size: 14px; color: #aaa; font-weight: 500;">${unitLabel}</div>
                    </div>
                    <div>
                        <div style="font-size: 32px; font-weight: bold;">+${gpxData.elevationGain.toFixed(0)}</div>
                        <div style="font-size: 14px; color: #aaa; font-weight: 500;">m gain</div>
                    </div>
                    <div>
                        <div style="font-size: 32px; font-weight: bold;">-${gpxData.elevationLoss.toFixed(0)}</div>
                        <div style="font-size: 14px; color: #aaa; font-weight: 500;">m loss</div>
                    </div>
                </div>
            </div>
            
            ${sunTimesHtml ? `<div style="text-align: center; margin-bottom: 20px;">${sunTimesHtml}</div>` : ''}
            
            ${aidStationsList ? `
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <div style="font-size: 16px; color: #aaa; margin-bottom: 12px; text-align: center; font-weight: 600;">⏱️ RACE SCHEDULE</div>
                    <div style="display: flex; align-items: center; padding: 6px 0; border-bottom: 2px solid rgba(255,255,255,0.2); margin-bottom: 8px;">
                        <span style="color: #888; min-width: 55px; font-size: 12px; font-weight: 600;">${unitLabel.toUpperCase()}</span>
                        <span style="flex: 1; margin: 0 6px; font-size: 12px; color: #888; font-weight: 600;">STATION</span>
                        <span style="color: #888; font-size: 12px; margin-right: 10px; font-weight: 600;">RACE</span>
                        <span style="color: #888; min-width: 75px; text-align: right; font-size: 12px; font-weight: 600;">CLOCK</span>
                    </div>
                    ${aidStationsList}
                </div>
            ` : ''}
            
            <div style="position: absolute; bottom: 20px; left: 0; right: 0; text-align: center;">
                <div style="font-size: 12px; color: #555;">© gpxray.run</div>
            </div>
        `;

        document.body.appendChild(card);

        // Use html2canvas to capture the card
        const canvas = await html2canvas(card, {
            width: 540,
            height: 960,
            scale: 2,
            backgroundColor: null,
            logging: false
        });

        // Remove temporary element
        document.body.removeChild(card);

        // Download as PNG
        const link = document.createElement('a');
        const fileName = (currentRouteName || 'race_plan').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${fileName}_share_card.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (error) {
        console.error('Share card generation error:', error);
        alert('Failed to generate share card. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Crew Card Export - Simple card for sharing AID station schedule with supporters
async function exportCrewCard() {
    if (!gpxData || segments.length === 0) {
        alert('Please load a GPX file and calculate your race strategy first.');
        return;
    }

    if (aidStations.length === 0) {
        alert('Please add AID stations first. Your crew needs to know where to meet you!');
        return;
    }

    const btn = document.getElementById('exportCrewCard');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Creating...';
    btn.disabled = true;

    try {
        // Get race info
        const unitLabel = useMetric ? 'km' : 'mi';
        const distance = useMetric ? gpxData.totalDistance : gpxData.totalDistance * KM_TO_MILES;
        const totalTime = document.getElementById('totalTime')?.textContent || '-';
        const dateInput = document.getElementById('raceStartDate');
        const timeInput = document.getElementById('raceStartTime');
        const raceDate = dateInput?.value || '';
        const raceTime = timeInput?.value || '06:00';

        // Format date nicely
        let formattedDate = '';
        if (raceDate) {
            const d = new Date(raceDate);
            formattedDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }

        // Get finish clock time
        let finishClockTime = '';
        const splitsTable = document.getElementById('splitsTable');
        if (splitsTable) {
            const allRows = splitsTable.querySelectorAll('tbody tr');
            if (allRows.length > 0) {
                const lastRow = allRows[allRows.length - 1];
                const cells = lastRow.querySelectorAll('td');
                finishClockTime = cells[9]?.textContent || '';
            }
        }

        // Get AID station data from splits table
        const sortedStations = [...aidStations].sort((a, b) => a.km - b.km);
        const stationData = [];
        
        if (splitsTable) {
            const rows = splitsTable.querySelectorAll('tbody tr.aid-station-row');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const distCell = cells[0]?.textContent?.trim() || '';
                const aidName = cells[4]?.textContent || '';
                const clockTime = cells[9]?.textContent || '';
                
                if (aidName && aidName !== '-') {
                    // Parse distance and find matching AID station (tolerance-based matching)
                    const rowDist = parseFloat(distCell);
                    const rowKm = useMetric ? rowDist : rowDist * MILES_TO_KM;
                    const station = sortedStations.find(s => Math.abs(s.km - rowKm) < 0.5);
                    
                    if (station) {
                        const stopMin = station.stopMin || 0;
                        stationData.push({ 
                            dist: distCell, 
                            name: aidName, 
                            clockTime,
                            stopMin
                        });
                    }
                }
            });
        }

        // Dynamic sizing based on station count
        const stationCount = stationData.length;
        let rowPadding, iconSize, nameSize, detailSize, timeSize, etaSize, rowGap, headerPadding;
        
        if (stationCount <= 4) {
            // Normal mode
            rowPadding = '15px 20px';
            iconSize = '28px';
            nameSize = '17px';
            detailSize = '13px';
            timeSize = '26px';
            etaSize = '11px';
            rowGap = '10px';
            headerPadding = '25px';
        } else if (stationCount <= 7) {
            // Medium compact
            rowPadding = '12px 16px';
            iconSize = '24px';
            nameSize = '15px';
            detailSize = '12px';
            timeSize = '22px';
            etaSize = '10px';
            rowGap = '8px';
            headerPadding = '20px';
        } else {
            // Compact mode (8+ stations)
            rowPadding = '10px 14px';
            iconSize = '20px';
            nameSize = '14px';
            detailSize = '11px';
            timeSize = '20px';
            etaSize = '9px';
            rowGap = '6px';
            headerPadding = '15px';
        }

        // Calculate card height based on number of stations and sizing mode
        // Use 9:16 aspect ratio (social media friendly) with width of 540px
        const cardWidth = 540;
        const rowHeightEstimate = stationCount <= 4 ? 70 : (stationCount <= 7 ? 58 : 50);
        const headerHeight = stationCount <= 4 ? 140 : (stationCount <= 7 ? 120 : 100);
        const footerHeight = 80;
        const contentHeight = headerHeight + (stationData.length + 1) * rowHeightEstimate + footerHeight + 60;
        // 9:16 ratio height = 540 * 16/9 = 960
        const cardHeight = Math.max(contentHeight, Math.min(960, contentHeight));

        // Create card container
        const card = document.createElement('div');
        card.id = 'crewCardContainer';
        card.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: ${cardWidth}px;
            height: ${cardHeight}px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            padding: 30px;
            box-sizing: border-box;
        `;

        // Handle title - allow 2 lines, adjust font size for long names
        let routeName = currentRouteName || 'Race';
        let titleSize = '24px';
        let titleLineHeight = '1.2';
        
        if (routeName.length > 40) {
            titleSize = '20px';
        } else if (routeName.length > 30) {
            titleSize = '22px';
        }

        // Build station rows HTML
        let stationsHtml = stationData.map((station, index) => {
            // Truncate long station names
            let stationName = station.name;
            const maxNameLen = stationCount <= 4 ? 25 : (stationCount <= 7 ? 22 : 20);
            if (stationName.length > maxNameLen) {
                stationName = stationName.substring(0, maxNameLen - 2) + '...';
            }
            
            return `
                <div style="display: flex; align-items: center; padding: ${rowPadding}; background: rgba(255,255,255,0.1); border-radius: 10px; margin-bottom: ${rowGap};">
                    <div style="font-size: ${iconSize}; margin-right: 12px;">📍</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: ${nameSize}; font-weight: 700; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${stationName}</div>
                        <div style="font-size: ${detailSize}; opacity: 0.8;">${station.dist} ${unitLabel}${station.stopMin > 0 ? ' · ' + station.stopMin + ' min stop' : ''}</div>
                    </div>
                    <div style="text-align: right; margin-left: 10px;">
                        <div style="font-size: ${timeSize}; font-weight: 800;">${station.clockTime}</div>
                        <div style="font-size: ${etaSize}; opacity: 0.7;">ETA</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add finish row
        stationsHtml += `
            <div style="display: flex; align-items: center; padding: ${rowPadding}; background: rgba(76,175,80,0.4); border-radius: 10px; border: 2px solid rgba(76,175,80,0.8);">
                <div style="font-size: ${iconSize}; margin-right: 12px;">🏁</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: ${nameSize}; font-weight: 700; margin-bottom: 2px;">FINISH</div>
                    <div style="font-size: ${detailSize}; opacity: 0.8;">${distance.toFixed(1)} ${unitLabel} · ${totalTime.split('(')[0].trim()}</div>
                </div>
                <div style="text-align: right; margin-left: 10px;">
                    <div style="font-size: ${timeSize}; font-weight: 800;">${finishClockTime}</div>
                    <div style="font-size: ${etaSize}; opacity: 0.7;">ETA</div>
                </div>
            </div>
        `;

        card.innerHTML = `
            <div style="text-align: center; margin-bottom: ${headerPadding};">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.8; margin-bottom: 8px;">👥 CREW SCHEDULE</div>
                <div style="font-size: ${titleSize}; font-weight: 800; margin-bottom: 8px; line-height: ${titleLineHeight}; padding: 0 10px;">${routeName}</div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${formattedDate ? `📅 ${formattedDate} · ` : ''}🏃 Start: ${raceTime}
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                ${stationsHtml}
            </div>
            
            <div style="text-align: center; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
                <div style="font-size: 16px; font-weight: 700; color: #00d4ff;">GPXray</div>
                <div style="font-size: 10px; opacity: 0.6; margin-top: 2px;">© gpxray.run</div>
            </div>
        `;

        document.body.appendChild(card);

        // Capture with html2canvas
        const canvas = await html2canvas(card, {
            width: cardWidth,
            height: cardHeight,
            scale: 2,
            backgroundColor: null,
            logging: false
        });

        document.body.removeChild(card);

        // Check if Web Share API is available and can share files (mobile)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const fileName = (currentRouteName || 'race').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const file = new File([blob], `${fileName}_crew_card.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            // Mobile - use native share
            try {
                await navigator.share({
                    title: `Crew Schedule - ${routeName}`,
                    text: `Here's my race schedule for ${routeName}! Meet me at these AID stations 🏃`,
                    files: [file]
                });
            } catch (shareError) {
                if (shareError.name !== 'AbortError') {
                    // User cancelled, that's fine. Otherwise fall back to download
                    downloadCrewCard(canvas, fileName);
                }
            }
        } else {
            // Desktop - download
            downloadCrewCard(canvas, fileName);
        }

    } catch (error) {
        console.error('Crew card generation error:', error);
        alert('Failed to generate crew card. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function downloadCrewCard(canvas, fileName) {
    const link = document.createElement('a');
    link.download = `${fileName}_crew_card.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}
