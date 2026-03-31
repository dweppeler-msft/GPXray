#!/usr/bin/env python3
"""
GPX Upload Tool for GPXray
Validates GPX files, calculates stats, uploads to Azure Blob Storage,
and updates races.json database

Supports local files or URLs:
  python gpx-upload.py local-file.gpx -n "Race Name" --deploy
  python gpx-upload.py https://example.com/race.gpx -n "Race Name" --deploy
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse, unquote

# Find project root (where races.json is)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
RACES_JSON = PROJECT_ROOT / 'races.json'
INBOX_DIR = PROJECT_ROOT / 'inbox'


def is_url(path):
    """Check if path is a URL"""
    return path.startswith('http://') or path.startswith('https://')


def download_gpx(url):
    """Download GPX file from URL to inbox folder"""
    print(f"⬇️  Downloading from URL...")
    
    # Extract filename from URL
    parsed = urlparse(url)
    filename = unquote(Path(parsed.path).name)
    if not filename.endswith('.gpx'):
        filename += '.gpx'
    
    # Clean filename
    filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    
    # Download to inbox
    INBOX_DIR.mkdir(exist_ok=True)
    local_path = INBOX_DIR / filename
    
    try:
        # Download with user-agent header (some servers block urllib default)
        req = urllib.request.Request(url, headers={'User-Agent': 'GPXray/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read()
            with open(local_path, 'wb') as f:
                f.write(content)
        
        print(f"✅ Downloaded: {filename}")
        return local_path
    except Exception as e:
        print(f"❌ Download failed: {e}")
        sys.exit(1)


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


def generate_race_id(name):
    """Generate race ID from name"""
    import re
    race_id = name.lower()
    race_id = re.sub(r'[^a-z0-9]+', '-', race_id)
    race_id = race_id.strip('-')[:30]
    return race_id


def load_races_json():
    """Load races.json"""
    if not RACES_JSON.exists():
        return {"races": []}
    with open(RACES_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_races_json(data):
    """Save races.json with proper formatting"""
    with open(RACES_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def add_race_to_json(race_entry):
    """Add or update race in races.json"""
    data = load_races_json()
    races = data.get('races', [])
    
    # Check if race exists
    existing_idx = None
    for i, race in enumerate(races):
        if race['id'] == race_entry['id']:
            existing_idx = i
            break
    
    if existing_idx is not None:
        print(f"⚠️  Race '{race_entry['id']}' already exists. Updating...")
        races[existing_idx] = race_entry
    else:
        # Insert at end of available races (before "Coming Soon" races)
        insert_idx = 0
        for i, race in enumerate(races):
            if race.get('available', False):
                insert_idx = i + 1
        races.insert(insert_idx, race_entry)
    
    data['races'] = races
    save_races_json(data)
    return existing_idx is not None


def git_deploy(race_name):
    """Commit and push changes to both remotes"""
    os.chdir(PROJECT_ROOT)
    
    # Add races.json
    result = subprocess.run('git add races.json', shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return False, f"git add failed: {result.stderr}"
    
    # Commit
    commit_msg = f"Add race: {race_name}"
    result = subprocess.run(f'git commit -m "{commit_msg}"', shell=True, capture_output=True, text=True)
    if result.returncode != 0 and 'nothing to commit' not in result.stdout:
        return False, f"git commit failed: {result.stderr}"
    
    # Push to origin
    result = subprocess.run('git push origin main', shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return False, f"git push origin failed: {result.stderr}"
    
    # Push to gpxray (production)
    result = subprocess.run('git push gpxray main', shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return False, f"git push gpxray failed: {result.stderr}"
    
    return True, None


def main():
    parser = argparse.ArgumentParser(description='Upload GPX file to GPXray')
    parser.add_argument('gpx_file', help='Path to GPX file or URL')
    parser.add_argument('--name', '-n', required=True, help='Race name')
    parser.add_argument('--country', '-c', default='🌍', help='Country flag emoji or code (default: 🌍)')
    parser.add_argument('--category', '-t', choices=['short', 'marathon', 'ultra'], default='marathon',
                        help='Race category (default: marathon)')
    parser.add_argument('--no-upload', action='store_true', help='Validate only, do not upload')
    parser.add_argument('--deploy', '-d', action='store_true', help='Commit and push to GitHub after adding')
    parser.add_argument('--blob-name', '-b', help='Custom blob filename (default: derived from input)')
    
    args = parser.parse_args()
    
    # Handle URL or local file
    if is_url(args.gpx_file):
        print(f"\n🌐 URL detected")
        print("=" * 50)
        filepath = download_gpx(args.gpx_file)
    else:
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
    
    # Upload to blob storage
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
    
    # Create race entry
    distance_rounded = round(stats['distance'])
    elevation_rounded = round(stats['elevation_gain'])
    
    race_entry = {
        "id": generate_race_id(args.name),
        "name": args.name,
        "country": args.country,
        "distance": distance_rounded,
        "elevation": elevation_rounded,
        "category": args.category,
        "gpxUrl": f"races/{blob_name}",
        "available": True
    }
    
    # Update races.json
    if not args.no_upload:
        print(f"\n📝 Updating races.json...")
        was_update = add_race_to_json(race_entry)
        action = "Updated" if was_update else "Added"
        print(f"✅ {action} race: {race_entry['name']} ({race_entry['id']})")
    
    # Deploy if requested
    if args.deploy and not args.no_upload:
        print(f"\n🚀 Deploying to GitHub...")
        success, error = git_deploy(args.name)
        if success:
            print("✅ Pushed to origin and gpxray")
            print("🌐 Live at https://gpxray.github.io in ~1 minute")
        else:
            print(f"❌ Deploy failed: {error}")
            sys.exit(1)
    elif not args.no_upload:
        print("\n💡 Run with --deploy to push changes to GitHub")
    
    print("\n" + "=" * 50)
    print("✨ Done!")
    print(f"   Race: {args.name}")
    print(f"   Distance: {distance_rounded} km")
    print(f"   Elevation: +{elevation_rounded}m")


if __name__ == '__main__':
    main()
