"""
Azure Function - GPXray Calculate API (v2 Programming Model)
For Azure Functions Flex Consumption Plan

Protected Business Logic:
- ITRA score calculations
- Target time reverse engineering
- DDL (Dynamic Descent Load) model
- Fatigue multipliers
- Surface type adjustments
"""
import azure.functions as func
import json
import logging
import math

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Runner level presets (protected backend logic)
RUNNER_LEVELS = {
    'beginner': {
        'name': 'Beginner',
        'flatPace': 8.0,
        'uphillRatio': 1.5,
        'downhillRatio': 0.9,
        'dft': 6000
    },
    'intermediate': {
        'name': 'Intermediate',
        'flatPace': 6.5,
        'uphillRatio': 1.4,
        'downhillRatio': 0.85,
        'dft': 9000
    },
    'advanced': {
        'name': 'Advanced',
        'flatPace': 5.5,
        'uphillRatio': 1.3,
        'downhillRatio': 0.82,
        'dft': 12000
    },
    'elite': {
        'name': 'Elite',
        'flatPace': 4.5,
        'uphillRatio': 1.25,
        'downhillRatio': 0.8,
        'dft': 15000
    }
}

# Surface type multipliers
SURFACE_TYPES = {
    'road': {'flat': 1.0, 'uphill': 1.0, 'downhill': 1.0},
    'trail': {'flat': 1.05, 'uphill': 1.08, 'downhill': 1.10},
    'technical': {'flat': 1.12, 'uphill': 1.15, 'downhill': 1.20},
    'rocky': {'flat': 1.15, 'uphill': 1.18, 'downhill': 1.25},
    'sand': {'flat': 1.25, 'uphill': 1.30, 'downhill': 1.15}
}

# ============================================================================
# PROTECTED ALGORITHMS - Core IP
# ============================================================================

def get_fatigue_multiplier(distance_km: float) -> float:
    """Ultra-distance fatigue multiplier - core protected algorithm"""
    if distance_km <= 21:
        return 1.0
    elif distance_km <= 42:
        return 1.05
    elif distance_km <= 50:
        return 1.12
    elif distance_km <= 65:
        return 1.18
    elif distance_km <= 80:
        return 1.25
    elif distance_km <= 100:
        return 1.32
    elif distance_km <= 130:
        return 1.40
    else:
        return 1.50


def calculate_effort_points(distance_km: float, elevation_m: float) -> float:
    """
    ITRA Effort Points Formula - Protected
    Standard: distance + (elevation / 100)
    """
    return distance_km + (elevation_m / 100)


def calculate_itra_from_race(distance_km: float, elevation_m: float, time_minutes: float) -> int:
    """
    Estimate ITRA score from past race performance - Protected Algorithm
    
    Calibration points:
    - 550 score ≈ 5.5 min/effort point
    - 700 score ≈ 4.3 min/effort point  
    - 800 score ≈ 3.7 min/effort point
    
    Formula: Score ≈ 3000 / minutesPerPoint
    """
    if distance_km <= 0 or time_minutes <= 0:
        return 550  # Default
    
    effort_points = calculate_effort_points(distance_km, elevation_m)
    minutes_per_point = time_minutes / effort_points
    
    # Core formula - protected
    estimated_score = round(3000 / minutes_per_point)
    
    # Clamp to realistic range
    return max(350, min(950, estimated_score))


def calculate_paces_from_itra(
    itra_score: int,
    segments: list,
    total_distance: float,
    elevation_gain: float,
    uphill_ratio: float = 1.3,
    downhill_ratio: float = 0.85
) -> dict:
    """
    Convert ITRA score to terrain-specific paces - Protected Algorithm
    
    Core formula: minutesPerPoint = 3000 / itraScore
    """
    effort_points = calculate_effort_points(total_distance, elevation_gain)
    
    # Core ITRA to time conversion - protected
    minutes_per_point = 3000 / itra_score
    total_running_minutes = effort_points * minutes_per_point
    
    # Calculate terrain breakdown
    flat_dist = sum(s.get('distance', 0) for s in segments if s.get('terrainType') == 'flat')
    uphill_dist = sum(s.get('distance', 0) for s in segments if s.get('terrainType') == 'uphill')
    downhill_dist = sum(s.get('distance', 0) for s in segments if s.get('terrainType') == 'downhill')
    
    # Calculate weighted distance
    weighted_distance = flat_dist + (uphill_dist * uphill_ratio) + (downhill_dist * downhill_ratio)
    
    if weighted_distance <= 0:
        weighted_distance = total_distance
    
    # Calculate flat pace that achieves target time
    flat_pace = total_running_minutes / weighted_distance
    
    return {
        'flat': flat_pace,
        'uphill': flat_pace * uphill_ratio,
        'downhill': flat_pace * downhill_ratio,
        'estimatedTime': total_running_minutes
    }


def calculate_paces_from_target(
    target_time_minutes: float,
    segments: list,
    total_distance: float,
    aid_stations: list,
    uphill_ratio: float = 1.2,
    downhill_ratio: float = 0.9,
    apply_surface: bool = False
) -> dict:
    """
    Reverse-calculate paces from target finish time - Protected Algorithm
    
    Works backwards through:
    1. Subtract stop times
    2. Divide by fatigue multiplier
    3. Account for surface factors
    4. Solve for base flat pace
    """
    # Subtract AID station stop times
    total_stop_time = sum(s.get('stopMin', 0) for s in aid_stations)
    running_time_target = target_time_minutes - total_stop_time
    
    # Get fatigue multiplier
    fatigue_multiplier = get_fatigue_multiplier(total_distance)
    
    # Calculate terrain breakdown
    flat_dist = sum(s.get('distance', 0) for s in segments if s.get('terrainType') == 'flat')
    uphill_dist = sum(s.get('distance', 0) for s in segments if s.get('terrainType') == 'uphill')
    downhill_dist = sum(s.get('distance', 0) for s in segments if s.get('terrainType') == 'downhill')
    
    # Calculate weighted surface factor if enabled
    weighted_surface_factor = 1.0
    if apply_surface and segments:
        total_weighted_time = 0
        total_base_time = 0
        
        for segment in segments:
            terrain = segment.get('terrainType', 'flat')
            if terrain == 'uphill':
                base_pace_ratio = uphill_ratio
            elif terrain == 'downhill':
                base_pace_ratio = downhill_ratio
            else:
                base_pace_ratio = 1.0
            
            surface = segment.get('surfaceType', 'trail')
            surface_multiplier = SURFACE_TYPES.get(surface, {}).get(terrain, 1.0)
            
            base_time = segment.get('distance', 0) * base_pace_ratio
            total_base_time += base_time
            total_weighted_time += base_time * surface_multiplier
        
        if total_base_time > 0:
            weighted_surface_factor = total_weighted_time / total_base_time
    
    # Work backwards: divide by fatigue and surface factors
    pure_running_time = running_time_target / fatigue_multiplier / weighted_surface_factor
    
    # Solve for flat pace
    weighted_distance = flat_dist + (uphill_dist * uphill_ratio) + (downhill_dist * downhill_ratio)
    
    if weighted_distance <= 0:
        weighted_distance = total_distance
    
    flat_pace = pure_running_time / weighted_distance
    
    return {
        'flat': flat_pace,
        'uphill': flat_pace * uphill_ratio,
        'downhill': flat_pace * downhill_ratio,
        'fatigueMultiplier': fatigue_multiplier,
        'surfaceFactor': weighted_surface_factor
    }


def calculate_ddl(segments: list, runner_level: str = 'intermediate') -> dict:
    """
    Dynamic Descent Load (DDL) - Protected Algorithm
    
    Models cumulative muscular stress from downhill running.
    
    Formula: DDL = Σ(elevationDrop × slopeWeight × surfaceWeight × fatigueWeight)
    
    Where:
    - slopeWeight = 1 + (gradePercent / 20)^1.4
    - surfaceWeight = surface multiplier for downhill
    - fatigueWeight = 1 + (cumulativeDDL / 3000) * 0.15
    
    Returns pace loss prediction based on DDL vs runner's DFT threshold.
    """
    preset = RUNNER_LEVELS.get(runner_level, RUNNER_LEVELS['intermediate'])
    runner_dft = preset.get('dft', 9000)
    base_downhill_pace = preset['flatPace'] * preset['downhillRatio']
    
    ddl_total = 0
    cumulative_ddl = 0
    fatigue_onset_km = None
    fatigue_threshold = 3000  # DDL threshold where fatigue compounds
    
    for segment in segments:
        if segment.get('terrainType') == 'downhill':
            elevation_change = segment.get('elevationChange', 0)
            if elevation_change < 0:
                grade_percent = abs(segment.get('grade', 0))
                elevation_drop = abs(elevation_change)
                
                # Slope weight: steeper = more braking force
                slope_weight = 1 + math.pow(grade_percent / 20, 1.4)
                
                # Surface weight
                surface = segment.get('surfaceType', 'trail')
                surface_weight = SURFACE_TYPES.get(surface, {}).get('downhill', 1.0)
                
                # Fatigue weight: accumulated damage compounds
                fatigue_weight = 1 + (cumulative_ddl / fatigue_threshold) * 0.15
                
                # Calculate segment DDL
                segment_ddl = elevation_drop * slope_weight * surface_weight * fatigue_weight
                ddl_total += segment_ddl
                cumulative_ddl += segment_ddl
                
                # Check fatigue onset (ratio >= 0.8)
                fatigue_ratio = cumulative_ddl / runner_dft
                if fatigue_ratio >= 0.8 and fatigue_onset_km is None:
                    fatigue_onset_km = segment.get('startDistance', 0)
    
    # Calculate pace loss using quadratic formula
    final_fatigue_ratio = ddl_total / runner_dft
    pace_loss_factor = 1 + math.pow(max(0, final_fatigue_ratio - 0.8), 2)
    
    base_pace_sec = base_downhill_pace * 60  # seconds/km
    adjusted_pace_sec = base_pace_sec * pace_loss_factor
    pace_loss_sec = round(adjusted_pace_sec - base_pace_sec)
    
    # Calculate range (±30% uncertainty)
    pace_loss_min = round(pace_loss_sec * 0.7)
    pace_loss_max = round(pace_loss_sec * 1.3)
    
    return {
        'ddlTotal': round(ddl_total),
        'fatigueRatio': round(final_fatigue_ratio, 2),
        'fatigueOnsetKm': fatigue_onset_km,
        'paceLossSeconds': pace_loss_sec,
        'paceLossRange': {'min': pace_loss_min, 'max': pace_loss_max},
        'runnerDFT': runner_dft
    }


# ============================================================================
# MAIN CALCULATION ENGINE
# ============================================================================

def calculate_segment_time(segment: dict, paces: dict, apply_surface: bool) -> dict:
    """Calculate time for a single segment"""
    terrain = segment.get('terrainType', 'flat')
    distance = segment.get('distance', 0)
    surface = segment.get('surfaceType', 'trail')
    
    if terrain == 'uphill':
        pace = paces['uphill']
    elif terrain == 'downhill':
        pace = paces['downhill']
    else:
        pace = paces['flat']
    
    if apply_surface and surface in SURFACE_TYPES:
        pace *= SURFACE_TYPES[surface].get(terrain, 1.0)
    
    return {
        'terrain': terrain,
        'distance': distance,
        'time': distance * pace
    }


def calculate_race_plan(data: dict) -> dict:
    """Main calculation function - routes to appropriate algorithm based on mode"""
    segments = data.get('segments', [])
    runner_level = data.get('runnerLevel', 'intermediate')
    aid_stations = data.get('aidStations', [])
    apply_surface = data.get('applySurface', False)
    start_time = data.get('startTime', '09:00')
    total_distance = data.get('totalDistance', 0)
    elevation_gain = data.get('elevationGain', 0)
    mode = data.get('mode', 'preset')
    
    preset = RUNNER_LEVELS.get(runner_level, RUNNER_LEVELS['intermediate'])
    
    # Determine paces based on mode
    if mode == 'manual':
        manual_paces = data.get('manualPaces', {})
        paces = {
            'flat': manual_paces.get('flat', preset['flatPace']),
            'uphill': manual_paces.get('uphill', preset['flatPace'] * preset['uphillRatio']),
            'downhill': manual_paces.get('downhill', preset['flatPace'] * preset['downhillRatio'])
        }
    elif mode == 'itra':
        itra_score = data.get('itraScore', 550)
        uphill_ratio = data.get('uphillRatio', preset['uphillRatio'])
        downhill_ratio = data.get('downhillRatio', preset['downhillRatio'])
        
        itra_result = calculate_paces_from_itra(
            itra_score, segments, total_distance, elevation_gain,
            uphill_ratio, downhill_ratio
        )
        paces = {
            'flat': itra_result['flat'],
            'uphill': itra_result['uphill'],
            'downhill': itra_result['downhill']
        }
    elif mode == 'target':
        target_time = data.get('targetTime', 300)  # minutes
        uphill_ratio = data.get('uphillRatio', 1.2)
        downhill_ratio = data.get('downhillRatio', 0.9)
        
        target_result = calculate_paces_from_target(
            target_time, segments, total_distance, aid_stations,
            uphill_ratio, downhill_ratio, apply_surface
        )
        paces = {
            'flat': target_result['flat'],
            'uphill': target_result['uphill'],
            'downhill': target_result['downhill']
        }
    else:
        # Default: use runner level preset
        paces = {
            'flat': preset['flatPace'],
            'uphill': preset['flatPace'] * preset['uphillRatio'],
            'downhill': preset['flatPace'] * preset['downhillRatio']
        }
    
    fatigue = get_fatigue_multiplier(total_distance)
    
    # Calculate terrain breakdown
    flat_distance = uphill_distance = downhill_distance = 0
    flat_time = uphill_time = downhill_time = 0
    
    for segment in segments:
        result = calculate_segment_time(segment, paces, apply_surface)
        terrain = result['terrain']
        
        if terrain == 'flat':
            flat_distance += result['distance']
            flat_time += result['time']
        elif terrain == 'uphill':
            uphill_distance += result['distance']
            uphill_time += result['time']
        elif terrain == 'downhill':
            downhill_distance += result['distance']
            downhill_time += result['time']
    
    running_time = flat_time + uphill_time + downhill_time
    adjusted_running_time = running_time * fatigue
    
    total_stop_time = sum(s.get('stopMin', 0) for s in aid_stations)
    total_time = adjusted_running_time + total_stop_time
    
    # Calculate DDL
    ddl_result = calculate_ddl(segments, runner_level)
    
    # Calculate checkpoints
    checkpoints = []
    for station in sorted(aid_stations, key=lambda s: s.get('km', 0)):
        station_km = station.get('km', 0)
        time_to_station = 0
        
        for segment in segments:
            seg_start = segment.get('startDistance', 0)
            seg_end = segment.get('endDistance', 0)
            
            if seg_end <= station_km:
                result = calculate_segment_time(segment, paces, apply_surface)
                time_to_station += result['time']
            elif seg_start < station_km:
                result = calculate_segment_time(segment, paces, apply_surface)
                partial_ratio = (station_km - seg_start) / segment.get('distance', 1)
                time_to_station += result['time'] * partial_ratio
                break
        
        time_to_station *= fatigue
        
        for prev_station in aid_stations:
            if prev_station.get('km', 0) < station_km:
                time_to_station += prev_station.get('stopMin', 0)
        
        checkpoints.append({
            'name': station.get('name', 'VP'),
            'km': station_km,
            'timeMinutes': time_to_station,
            'stopMin': station.get('stopMin', 0)
        })
    
    # Format times
    try:
        start_parts = start_time.split(':')
        start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
    except:
        start_minutes = 9 * 60
    
    finish_minutes = start_minutes + total_time
    finish_hours = int(finish_minutes // 60) % 24
    finish_mins = int(finish_minutes % 60)
    
    total_hours = int(total_time // 60)
    total_mins = int(total_time % 60)
    total_secs = int((total_time % 1) * 60)
    
    return {
        'totalTimeMinutes': total_time,
        'totalTimeFormatted': f"{total_hours}:{total_mins:02d}:{total_secs:02d}",
        'finishClockTime': f"{finish_hours:02d}:{finish_mins:02d}",
        'fatigueMultiplier': fatigue,
        'paces': paces,
        'terrain': {
            'flatDistance': flat_distance,
            'uphillDistance': uphill_distance,
            'downhillDistance': downhill_distance,
            'flatTime': flat_time * fatigue,
            'uphillTime': uphill_time * fatigue,
            'downhillTime': downhill_time * fatigue
        },
        'ddl': ddl_result,
        'checkpoints': checkpoints,
        'stopTimeMinutes': total_stop_time,
        'runnerLevel': runner_level,
        'preset': preset
    }


# ============================================================================
# HTTP ENDPOINTS
# ============================================================================

def get_cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    }


@app.route(route="calculate", methods=["POST", "OPTIONS"])
def calculate(req: func.HttpRequest) -> func.HttpResponse:
    """Main race plan calculation endpoint"""
    logging.info('Calculate API called')
    headers = get_cors_headers()
    
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        data = req.get_json()
        result = calculate_race_plan(data)
        return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'Calculation error: {str(e)}')
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=500, headers=headers)


@app.route(route="itra", methods=["POST", "OPTIONS"])
def itra_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    """ITRA score estimation from past race"""
    logging.info('ITRA API called')
    headers = get_cors_headers()
    
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        data = req.get_json()
        distance = data.get('distance', 0)
        elevation = data.get('elevation', 0)
        time_minutes = data.get('timeMinutes', 0)
        
        estimated_score = calculate_itra_from_race(distance, elevation, time_minutes)
        effort_points = calculate_effort_points(distance, elevation)
        
        # Determine level
        if estimated_score >= 800:
            level = 'Elite'
        elif estimated_score >= 700:
            level = 'Competitive'
        elif estimated_score >= 600:
            level = 'Advanced'
        elif estimated_score >= 500:
            level = 'Intermediate'
        else:
            level = 'Beginner'
        
        return func.HttpResponse(json.dumps({
            'score': estimated_score,
            'level': level,
            'effortPoints': round(effort_points, 1)
        }), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'ITRA error: {str(e)}')
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=500, headers=headers)


@app.route(route="ddl", methods=["POST", "OPTIONS"])
def ddl_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    """DDL (Dynamic Descent Load) calculation endpoint"""
    logging.info('DDL API called')
    headers = get_cors_headers()
    
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        data = req.get_json()
        segments = data.get('segments', [])
        runner_level = data.get('runnerLevel', 'intermediate')
        
        result = calculate_ddl(segments, runner_level)
        return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'DDL error: {str(e)}')
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=500, headers=headers)
