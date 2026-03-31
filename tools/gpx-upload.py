#!/usr/bin/env python3
"""
GPX Upload Tool for GPXray
Validates GPX files, calculates stats, uploads to Azure Blob Storage,
and generates the raceDatabase entry for app.js
"""
import argparse
import math
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in km"""
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def parse_gpx(filepath):
    """Parse GPX file and extract track points"""
    tree = ET.parse(filepath)
    root = tree.getroot()
    
    # Handle GPX namespace
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    
    # Try with namespace first, then without
    trkpts = root.findall('.//gpx:trkpt', ns)
    if not trkpts:
        trkpts = root.findall('.//trkpt')
    
    if not trkpts:
        # Try route points
        trkpts = root.findall('.//gpx:rtept', ns)
        if not trkpts:
            trkpts = root.findall('.//rtept')
    
    points = []
    for pt in trkpts:
        lat = float(pt.get('lat'))
        lon = float(pt.get('lon'))
        
        # Get elevation
        ele = pt.find('gpx:ele', ns)
        if ele is None:
            ele = pt.find('ele')
        
        elevation = float(ele.text) if ele is not None and ele.text else None
        points.append({'lat': lat, 'lon': lon, 'ele': elevation})
    
    return points


def calculate_stats(points):
    """Calculate distance and elevation from points"""
    total_distance = 0
    elevation_gain = 0
    elevation_loss = 0
    
    # Smoothing: average elevation over 50m segments
    SEGMENT_DIST = 0.05  # km
    MIN_CHANGE = 1  # meters
    
    smoothed_elevations = []
    segment_sum = 0
    segment_count = 0
    segment_start_dist = 0
    current_dist = 0
    
    for i in range(1, len(points)):
        prev = points[i-1]
        curr = points[i]
        
        dist = haversine_distance(prev['lat'], prev['lon'], curr['lat'], curr['lon'])
        total_distance += dist
        current_dist += dist
        
        if curr['ele'] is not None:
            segment_sum += curr['ele']
            segment_count += 1
        
        if current_dist - segment_start_dist >= SEGMENT_DIST and segment_count > 0:
            smoothed_elevations.append(segment_sum / segment_count)
            segment_start_dist = current_dist
            segment_sum = 0
            segment_count = 0
    
    # Final segment
    if segment_count > 0:
        smoothed_elevations.append(segment_sum / segment_count)
    
    # Calculate gain/loss from smoothed data
    for i in range(1, len(smoothed_elevations)):
        change = smoothed_elevations[i] - smoothed_elevations[i-1]
        if abs(change) >= MIN_CHANGE:
            if change > 0:
                elevation_gain += change
            else:
                elevation_loss += abs(change)
    
    return {
        'distance': total_distance,
        'elevation_gain': elevation_gain,
        'elevation_loss': elevation_loss,
        'points': len(points),
        'has_elevation': any(p['ele'] is not None for p in points)
    }


def validate_gpx(points, stats):
    """Validate GPX data quality"""
    issues = []
    
    if len(points) < 10:
        issues.append(f"❌ Too few points ({len(points)}). Need at least 10.")
    
    if not stats['has_elevation']:
        issues.append("⚠️  No elevation data. Calculations will be less accurate.")
    
    if stats['distance'] < 1:
        issues.append(f"❌ Distance too short ({stats['distance']:.2f} km)")
    
    if stats['distance'] > 500:
        issues.append(f"⚠️  Very long distance ({stats['distance']:.1f} km). Verify this is correct.")
    
    return issues


def upload_to_blob(filepath, blob_name):
    """Upload file to Azure Blob Storage"""
    cmd = f'az storage blob upload --account-name gpxrayraces --container-name races --file "{filepath}" --name "{blob_name}" --overwrite'
    
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.returncode == 0, result.stderr


def generate_race_entry(blob_name, name, country, distance, elevation, category):
    """Generate raceDatabase entry for app.js"""
    race_id = name.lower().replace(' ', '-').replace('/', '-')[:20]
    
    return f"""{{ id: '{race_id}', name: '{name}', country: '{country}', distance: {distance}, elevation: {elevation}, category: '{category}', gpxUrl: 'races/{blob_name}', available: true }}"""


def main():
    parser = argparse.ArgumentParser(description='Upload GPX file to GPXray')
    parser.add_argument('gpx_file', help='Path to GPX file')
    parser.add_argument('--name', '-n', required=True, help='Race name')
    parser.add_argument('--country', '-c', default='🌍', help='Country flag emoji (default: 🌍)')
    parser.add_argument('--category', '-t', choices=['short', 'marathon', 'ultra'], default='marathon',
                        help='Race category (default: marathon)')
    parser.add_argument('--no-upload', action='store_true', help='Validate only, do not upload')
    parser.add_argument('--blob-name', '-b', help='Custom blob filename (default: derived from input)')
    
    args = parser.parse_args()
    
    filepath = Path(args.gpx_file)
    if not filepath.exists():
        print(f"❌ File not found: {filepath}")
        sys.exit(1)
    
    print(f"\n📂 Processing: {filepath.name}")
    print("=" * 50)
    
    # Parse GPX
    try:
        points = parse_gpx(filepath)
    except Exception as e:
        print(f"❌ Failed to parse GPX: {e}")
        sys.exit(1)
    
    # Calculate stats
    stats = calculate_stats(points)
    
    print(f"📍 Points: {stats['points']:,}")
    print(f"📏 Distance: {stats['distance']:.1f} km")
    print(f"⛰️  Elevation: +{stats['elevation_gain']:.0f}m / -{stats['elevation_loss']:.0f}m")
    print(f"📊 Has elevation data: {'Yes ✅' if stats['has_elevation'] else 'No ⚠️'}")
    
    # Validate
    issues = validate_gpx(points, stats)
    if issues:
        print("\n⚠️  Validation issues:")
        for issue in issues:
            print(f"   {issue}")
        
        # Fatal issues start with ❌
        if any(issue.startswith('❌') for issue in issues):
            print("\n❌ Cannot upload due to critical issues.")
            sys.exit(1)
    else:
        print("\n✅ Validation passed!")
    
    # Generate blob name
    blob_name = args.blob_name or filepath.name.lower().replace(' ', '-')
    
    # Upload
    if not args.no_upload:
        print(f"\n☁️  Uploading to Azure Blob Storage...")
        success, error = upload_to_blob(filepath, blob_name)
        if success:
            print(f"✅ Uploaded: https://gpxrayraces.blob.core.windows.net/races/{blob_name}")
        else:
            print(f"❌ Upload failed: {error}")
            sys.exit(1)
    else:
        print(f"\n⏭️  Skipping upload (--no-upload)")
    
    # Generate code entry
    distance_rounded = round(stats['distance'])
    elevation_rounded = round(stats['elevation_gain'])
    
    entry = generate_race_entry(
        blob_name, args.name, args.country,
        distance_rounded, elevation_rounded, args.category
    )
    
    print("\n" + "=" * 50)
    print("📋 Add this to raceDatabase in app.js:")
    print("-" * 50)
    print(entry)
    print("-" * 50)
    print("\n✨ Done!")


if __name__ == '__main__':
    main()
