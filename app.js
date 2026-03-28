// Global state
let gpxData = null;
let map = null;
let routeLayers = [];
let elevationChart = null;
let segments = []; // Stores segment data with terrain type
let currentMode = 'target'; // 'manual', 'target', or 'itra'
let aidStations = []; // Stores AID station data
let currentRouteName = ''; // Name of current loaded route

// Constants
const GRADE_THRESHOLD = 2; // percentage grade to determine uphill/downhill
const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;

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
    setupDemo();
    setupFeedback();
    setupRaceBrowser();
    setupFooter();
});

// Footer links
function setupFooter() {
    document.getElementById('aboutLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('GPXray - Know your race before it starts.\n\nGPXray helps trail runners plan their race strategy by analyzing GPX files and calculating realistic split times based on terrain, elevation, and personal pace.\n\nBuilt with ❤️ for the trail running community.');
    });
    
    document.getElementById('privacyLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Privacy Policy\n\n✅ 100% Local Processing\nYour GPX files are processed entirely in your browser. No data is uploaded to any server.\n\n✅ No Tracking\nWe don\'t use cookies or analytics to track you.\n\n✅ No Account Required\nUse GPXray without creating an account or providing any personal information.');
    });
    
    document.getElementById('impressumLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Impressum\n\nGPXray\ngpxray.run\n\nContact: feedback via the app\n\nThis is a hobby project for the trail running community.');
    });
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
            const subject = encodeURIComponent('GPXray Feedback');
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
    
    // Display everything
    showSections();
    displayStats();
    displayMap();
    displayElevationChart();
    
    // Update ITRA effort display
    updateItraEffortDisplay();
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
    // Display route name
    const routeNameEl = document.getElementById('routeName');
    if (routeNameEl) {
        routeNameEl.textContent = currentRouteName || 'Unknown Route';
    }
    
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
    
    // Get average pace for AID station time calculations
    const avgPace = (flatPace + uphillPace + downhillPace) / 3;
    
    // Calculate splits per kilometer
    for (let km = 1; km <= totalKm; km++) {
        const kmStart = km - 1;
        const kmEnd = Math.min(km, gpxData.totalDistance);
        
        // Find elevation change for this km
        let startElevation = 0, endElevation = 0;
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
        
        // Check for AID stations within this km (before adding main row)
        const aidStationsInKm = aidStations.filter(station => 
            station.km > kmStart && station.km < km && station.km % 1 !== 0
        );
        
        // Add AID station rows for fractional positions
        for (const station of aidStationsInKm) {
            const fractionOfKm = station.km - kmStart;
            const timeToStation = cumulativeTime + (kmTime * fractionOfKm);
            const clockTimeMinutes = startTimeInMinutes + timeToStation;
            const clockTime = formatClockTime(clockTimeMinutes);
            
            const aidRow = document.createElement('tr');
            aidRow.classList.add('aid-station-row');
            aidRow.innerHTML = `
                <td>${station.km.toFixed(1)}</td>
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
        cumulativeTime += kmTime;
        
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
        
        // Check for AID station exactly at this km
        const aidStation = aidStations.find(s => Math.floor(s.km) === km || s.km === km);
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

// Share Card Export functionality
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

        // Build card content (always km on main branch)
        const unitLabel = 'km';
        const distance = gpxData.totalDistance;
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
                finishClockTime = cells[7]?.textContent || '';
            }
        }

        // Get AID station times from the splits table
        let aidStationsList = '';
        if (splitsTable && aidStations.length > 0) {
            const sortedStations = [...aidStations].sort((a, b) => a.km - b.km);
            
            const stationData = [];
            const rows = splitsTable.querySelectorAll('tbody tr.aid-station-row');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const distCell = cells[0]?.textContent?.trim() || '';
                const aidName = cells[3]?.textContent || '';
                const raceTime = cells[6]?.textContent || '';
                const clockTime = cells[7]?.textContent || '';
                
                if (aidName && aidName !== '-') {
                    const rowDist = parseFloat(distCell);
                    const rowKm = rowDist; // Always km on main branch
                    const matchingStation = sortedStations.find(s => Math.abs(s.km - rowKm) < 0.5);
                    
                    if (matchingStation) {
                        stationData.push({ dist: distCell, name: aidName, raceTime, clockTime });
                    }
                }
            });

            // Dynamic sizing based on station count
            const stationCount = stationData.length;
            let rowPadding, kmSize, nameSize, timeSize, clockSize;
            
            if (stationCount <= 4) {
                rowPadding = '14px 0';
                kmSize = '20px';
                nameSize = '18px';
                timeSize = '16px';
                clockSize = '20px';
            } else if (stationCount <= 7) {
                rowPadding = '10px 0';
                kmSize = '17px';
                nameSize = '15px';
                timeSize = '14px';
                clockSize = '17px';
            } else {
                rowPadding = '8px 0';
                kmSize = '15px';
                nameSize = '13px';
                timeSize = '12px';
                clockSize = '15px';
            }

            stationData.forEach((station, index) => {
                aidStationsList += `
                    <div style="display: flex; align-items: center; padding: ${rowPadding}; border-bottom: 1px solid rgba(255,255,255,0.15);">
                        <span style="color: #00d4ff; min-width: 55px; font-size: ${kmSize}; font-weight: bold;">📍 ${station.dist}</span>
                        <span style="flex: 1; margin: 0 6px; font-size: ${nameSize}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${station.name}</span>
                        <span style="color: #ddd; font-size: ${timeSize}; font-weight: 600; margin-right: 10px;">${station.raceTime}</span>
                        <span style="font-weight: bold; color: #4CAF50; min-width: 75px; text-align: right; font-size: ${clockSize};">${station.clockTime}</span>
                    </div>
                `;
            });

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
            
            ${aidStationsList ? `
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <div style="font-size: 16px; color: #aaa; margin-bottom: 12px; text-align: center; font-weight: 600;">🏃 RACE SCHEDULE</div>
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

// Crew Card Export functionality
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
        // Get race info (always km on main branch)
        const unitLabel = 'km';
        const distance = gpxData.totalDistance;
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
                finishClockTime = cells[7]?.textContent || '';
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
                const aidName = cells[3]?.textContent || '';
                const clockTime = cells[7]?.textContent || '';
                
                if (aidName && aidName !== '-') {
                    const rowDist = parseFloat(distCell);
                    const rowKm = rowDist; // Always km on main branch
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
            rowPadding = '15px 20px';
            iconSize = '28px';
            nameSize = '17px';
            detailSize = '13px';
            timeSize = '26px';
            etaSize = '11px';
            rowGap = '10px';
            headerPadding = '25px';
        } else if (stationCount <= 7) {
            rowPadding = '12px 16px';
            iconSize = '24px';
            nameSize = '15px';
            detailSize = '12px';
            timeSize = '22px';
            etaSize = '10px';
            rowGap = '8px';
            headerPadding = '20px';
        } else {
            rowPadding = '10px 14px';
            iconSize = '20px';
            nameSize = '14px';
            detailSize = '11px';
            timeSize = '20px';
            etaSize = '9px';
            rowGap = '6px';
            headerPadding = '15px';
        }

        // Calculate card height (9:16 aspect ratio)
        const cardWidth = 540;
        const targetHeight = 960;
        const rowHeightEstimate = stationCount <= 4 ? 70 : (stationCount <= 7 ? 58 : 50);
        const headerHeight = stationCount <= 4 ? 140 : (stationCount <= 7 ? 120 : 100);
        const footerHeight = 80;
        const contentHeight = headerHeight + (stationData.length + 1) * rowHeightEstimate + footerHeight + 60;
        const cardHeight = Math.max(targetHeight, contentHeight);

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
            display: flex;
            flex-direction: column;
        `;

        // Handle title
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
            
            <div style="flex: 1;">
                ${stationsHtml}
            </div>
            
            <div style="text-align: center; padding-top: 15px; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.2);">
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

        // Check if Web Share API is available (mobile)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const fileName = (currentRouteName || 'race').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const file = new File([blob], `${fileName}_crew_card.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: `Crew Schedule - ${routeName}`,
                    text: `Here's my race schedule for ${routeName}! Meet me at these AID stations 🏃\n\nCreated with https://gpxray.run`,
                    files: [file]
                });
            } catch (shareError) {
                if (shareError.name !== 'AbortError') {
                    downloadCrewCard(canvas, fileName);
                }
            }
        } else {
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

// CSV Export functionality
function setupExport() {
    document.getElementById('exportCsv').addEventListener('click', exportToCsv);
    document.getElementById('exportShareCard').addEventListener('click', exportShareCard);
    document.getElementById('exportCrewCard').addEventListener('click', exportCrewCard);
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

    // Add summary section
    csvContent += 'GPX RACE STRATEGY EXPORT\n';
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
