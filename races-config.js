// Race Landing Page Configurations
// B2B feature: Dedicated race pages with pre-configured distances

const RACE_CONFIGS = {
    'zut': {
        id: 'zut',
        name: 'Zugspitz Ultratrail',
        shortName: 'ZUT',
        year: 2026,
        date: '2026-06-19',
        location: 'Garmisch-Partenkirchen, Germany',
        website: 'https://www.zugspitz-ultratrail.com',
        logo: null, // Optional: 'races/zut-logo.png'
        tagline: 'Run where the mountains touch the sky',
        
        // Branding colors
        branding: {
            primary: '#1a365d',    // Dark blue
            accent: '#38a169',     // Green
            background: '#0a1628'  // Dark background
        },
        
        // Available distances (sorted by distance)
        distances: [
            {
                id: 'grainau',
                name: 'Grainau Trail',
                distance: 16,
                elevation: 800,
                gpxUrl: 'races/Grainau_Trail_ZUT_2025_01bfa09fb6.gpx',
                aidStations: [
                    { km: 8.0, name: 'VP Hammersbach', stopMin: 2 }
                ],
                cutoffs: [],
                description: 'Perfect introduction to trail running'
            },
            {
                id: 'garmisch',
                name: 'Garmisch-Partenkirchen Trail',
                distance: 26,
                elevation: 1200,
                gpxUrl: 'races/ZUT_Garmisch_Partenkirchen_Trail.gpx',
                aidStations: [
                    { km: 5.2, name: 'VP1 Hammersbach', stopMin: 3 },
                    { km: 12.8, name: 'VP2 Kreuzeck', stopMin: 5 },
                    { km: 18.5, name: 'VP3 Hausberg', stopMin: 3 }
                ],
                cutoffs: [],
                description: 'Classic trail through Garmisch-Partenkirchen'
            },
            {
                id: 'mittenwald',
                name: 'Mittenwald Trail',
                distance: 43,
                elevation: 2100,
                gpxUrl: 'races/Mittenwald_Trail_ZUT_2025_fa6c0d4010.gpx',
                aidStations: [
                    { km: 12.0, name: 'VP1 Kranzberg', stopMin: 3 },
                    { km: 28.0, name: 'VP2 Lautersee', stopMin: 5 }
                ],
                cutoffs: [],
                description: 'Challenging marathon distance with stunning views'
            },
            {
                id: 'leutasch',
                name: 'Leutasch Trail',
                distance: 68,
                elevation: 3500,
                gpxUrl: 'races/Leutasch_Trail_ZUT_2025_620e36ae36.gpx',
                aidStations: [
                    { km: 18.0, name: 'VP1 Mittenwald', stopMin: 5 },
                    { km: 35.0, name: 'VP2 Leutasch', stopMin: 8 },
                    { km: 52.0, name: 'VP3 Gaistal', stopMin: 5 }
                ],
                cutoffs: [],
                description: 'Cross the Austrian border and back'
            },
            {
                id: 'ehrwald',
                name: 'Ehrwald Trail',
                distance: 85,
                elevation: 4500,
                gpxUrl: 'races/Ehrwald_Trail_ZUT_2025_85a841b963.gpx',
                aidStations: [
                    { km: 20.0, name: 'VP1 Mittenwald', stopMin: 5 },
                    { km: 40.0, name: 'VP2 Leutasch', stopMin: 8 },
                    { km: 58.0, name: 'VP3 Ehrwald', stopMin: 10 },
                    { km: 72.0, name: 'VP4 Gaistal', stopMin: 5 }
                ],
                cutoffs: [],
                description: 'Around the Zugspitze massif'
            },
            {
                id: 'ultratrail',
                name: 'Ultratrail',
                distance: 106,
                elevation: 5400,
                gpxUrl: 'races/Ultratrail_ZUT_2025_3b6cbaa510.gpx',
                aidStations: [
                    { km: 22.0, name: 'VP1 Mittenwald', stopMin: 5 },
                    { km: 42.0, name: 'VP2 Leutasch', stopMin: 10 },
                    { km: 62.0, name: 'VP3 Ehrwald', stopMin: 10 },
                    { km: 80.0, name: 'VP4 Gaistal', stopMin: 8 },
                    { km: 95.0, name: 'VP5 Partnachklamm', stopMin: 5 }
                ],
                cutoffs: [],
                description: 'The classic ultratrail experience'
            },
            {
                id: 'zut100',
                name: 'ZUT 100',
                distance: 164,
                elevation: 8500,
                gpxUrl: 'races/ZUT_100_2025_71c0e173fd.gpx',
                aidStations: [
                    { km: 25.0, name: 'VP1 Mittenwald', stopMin: 8 },
                    { km: 50.0, name: 'VP2 Leutasch', stopMin: 12 },
                    { km: 75.0, name: 'VP3 Ehrwald', stopMin: 15 },
                    { km: 100.0, name: 'VP4 Biberwier', stopMin: 12 },
                    { km: 125.0, name: 'VP5 Gaistal', stopMin: 10 },
                    { km: 145.0, name: 'VP6 Partnachklamm', stopMin: 8 }
                ],
                cutoffs: [],
                description: 'The ultimate 100-mile challenge'
            }
        ]
    },
    
    'ret': {
        id: 'ret',
        name: 'Rureifel Trail',
        shortName: 'RET',
        year: 2026,
        date: '2026-04-18',
        location: 'Nideggen, Germany',
        website: 'https://www.rureifel-trail.com',
        logo: null,
        tagline: 'Go Nature, Go Rureifel Trail',
        
        // Branding colors
        branding: {
            primary: '#2d5a27',    // Forest green
            accent: '#e85d04',     // Orange
            background: '#1a2e1a'  // Dark green background
        },
        
        // Available distances (sorted by distance)
        distances: [
            {
                id: 'ret11',
                name: 'RET11',
                distance: 12.5,
                elevation: 450,
                gpxUrl: 'races/rureifel-trail-2026-ret11.gpx',
                aidStations: [
                    { km: 7.3, name: 'VP1', stopMin: 2 }
                ],
                cutoffs: [],
                description: 'Perfect trail running introduction'
            },
            {
                id: 'ret22',
                name: 'RET22',
                distance: 23,
                elevation: 913,
                gpxUrl: 'races/rureifel-trail-2026-ret22.gpx',
                aidStations: [
                    { km: 8.4, name: 'VP1', stopMin: 3 },
                    { km: 15.0, name: 'VP2', stopMin: 3 }
                ],
                cutoffs: [],
                description: 'Challenging half with steep single trails'
            },
            {
                id: 'ret44',
                name: 'RET44+',
                distance: 46.1,
                elevation: 1853,
                gpxUrl: 'races/rureifel-trail-2026-ret44.gpx',
                aidStations: [
                    { km: 16.3, name: 'VP1', stopMin: 5 },
                    { km: 26.4, name: 'VP2', stopMin: 5 },
                    { km: 35.5, name: 'VP3', stopMin: 5 },
                    { km: 40.9, name: 'VP4', stopMin: 5 }
                ],
                cutoffs: [],
                description: 'Your first ultra through the Rureifel'
            },
            {
                id: 'ret77',
                name: 'RET77',
                distance: 77,
                elevation: 2899,
                gpxUrl: 'races/rureifel-trail-2026-ret77.gpx',
                aidStations: [
                    { km: 18.4, name: 'VP1', stopMin: 5 },
                    { km: 31.6, name: 'VP2', stopMin: 8 },
                    { km: 47.2, name: 'VP3', stopMin: 8 },
                    { km: 57.3, name: 'VP4', stopMin: 8 },
                    { km: 66.4, name: 'VP5', stopMin: 8 },
                    { km: 71.8, name: 'VP6', stopMin: 5 }
                ],
                cutoffs: [],
                description: 'The ultimate Rureifel adventure with Rursee views'
            }
        ]
    }
};

// Get race config by ID
function getRaceConfig(raceId) {
    return RACE_CONFIGS[raceId] || null;
}

// Get all available race IDs
function getAvailableRaces() {
    return Object.keys(RACE_CONFIGS);
}

// Check if URL indicates race mode
function detectRaceMode() {
    const params = new URLSearchParams(window.location.search);
    const raceParam = params.get('race');
    
    // Check URL path for /race/xxx pattern
    const pathMatch = window.location.pathname.match(/\/race\/([a-z0-9-]+)/i);
    
    return raceParam || (pathMatch ? pathMatch[1] : null);
}
