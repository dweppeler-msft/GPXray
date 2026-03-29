// GPXray Internationalization (i18n)
// Supported languages: English (en), German (de)

const TRANSLATIONS = {
    en: {
        // Header
        'header.tagline': 'Know your race before it starts.',
        'header.feedback': 'Feedback',
        'header.history': 'History',
        
        // Intro section
        'intro.text': 'Plan your trail race with precision. Upload a GPX file to analyze terrain, estimate pace, and create your race strategy.',
        'intro.smartPace': 'Smart Pace',
        'intro.surfaceAnalysis': 'Surface Analysis',
        'intro.aidStations': 'AID Stations',
        'intro.sunTimes': 'Sun Times',
        'intro.shareCard': 'Share Card',
        'intro.pdfExport': 'PDF Export',
        
        // Upload section
        'upload.dragDrop': 'Drag & drop a GPX file here or',
        'upload.browse': 'Browse locally',
        'upload.selectFile': 'Select GPX File',
        'upload.or': 'or',
        'upload.tryDemo': 'ZUT Garmisch-Partenkirchen Trail Strategy',
        'upload.browseRaces': 'Browse Popular Races',
        'upload.demoHint': 'Load a sample trail to explore the features',
        'upload.demoHintFull': 'Load a sample trail or browse our curated race database',
        'upload.privacy': '100% Local Processing – Your GPX data never leaves your device',
        
        // Beta gate
        'beta.title': 'GPXray',
        'beta.badge': 'BETA',
        'beta.description': 'This is a beta version with experimental features.',
        'beta.placeholder': 'Enter beta password',
        'beta.enter': 'Enter',
        'beta.error': 'Incorrect password',
        'beta.stableHint': "Don't have a password? Visit the",
        'beta.stableLink': 'stable version',
        
        // Early access modal
        'earlyAccess.title': 'Early Access',
        'earlyAccess.description': 'Unlock full race strategy for your GPX file.',
        'earlyAccess.placeholder': 'Enter access code',
        'earlyAccess.unlock': 'Unlock',
        'earlyAccess.error': 'Invalid code. Please try again.',
        
        // Hero section
        'hero.estimatedFinish': 'Estimated Finish Time',
        'hero.runnerLevel': 'Runner Level:',
        'hero.beginner': 'Beginner',
        'hero.intermediate': 'Intermediate',
        'hero.advanced': 'Advanced',
        'hero.elite': 'Elite',
        'hero.mainClimb': 'Main Climb',
        'hero.downhillLoad': 'Downhill Load',
        'hero.elevationGain': 'Elevation Gain',
        'hero.hint': 'Based on default paces',
        'hero.customize': 'Customize strategy ↓',
        
        // Downhill Load tooltip
        'ddl.title': 'Descent Load (DDL/km)',
        'ddl.description': 'Measures downhill stress (steepness + time + surface).',
        'ddl.paceEstimate': 'We use cumulative DDL to estimate <strong>downhill pace loss</strong>.',
        'ddl.fatigueRatio': 'Fatigue ratio = cumulative DDL ÷ DFT',
        'ddl.paceLoss': 'Pace loss on descents:',
        'ddl.none': 'none',
        'ddl.howItWorks': 'How it works',
        
        // DDL insights
        'ddl.noPaceLoss': 'No pace loss expected',
        'ddl.downhillPaceLoss': 'Downhill pace loss: +{min}-{max} sec/km',
        'ddl.expectSlower': 'Expect slower descents after KM{km} (+{min}-{max} sec/km)',
        'ddl.mildSlowdown': 'Mild downhill slowdown after KM{km}',
        
        // DDL Modal
        'ddl.modal.title': 'Dynamic Descent Load → Pace Loss',
        'ddl.modal.tagline': 'DDL builds up as you descend. When cumulative DDL approaches your DFT, quads fatigue → downhill pace drops.',
        'ddl.modal.freshLegs': 'Fresh legs',
        'ddl.modal.noPaceLoss': 'No pace loss',
        'ddl.modal.lateFatigue': 'Late race fatigue',
        'ddl.modal.dftExplain': 'DFT = your downhill fatigue threshold (depends on runner level). Change level above to personalize.',
        'ddl.modal.showFormula': 'Show formula',
        'ddl.modal.disclaimer': 'This is a heuristic model, not medical advice.',
        
        // Course shape
        'shape.frontLoaded': 'Front-Loaded',
        'shape.backLoaded': 'Back-Loaded',
        'shape.balanced': 'Balanced',
        'shape.frontInsight': 'Major climbs in first half',
        'shape.backInsight': 'Big climbs late — save energy',
        'shape.balancedInsight': 'Even effort distribution',
        
        // Stats section
        'stats.courseDetails': 'Course Details',
        'stats.totalDistance': 'Total Distance',
        'stats.elevGain': 'Elevation Gain',
        'stats.elevLoss': 'Elevation Loss',
        'stats.estimatedTime': 'Estimated Time',
        
        // Map section
        'map.title': 'Route Map',
        'map.flat': 'Flat',
        'map.uphill': 'Uphill',
        'map.downhill': 'Downhill',
        'map.surfaceAnalysis': 'Surface Analysis',
        'map.analyzingSurface': 'Analyzing surface data...',
        'map.applySurface': 'Apply surface multipliers to pace',
        
        // Elevation section
        'elevation.title': 'Course Load',
        'elevation.profile': 'Elevation Profile',
        'elevation.gradient': 'Gradient Profile',
        
        // Pace section
        'pace.title': 'Race Strategy',
        'pace.units': 'Units:',
        'pace.savePlan': 'Save Plan',
        'pace.loadPlan': 'Load Plan',
        'pace.targetTime': 'Target Time',
        'pace.itraIndex': 'ITRA Index',
        'pace.manualPace': 'Manual Pace',
        'pace.description': 'Set your target pace for different terrain types. Pace is in minutes per kilometer (min/km).',
        'pace.flat': 'Flat Pace',
        'pace.flatHint': 'Your pace on flat terrain',
        'pace.uphill': 'Uphill Pace',
        'pace.uphillHint': 'Grade > 5%',
        'pace.downhill': 'Downhill Pace',
        'pace.downhillHint': 'Grade < -5%',
        'pace.calculate': 'Calculate Race Plan',
        
        // Splits section
        'splits.title': 'Splits Table',
        'splits.km': 'KM',
        'splits.miles': 'Mile',
        'splits.terrain': 'Terrain',
        'splits.pace': 'Pace',
        'splits.splitTime': 'Split',
        'splits.cumulative': 'Cumulative',
        'splits.elevation': 'Elev',
        
        // AID stations
        'aid.title': 'AID Stations',
        'aid.addStation': 'Add Station',
        'aid.name': 'Station Name',
        'aid.distance': 'Distance (km)',
        'aid.stopTime': 'Stop Time',
        'aid.eta': 'ETA',
        'aid.noStations': 'No AID stations configured.',
        'aid.addHint': 'Click "Add Station" to set up checkpoints.',
        
        // Sun times
        'sun.title': 'Sun & Night',
        'sun.raceDate': 'Race Date',
        'sun.startTime': 'Start Time',
        'sun.sunrise': 'Sunrise',
        'sun.sunset': 'Sunset',
        'sun.nightSections': 'Night running sections will be highlighted in the splits table.',
        
        // Export section
        'export.title': 'Export & Share',
        'export.raceCard': 'Create Race Card',
        'export.pdf': 'Download PDF',
        'export.print': 'Print Race Card',
        
        // Footer
        'footer.about': 'About',
        'footer.privacy': 'Privacy',
        'footer.impressum': 'Impressum',
        
        // Feedback panel
        'feedback.title': 'Send Feedback',
        'feedback.like': 'What do you like about GPXray?',
        'feedback.likePlaceholder': 'The features I find most useful...',
        'feedback.missing': 'What features are missing?',
        'feedback.missingPlaceholder': 'I wish GPXray could...',
        'feedback.bugs': 'Any bugs or issues?',
        'feedback.bugsPlaceholder': 'I noticed that...',
        'feedback.email': 'Email (optional, for follow-up)',
        'feedback.send': 'Send Feedback',
        'feedback.orEmail': 'or email us directly',
        'feedback.thanks': 'Thank you!',
        'feedback.thanksSub': 'Your feedback helps us improve GPXray.',
        
        // History panel
        'history.title': 'Analysis History',
        'history.empty': 'No saved analyses yet.',
        'history.emptyHint': 'Your analyses will appear here after you save them.',
        'history.exportAll': 'Export All',
        'history.import': 'Import',
        
        // Race browser
        'races.title': 'Popular Trail Races',
        'races.search': 'Search races...',
        'races.all': 'All',
        'races.ultra': 'Ultra (100km+)',
        'races.marathon': 'Marathon Trail',
        'races.short': 'Short (<42km)',
        'races.missing': 'Missing a race?',
        'races.request': 'Request it!',
        
        // Cookie consent
        'cookies.message': 'We use cookies for analytics to improve GPXray.',
        'cookies.accept': 'Accept',
        'cookies.decline': 'Decline',
        
        // Surface types
        'surface.road': 'Road',
        'surface.trail': 'Trail',
        'surface.technical': 'Technical',
        'surface.unknown': 'Unknown',
        
        // Terrain types
        'terrain.flat': 'Flat',
        'terrain.uphill': 'Uphill',
        'terrain.downhill': 'Downhill',
        
        // Course shape insights
        'shape.frontInsightDynamic': '{pct}% climb in first half → Save legs for fast descent after KM{km}',
        'shape.backInsightDynamic': '{pct}% climb in second half → Conserve energy early, dig deep late',
        'shape.balancedInsightDynamic': 'Even climb distribution → Steady effort throughout',
        
        // Sun times special cases
        'sun.polarNight': 'Polar night',
        'sun.midnightSun': 'Midnight sun',
        
        // Print
        'print.title': 'Race Strategy',
        
        // Button states
        'btn.loading': '⏳ Loading...',
        'btn.demoLoaded': '✅ Demo Loaded!',
        'btn.generating': '⏳ Generating...',
        'btn.creating': '⏳ Creating...',
        'btn.joining': 'Joining...',
        'btn.joinWaitlist': 'Join Waitlist',
        
        // Race browser
        'races.noResults': 'No races found matching your criteria.',
        
        // Splits table
        'splits.surface': 'Surface',
        'splits.aid': 'AID',
        'splits.stop': 'Stop',
        'splits.clock': 'Clock',
        'splits.min': 'min',
        
        // Leg summary
        'leg.title': 'Leg Summary',
        'leg.leg': 'Leg',
        'leg.dist': 'Dist',
        'leg.gain': 'Gain',
        'leg.loss': 'Loss',
        'leg.time': 'Time',
        'leg.arrival': 'Arrival',
        'leg.toFinish': 'to Finish',
        
        // General
        'general.loading': 'Loading...',
        'general.error': 'Error',
        'general.success': 'Success',
        'general.close': 'Close',
        'general.save': 'Save',
        'general.cancel': 'Cancel',
        'general.delete': 'Delete'
    },
    
    de: {
        // Header
        'header.tagline': 'Kenne dein Rennen, bevor es beginnt.',
        'header.feedback': 'Feedback',
        'header.history': 'Verlauf',
        
        // Intro section
        'intro.text': 'Plane dein Trailrennen präzise. Lade eine GPX-Datei hoch, um Gelände zu analysieren, Tempo einzuschätzen und deine Rennstrategie zu erstellen.',
        'intro.smartPace': 'Smart Pace',
        'intro.surfaceAnalysis': 'Untergrund-Analyse',
        'intro.aidStations': 'Verpflegungspunkte',
        'intro.sunTimes': 'Sonnenzeiten',
        'intro.shareCard': 'Teilen',
        'intro.pdfExport': 'PDF Export',
        
        // Upload section
        'upload.dragDrop': 'GPX-Datei hierher ziehen oder',
        'upload.browse': 'Datei auswählen',
        'upload.selectFile': 'GPX-Datei wählen',
        'upload.or': 'oder',
        'upload.tryDemo': 'ZUT Garmisch-Partenkirchen Trail Strategie',
        'upload.browseRaces': 'Bekannte Rennen durchsuchen',
        'upload.demoHint': 'Lade einen Beispiel-Trail um die Funktionen zu entdecken',
        'upload.demoHintFull': 'Lade einen Beispiel-Trail oder durchsuche unsere Renndatenbank',
        'upload.privacy': '100% lokale Verarbeitung – Deine GPX-Daten verlassen nie dein Gerät',
        
        // Beta gate
        'beta.title': 'GPXray',
        'beta.badge': 'BETA',
        'beta.description': 'Dies ist eine Beta-Version mit experimentellen Funktionen.',
        'beta.placeholder': 'Beta-Passwort eingeben',
        'beta.enter': 'Weiter',
        'beta.error': 'Falsches Passwort',
        'beta.stableHint': 'Kein Passwort? Besuche die',
        'beta.stableLink': 'stabile Version',
        
        // Early access modal
        'earlyAccess.title': 'Early Access',
        'earlyAccess.description': 'Schalte die volle Rennstrategie für deine GPX-Datei frei.',
        'earlyAccess.placeholder': 'Zugangscode eingeben',
        'earlyAccess.unlock': 'Freischalten',
        'earlyAccess.error': 'Ungültiger Code. Bitte versuche es erneut.',
        
        // Hero section
        'hero.estimatedFinish': 'Geschätzte Zielzeit',
        'hero.runnerLevel': 'Läufer-Level:',
        'hero.beginner': 'Anfänger',
        'hero.intermediate': 'Fortgeschritten',
        'hero.advanced': 'Erfahren',
        'hero.elite': 'Elite',
        'hero.mainClimb': 'Hauptanstieg',
        'hero.downhillLoad': 'Abstiegsbelastung',
        'hero.elevationGain': 'Höhenmeter',
        'hero.hint': 'Basierend auf Standard-Paces',
        'hero.customize': 'Strategie anpassen ↓',
        
        // Downhill Load tooltip
        'ddl.title': 'Abstiegsbelastung (DDL/km)',
        'ddl.description': 'Misst Abstiegsstress (Steilheit + Zeit + Untergrund).',
        'ddl.paceEstimate': 'Wir nutzen kumulierte DDL um <strong>Abstiegs-Tempoverlust</strong> zu schätzen.',
        'ddl.fatigueRatio': 'Ermüdungsrate = kumulierte DDL ÷ DFT',
        'ddl.paceLoss': 'Tempoverlust bei Abstiegen:',
        'ddl.none': 'keiner',
        'ddl.howItWorks': 'So funktioniert es',
        
        // DDL insights
        'ddl.noPaceLoss': 'Kein Tempoverlust erwartet',
        'ddl.downhillPaceLoss': 'Abstiegs-Tempoverlust: +{min}-{max} sec/km',
        'ddl.expectSlower': 'Langsamere Abstiege ab KM{km} (+{min}-{max} sec/km)',
        'ddl.mildSlowdown': 'Leichte Abstiegs-Verlangsamung ab KM{km}',
        
        // DDL Modal
        'ddl.modal.title': 'Dynamic Descent Load → Tempoverlust',
        'ddl.modal.tagline': 'DDL akkumuliert sich beim Abstieg. Wenn DDL sich deinem DFT nähert, ermüden die Quads → Abstiege werden langsamer.',
        'ddl.modal.freshLegs': 'Frische Beine',
        'ddl.modal.noPaceLoss': 'Kein Tempoverlust',
        'ddl.modal.lateFatigue': 'Späte Ermüdung',
        'ddl.modal.dftExplain': 'DFT = deine Abstiegs-Ermüdungsschwelle (abhängig vom Läufer-Level). Ändere das Level oben für personalisierte Werte.',
        'ddl.modal.showFormula': 'Formel anzeigen',
        'ddl.modal.disclaimer': 'Dies ist ein heuristisches Modell, keine medizinische Beratung.',
        
        // Course shape
        'shape.frontLoaded': 'Front-Lastig',
        'shape.backLoaded': 'End-Lastig',
        'shape.balanced': 'Ausgewogen',
        'shape.frontInsight': 'Hauptanstiege in erster Hälfte',
        'shape.backInsight': 'Große Anstiege spät — Energie sparen',
        'shape.balancedInsight': 'Gleichmäßige Belastungsverteilung',
        
        // Stats section
        'stats.courseDetails': 'Streckendetails',
        'stats.totalDistance': 'Gesamtdistanz',
        'stats.elevGain': 'Höhenmeter Aufstieg',
        'stats.elevLoss': 'Höhenmeter Abstieg',
        'stats.estimatedTime': 'Geschätzte Zeit',
        
        // Map section
        'map.title': 'Streckenmap',
        'map.flat': 'Flach',
        'map.uphill': 'Bergauf',
        'map.downhill': 'Bergab',
        'map.surfaceAnalysis': 'Untergrund-Analyse',
        'map.analyzingSurface': 'Analysiere Untergrund-Daten...',
        'map.applySurface': 'Untergrund-Multiplikatoren auf Tempo anwenden',
        
        // Elevation section
        'elevation.title': 'Streckenprofil',
        'elevation.profile': 'Höhenprofil',
        'elevation.gradient': 'Steigungsprofil',
        
        // Pace section
        'pace.title': 'Rennstrategie',
        'pace.units': 'Einheiten:',
        'pace.savePlan': 'Plan speichern',
        'pace.loadPlan': 'Plan laden',
        'pace.targetTime': 'Zielzeit',
        'pace.itraIndex': 'ITRA Index',
        'pace.manualPace': 'Manuelles Tempo',
        'pace.description': 'Setze dein Zieltempo für verschiedene Geländetypen. Tempo in Minuten pro Kilometer (min/km).',
        'pace.flat': 'Flach-Tempo',
        'pace.flatHint': 'Dein Tempo auf flachem Terrain',
        'pace.uphill': 'Bergauf-Tempo',
        'pace.uphillHint': 'Steigung > 5%',
        'pace.downhill': 'Bergab-Tempo',
        'pace.downhillHint': 'Gefälle < -5%',
        'pace.calculate': 'Rennplan berechnen',
        
        // Splits section
        'splits.title': 'Splits-Tabelle',
        'splits.km': 'KM',
        'splits.miles': 'Meile',
        'splits.terrain': 'Terrain',
        'splits.pace': 'Tempo',
        'splits.splitTime': 'Split',
        'splits.cumulative': 'Gesamt',
        'splits.elevation': 'Höhe',
        
        // AID stations
        'aid.title': 'Verpflegungspunkte',
        'aid.addStation': 'Station hinzufügen',
        'aid.name': 'Stationsname',
        'aid.distance': 'Distanz (km)',
        'aid.stopTime': 'Aufenthalt',
        'aid.eta': 'Ankunft',
        'aid.noStations': 'Keine Verpflegungspunkte konfiguriert.',
        'aid.addHint': 'Klicke "Station hinzufügen" um Checkpoints einzurichten.',
        
        // Sun times
        'sun.title': 'Sonne & Nacht',
        'sun.raceDate': 'Renndatum',
        'sun.startTime': 'Startzeit',
        'sun.sunrise': 'Sonnenaufgang',
        'sun.sunset': 'Sonnenuntergang',
        'sun.nightSections': 'Nachtabschnitte werden in der Splits-Tabelle hervorgehoben.',
        
        // Export section
        'export.title': 'Export & Teilen',
        'export.raceCard': 'Race Card erstellen',
        'export.pdf': 'PDF herunterladen',
        'export.print': 'Race Card drucken',
        
        // Footer
        'footer.about': 'Über uns',
        'footer.privacy': 'Datenschutz',
        'footer.impressum': 'Impressum',
        
        // Feedback panel
        'feedback.title': 'Feedback senden',
        'feedback.like': 'Was gefällt dir an GPXray?',
        'feedback.likePlaceholder': 'Die Funktionen, die ich am nützlichsten finde...',
        'feedback.missing': 'Welche Funktionen fehlen?',
        'feedback.missingPlaceholder': 'Ich wünsche mir, GPXray könnte...',
        'feedback.bugs': 'Bugs oder Probleme?',
        'feedback.bugsPlaceholder': 'Mir ist aufgefallen, dass...',
        'feedback.email': 'E-Mail (optional, für Rückfragen)',
        'feedback.send': 'Feedback senden',
        'feedback.orEmail': 'oder direkt per E-Mail',
        'feedback.thanks': 'Danke!',
        'feedback.thanksSub': 'Dein Feedback hilft uns, GPXray zu verbessern.',
        
        // History panel
        'history.title': 'Analyse-Verlauf',
        'history.empty': 'Noch keine gespeicherten Analysen.',
        'history.emptyHint': 'Deine Analysen erscheinen hier nach dem Speichern.',
        'history.exportAll': 'Alle exportieren',
        'history.import': 'Importieren',
        
        // Race browser
        'races.title': 'Beliebte Trailrennen',
        'races.search': 'Rennen suchen...',
        'races.all': 'Alle',
        'races.ultra': 'Ultra (100km+)',
        'races.marathon': 'Marathon Trail',
        'races.short': 'Kurz (<42km)',
        'races.missing': 'Rennen fehlt?',
        'races.request': 'Anfragen!',
        
        // Cookie consent
        'cookies.message': 'Wir nutzen Cookies für Analytics, um GPXray zu verbessern.',
        'cookies.accept': 'Akzeptieren',
        'cookies.decline': 'Ablehnen',
        
        // Surface types
        'surface.road': 'Straße',
        'surface.trail': 'Trail',
        'surface.technical': 'Technisch',
        'surface.unknown': 'Unbekannt',
        
        // Terrain types
        'terrain.flat': 'Flach',
        'terrain.uphill': 'Bergauf',
        'terrain.downhill': 'Bergab',
        
        // Course shape insights
        'shape.frontInsightDynamic': '{pct}% Anstieg in erster Hälfte → Beine schonen für schnellen Abstieg nach KM{km}',
        'shape.backInsightDynamic': '{pct}% Anstieg in zweiter Hälfte → Früh Energie sparen, spät alles geben',
        'shape.balancedInsightDynamic': 'Gleichmäßige Anstiegsverteilung → Konstanter Einsatz durchgehend',
        
        // Sun times special cases
        'sun.polarNight': 'Polarnacht',
        'sun.midnightSun': 'Mitternachtssonne',
        
        // Print
        'print.title': 'Rennstrategie',
        
        // Button states
        'btn.loading': '⏳ Lädt...',
        'btn.demoLoaded': '✅ Demo geladen!',
        'btn.generating': '⏳ Generiere...',
        'btn.creating': '⏳ Erstelle...',
        'btn.joining': 'Beitritt...',
        'btn.joinWaitlist': 'Warteliste beitreten',
        
        // Race browser
        'races.noResults': 'Keine Rennen gefunden, die deinen Kriterien entsprechen.',
        
        // Splits table
        'splits.surface': 'Untergrund',
        'splits.aid': 'VP',
        'splits.stop': 'Stopp',
        'splits.clock': 'Uhrzeit',
        'splits.min': 'min',
        
        // Leg summary
        'leg.title': 'Etappen-Übersicht',
        'leg.leg': 'Etappe',
        'leg.dist': 'Dist',
        'leg.gain': 'Aufstieg',
        'leg.loss': 'Abstieg',
        'leg.time': 'Zeit',
        'leg.arrival': 'Ankunft',
        'leg.toFinish': 'bis Ziel',
        
        // General
        'general.loading': 'Lädt...',
        'general.error': 'Fehler',
        'general.success': 'Erfolg',
        'general.close': 'Schließen',
        'general.save': 'Speichern',
        'general.cancel': 'Abbrechen',
        'general.delete': 'Löschen'
    }
};

// Current language (default: English, or from localStorage)
let currentLang = localStorage.getItem('gpxray-lang') || 'en';

// Translation function
function t(key, params = {}) {
    let text = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || key;
    
    // Replace {placeholder} with values
    Object.keys(params).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    
    return text;
}

// Translate all elements with data-i18n attribute
function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const translation = t(key);
        
        // Check if we need to set innerHTML (for strings with <strong>, etc.)
        if (translation.includes('<')) {
            el.innerHTML = translation;
        } else {
            el.textContent = translation;
        }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    
    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });
    
    // Update html lang attribute
    document.documentElement.lang = currentLang;
}

// Set language and re-translate
function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    
    currentLang = lang;
    localStorage.setItem('gpxray-lang', lang);
    translatePage();
    
    // Update language toggle buttons if they exist
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.querySelectorAll('.lang-btn').forEach(btn => {
            if (btn.dataset.lang === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Re-render dynamic content if GPX is loaded
    if (typeof gpxData !== 'undefined' && gpxData) {
        if (typeof updateHeroSection === 'function') {
            updateHeroSection();
        }
        if (typeof generateSplitsTable === 'function') {
            generateSplitsTable();
        }
        if (typeof updateMapLegend === 'function') {
            const surfaceToggle = document.getElementById('surfaceColors');
            updateMapLegend(surfaceToggle ? surfaceToggle.checked : false);
        }
        if (typeof displaySurfaceStats === 'function') {
            displaySurfaceStats();
        }
    }
}

// Get current language
function getLang() {
    return currentLang;
}

// Initialize language on page load
function initI18n() {
    // Check URL param first (for sharing links)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && TRANSLATIONS[urlLang]) {
        currentLang = urlLang;
        localStorage.setItem('gpxray-lang', currentLang);
    }
    
    // Try browser language as fallback
    if (!localStorage.getItem('gpxray-lang')) {
        const browserLang = navigator.language.split('-')[0];
        if (TRANSLATIONS[browserLang]) {
            currentLang = browserLang;
        }
    }
    
    // Translate the page
    translatePage();
}
