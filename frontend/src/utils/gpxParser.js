import gpxParser from 'gpxparser';

/**
 * Parse a GPX file and extract waypoints and trackpoints
 * @param {File} file - The GPX file to parse
 * @returns {Promise<{points: Array, metadata: Object}>} Parsed GPX data
 */
export const parseGPXFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const gpx = new gpxParser();
        gpx.parse(e.target.result);

        const points = [];

        // Extract track points
        if (gpx.tracks && gpx.tracks.length > 0) {
          gpx.tracks.forEach((track, trackIdx) => {
            track.points.forEach((point, pointIdx) => {
              points.push({
                lat: point.lat,
                lon: point.lon,
                elevation: point.ele,
                time: point.time,
                name: `${track.name || 'Track'} - Point ${pointIdx + 1}`,
                index: points.length
              });
            });
          });
        }

        // Extract waypoints
        if (gpx.waypoints && gpx.waypoints.length > 0) {
          gpx.waypoints.forEach((waypoint, idx) => {
            points.push({
              lat: waypoint.lat,
              lon: waypoint.lon,
              elevation: waypoint.ele,
              name: waypoint.name || `Waypoint ${idx + 1}`,
              index: points.length,
              isWaypoint: true
            });
          });
        }

        if (points.length === 0) {
          reject(new Error('No route data found in GPX file'));
          return;
        }

        resolve({
          points,
          metadata: {
            name: gpx.metadata?.name,
            totalPoints: points.length,
            bounds: gpx.tracks[0]?.bounds
          }
        });
      } catch (error) {
        reject(new Error('Invalid GPX file format'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Sample points evenly from a route
 * @param {Array} allPoints - All points from the GPX file
 * @param {number} targetCount - Desired number of sampled points (default: 10)
 * @returns {Array} Sampled points
 */
export const samplePoints = (allPoints, targetCount = 10) => {
  if (allPoints.length <= targetCount) {
    return allPoints;
  }

  const sampled = [allPoints[0]]; // Always include first point
  const step = Math.floor((allPoints.length - 1) / (targetCount - 1));

  for (let i = step; i < allPoints.length - step; i += step) {
    sampled.push(allPoints[i]);
  }

  sampled.push(allPoints[allPoints.length - 1]); // Always include last point

  return sampled;
};
