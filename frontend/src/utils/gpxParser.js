/**
 * Parse a GPX file using native browser DOMParser
 * This avoids issues with third-party libraries in strict mode
 * @param {File} file - The GPX file to parse
 * @returns {Promise<{points: Array, metadata: Object}>} Parsed GPX data
 */
export const parseGPXFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const xmlContent = e.target.result;

        // Validate that we have XML content
        if (!xmlContent || typeof xmlContent !== 'string') {
          reject(new Error('File is empty or not readable'));
          return;
        }

        // Parse XML using browser's DOMParser
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          reject(new Error('Invalid XML format'));
          return;
        }

        const points = [];
        let trackName = 'GPX Route';

        // Extract metadata
        const metadataEl = xmlDoc.querySelector('metadata');
        if (metadataEl) {
          const nameEl = metadataEl.querySelector('name');
          if (nameEl && nameEl.textContent) {
            trackName = nameEl.textContent;
          }
        }

        // Extract track points from <trk><trkseg><trkpt>
        const tracks = xmlDoc.querySelectorAll('trk');
        tracks.forEach((track, trackIdx) => {
          const trackNameEl = track.querySelector('name');
          const currentTrackName = trackNameEl?.textContent || `Track ${trackIdx + 1}`;

          const trackPoints = track.querySelectorAll('trkpt');
          trackPoints.forEach((trkpt, pointIdx) => {
            const lat = parseFloat(trkpt.getAttribute('lat'));
            const lon = parseFloat(trkpt.getAttribute('lon'));

            if (!isNaN(lat) && !isNaN(lon)) {
              const eleEl = trkpt.querySelector('ele');
              const timeEl = trkpt.querySelector('time');

              points.push({
                lat,
                lon,
                elevation: eleEl ? parseFloat(eleEl.textContent) : null,
                time: timeEl ? new Date(timeEl.textContent) : null,
                name: `${currentTrackName} - Point ${pointIdx + 1}`,
                index: points.length
              });
            }
          });
        });

        // Extract route points from <rte><rtept>
        const routes = xmlDoc.querySelectorAll('rte');
        routes.forEach((route, routeIdx) => {
          const routeNameEl = route.querySelector('name');
          const currentRouteName = routeNameEl?.textContent || `Route ${routeIdx + 1}`;

          const routePoints = route.querySelectorAll('rtept');
          routePoints.forEach((rtept, pointIdx) => {
            const lat = parseFloat(rtept.getAttribute('lat'));
            const lon = parseFloat(rtept.getAttribute('lon'));

            if (!isNaN(lat) && !isNaN(lon)) {
              const eleEl = rtept.querySelector('ele');
              const timeEl = rtept.querySelector('time');

              points.push({
                lat,
                lon,
                elevation: eleEl ? parseFloat(eleEl.textContent) : null,
                time: timeEl ? new Date(timeEl.textContent) : null,
                name: `${currentRouteName} - Point ${pointIdx + 1}`,
                index: points.length
              });
            }
          });
        });

        // Extract waypoints from <wpt>
        const waypoints = xmlDoc.querySelectorAll('wpt');
        waypoints.forEach((wpt, idx) => {
          const lat = parseFloat(wpt.getAttribute('lat'));
          const lon = parseFloat(wpt.getAttribute('lon'));

          if (!isNaN(lat) && !isNaN(lon)) {
            const nameEl = wpt.querySelector('name');
            const eleEl = wpt.querySelector('ele');

            points.push({
              lat,
              lon,
              elevation: eleEl ? parseFloat(eleEl.textContent) : null,
              name: nameEl?.textContent || `Waypoint ${idx + 1}`,
              index: points.length,
              isWaypoint: true
            });
          }
        });

        if (points.length === 0) {
          reject(new Error('No route data found in GPX file. File must contain tracks, routes, or waypoints.'));
          return;
        }

        resolve({
          points,
          metadata: {
            name: trackName,
            totalPoints: points.length
          }
        });
      } catch (error) {
        console.error('GPX parsing error:', error);
        reject(new Error(`Failed to parse GPX file: ${error.message}`));
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
