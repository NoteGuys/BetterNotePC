// High-Performance Inking & Stroke Smoothing Engine for BetterNote
// Supports Pen Nibs, Tapered Strokes (คมต้นคมปลาย), Pressure Curves, Scribble-to-Erase, and Precision Eraser

export const getMidPoint = (p1, p2) => {
  return {
    x: p1.x + (p2.x - p1.x) / 2,
    y: p1.y + (p2.y - p1.y) / 2
  };
};

/**
 * Calculate dynamic stroke width based on nib, pressure, tapering, and sensitivity
 */
export const calculateNibWidth = (
  nibType = 'fountain', 
  baseWidth = 4, 
  pressure = 0.5, 
  taperFactor = 1.0, 
  sensitivity = 'medium',
  usePressure = true
) => {
  let dynamicPressure = 0.5;
  if (usePressure) {
    const p = Math.max(0.05, Math.min(1.0, pressure));
    const sensPower = sensitivity === 'high' ? 1.5 : sensitivity === 'low' ? 0.8 : 1.15;
    dynamicPressure = Math.pow(p, sensPower);
  }

  let width = baseWidth;

  if (!usePressure) {
    // When pressure sensitivity is toggled off: uniform clean stroke width
    width = baseWidth;
  } else if (nibType === 'ballpoint') {
    // Ballpoint: mostly uniform with subtle pressure response
    width = baseWidth * (0.8 + dynamicPressure * 0.35);
  } else if (nibType === 'brush') {
    // Brush / Calligraphy: dramatic thick-to-thin range
    width = baseWidth * (0.2 + dynamicPressure * 2.2);
  } else {
    // Fountain Pen: classic elegant pressure response
    width = baseWidth * (0.35 + dynamicPressure * 1.3);
  }

  return Math.max(0.75, width * taperFactor);
};

/**
 * Calculate taper factor (0.1 to 1.0) for sharp start and end
 */
export const calculateTaper = (index, totalPoints, isTapered = true) => {
  if (!isTapered || totalPoints <= 4) return 1.0;

  const taperLength = Math.max(3, Math.min(16, Math.floor(totalPoints * 0.16)));
  
  let startFactor = 1.0;
  if (index < taperLength) {
    startFactor = Math.max(0.12, (index + 1) / taperLength);
  }

  let endFactor = 1.0;
  const distFromEnd = totalPoints - 1 - index;
  if (distFromEnd < taperLength) {
    endFactor = Math.max(0.08, (distFromEnd + 1) / taperLength);
  }

  return startFactor * endFactor;
};

/**
 * Draw a smooth stroke on a Canvas 2D context using Quadratic Bézier curves & Tapering
 */
export const renderStroke = (ctx, stroke) => {
  const { 
    tool, 
    color, 
    width, 
    points, 
    nibType = 'fountain',
    isTapered = true,
    usePressure = true,
    pressureSensitivity = 'medium'
  } = stroke;

  if (!points || points.length === 0) return;

  ctx.save();

  if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = width * 3.5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
  } else if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = width * 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else {
    // Pen
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // Single tap dot
  if (points.length === 1) {
    ctx.beginPath();
    const dotW = calculateNibWidth(nibType, width, points[0].pressure || 0.5, 1.0, pressureSensitivity, usePressure) / 2;
    ctx.arc(points[0].x, points[0].y, Math.max(1, dotW), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    ctx.beginPath();
    const p1 = points[0];
    const p2 = points[1];
    ctx.lineWidth = calculateNibWidth(nibType, width, (p1.pressure + p2.pressure) / 2, 1.0, pressureSensitivity, usePressure);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // If highlighter or eraser: render as single continuous path for speed & uniform blend
  if (tool === 'highlighter' || tool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const midPoint = getMidPoint(points[i], points[i + 1]);
      ctx.quadraticCurveTo(points[i].x, points[i].y, midPoint.x, midPoint.y);
    }
    const lastP = points[points.length - 1];
    const secLast = points[points.length - 2];
    ctx.quadraticCurveTo(secLast.x, secLast.y, lastP.x, lastP.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // For Pen with Tapered Start & End (คมต้นคมปลาย) & Dynamic Pressure
  let prevMidPoint = getMidPoint(points[0], points[1]);

  // Initial leader line
  const startTaper = calculateTaper(0, points.length, isTapered);
  ctx.lineWidth = calculateNibWidth(nibType, width, points[0].pressure || 0.5, startTaper, pressureSensitivity, usePressure);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(prevMidPoint.x, prevMidPoint.y);
  ctx.stroke();

  // Segments with dynamic width
  for (let i = 1; i < points.length - 1; i++) {
    const pCurrent = points[i];
    const pNext = points[i + 1];
    const midPoint = getMidPoint(pCurrent, pNext);

    const taperFactor = calculateTaper(i, points.length, isTapered);
    const avgPressure = ((pCurrent.pressure || 0.5) + (pNext.pressure || 0.5)) / 2;
    ctx.lineWidth = calculateNibWidth(nibType, width, avgPressure, taperFactor, pressureSensitivity, usePressure);

    ctx.beginPath();
    ctx.moveTo(prevMidPoint.x, prevMidPoint.y);
    ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, midPoint.x, midPoint.y);
    ctx.stroke();

    prevMidPoint = midPoint;
  }

  // Final tail line (sharp needle end)
  const lastIndex = points.length - 1;
  const endTaper = calculateTaper(lastIndex, points.length, isTapered);
  ctx.lineWidth = calculateNibWidth(nibType, width, points[lastIndex].pressure || 0.3, endTaper, pressureSensitivity, usePressure);
  ctx.beginPath();
  ctx.moveTo(prevMidPoint.x, prevMidPoint.y);
  ctx.lineTo(points[lastIndex].x, points[lastIndex].y);
  ctx.stroke();

  ctx.restore();
};

/**
 * Render all strokes on static canvas
 */
export const renderAllStrokes = (ctx, strokes, scale = 1.0) => {
  ctx.save();
  if (scale !== 1.0) {
    ctx.scale(scale, scale);
  }
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
  ctx.restore();
};

/**
 * Distance from point to line segment
 */
export const distToSegment = (p, v, w) => {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
};

/**
 * Whole Stroke Eraser: Check if a stroke intersects with an eraser point
 */
export const isStrokeHitByEraser = (stroke, eraserPoint, eraserRadius = 16) => {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;

  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(eraserPoint, pts[i], pts[i + 1]);
    if (d <= eraserRadius + (stroke.width || 2) / 2) {
      return true;
    }
  }
  return false;
};

/**
 * Precision Eraser (ลบเฉพาะส่วนที่สัมผัส): Cuts and splits strokes at contact points
 */
export const eraseStrokesPrecision = (strokes, eraserPoint, radius = 18) => {
  const resultStrokes = [];

  for (const stroke of strokes) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) continue;

    const segments = [];
    let currentSegment = [];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const dist = Math.hypot(p.x - eraserPoint.x, p.y - eraserPoint.y);

      if (dist > radius + (stroke.width || 2) / 2) {
        currentSegment.push(p);
      } else {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    for (const seg of segments) {
      if (seg.length > 0) {
        resultStrokes.push({
          ...stroke,
          points: seg
        });
      }
    }
  }

  return resultStrokes;
};

/**
 * Line Segment Intersection Helper (CCW Algorithm)
 */
const segmentsIntersect = (a1, a2, b1, b2) => {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return (ccw(a1, b1, b2) !== ccw(a2, b1, b2)) && (ccw(a1, a2, b1) !== ccw(a1, a2, b2));
};

/**
 * Checks if a scribble stroke directly intersects/crosses any segment of an existing stroke.
 */
const strokeIntersectsPath = (strokePts, scribblePts) => {
  if (!strokePts || strokePts.length < 2 || !scribblePts || scribblePts.length < 2) return false;
  const stepStroke = Math.max(1, Math.floor(strokePts.length / 50));
  const stepScribble = Math.max(1, Math.floor(scribblePts.length / 50));
  for (let i = 0; i < strokePts.length - 1; i += stepStroke) {
    const s1 = strokePts[i];
    const s2 = strokePts[Math.min(strokePts.length - 1, i + stepStroke)];
    for (let j = 0; j < scribblePts.length - 1; j += stepScribble) {
      const p1 = scribblePts[j];
      const p2 = scribblePts[Math.min(scribblePts.length - 1, j + stepScribble)];
      if (segmentsIntersect(s1, s2, p1, p2)) return true;
    }
  }
  return false;
};

/**
 * High-Precision Scribble-to-Erase Detection:
 * - Accurately detects natural human back-and-forth scratching (>= 2 reversals, condensed in a compact area)
 * - Supports wide cross-outs up to 1,600px across full titles and handwritten sentences
 * - Safe against normal handwriting & Thai script loops via sweep span & aspect ratio checks
 * - Erases strokes directly under/crossed by the scribble, while preserving adjacent neighbor characters
 */
export const detectScribble = (points, existingStrokes = [], enabled = true) => {
  if (!enabled || !points || points.length < 6) return false;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let pathLength = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.hypot(width, height);

  // Maximum dimension for a scribble gesture (supports wide sentences up to 1600px)
  if (width > 1600 || height > 1200 || diag < 8) return false;

  // Path density check: Scribbles concentrate path length in a compact area
  const pathDensity = pathLength / Math.max(1, diag);
  if (pathDensity < 1.18) return false;

  // Net displacement check: handwriting moves across the page; scribbles stay condensed
  const netDisp = Math.hypot(
    points[points.length - 1].x - points[0].x,
    points[points.length - 1].y - points[0].y
  );
  if (netDisp / Math.max(1, pathLength) > 0.70) return false;

  // Track significant sweep reversals in X
  const minSweepX = Math.max(10, Math.min(45, width * 0.35));
  let xReversals = 0;
  let currentDirX = 0;
  let currentStartX = points[0].x;

  for (let i = 1; i < points.length; i++) {
    const currentSpan = points[i].x - currentStartX;
    if (Math.abs(currentSpan) >= minSweepX) {
      const dir = Math.sign(currentSpan);
      if (currentDirX !== 0 && dir !== currentDirX) {
        xReversals++;
      }
      currentDirX = dir;
      currentStartX = points[i].x;
    }
  }

  // Track significant sweep reversals in Y
  const minSweepY = Math.max(10, Math.min(45, height * 0.35));
  let yReversals = 0;
  let currentDirY = 0;
  let currentStartY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const currentSpan = points[i].y - currentStartY;
    if (Math.abs(currentSpan) >= minSweepY) {
      const dir = Math.sign(currentSpan);
      if (currentDirY !== 0 && dir !== currentDirY) {
        yReversals++;
      }
      currentDirY = dir;
      currentStartY = points[i].y;
    }
  }

  // Check orientation: Horizontal/Diagonal scratching vs pure vertical scratching
  const isHorizontalOrDiagonal = width >= height * 0.45;
  const isZigzag = isHorizontalOrDiagonal 
    ? (xReversals >= 2 || (xReversals >= 1 && yReversals >= 1 && pathDensity >= 1.35)) 
    : (yReversals >= 2);

  if (!isZigzag) return false;

  const coreBox = { minX, maxX, minY, maxY };
  const bbox = {
    minX: minX - 6,
    maxX: maxX + 6,
    minY: minY - 6,
    maxY: maxY + 6
  };

  if (existingStrokes && existingStrokes.length > 0) {
    const remaining = eraseStrokesInBBox(existingStrokes, bbox, coreBox, points);
    const hitCount = existingStrokes.length - remaining.length;

    if (hitCount > 0) {
      return {
        isScribble: true,
        bbox,
        remainingStrokes: remaining,
        hitCount
      };
    }
  }

  return false;
};

export const eraseStrokesInBBox = (strokes, bbox, coreBox = bbox, scribblePoints = null) => {
  return strokes.filter(stroke => {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return true;

    // Fast bounding box check of stroke vs scribble bbox
    let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
    let hitCount = 0;
    let coreHitCount = 0;

    for (const p of pts) {
      if (p.x < sMinX) sMinX = p.x;
      if (p.x > sMaxX) sMaxX = p.x;
      if (p.y < sMinY) sMinY = p.y;
      if (p.y > sMaxY) sMaxY = p.y;

      if (p.x >= bbox.minX && p.x <= bbox.maxX && p.y >= bbox.minY && p.y <= bbox.maxY) {
        hitCount++;
        if (p.x >= coreBox.minX && p.x <= coreBox.maxX && p.y >= coreBox.minY && p.y <= coreBox.maxY) {
          coreHitCount++;
        }
      }
    }

    // Completely outside the expanded scribble area
    if (sMaxX < bbox.minX || sMinX > bbox.maxX || sMaxY < bbox.minY || sMinY > bbox.maxY) {
      return true;
    }

    const ratio = hitCount / pts.length;
    const intersects = scribblePoints ? strokeIntersectsPath(pts, scribblePoints) : false;

    // Fast proximity check: did scribble ink touch within 14px of stroke points?
    let hasClosePoint = false;
    if (scribblePoints && scribblePoints.length > 0 && hitCount > 0) {
      const sampleStep = Math.max(1, Math.floor(pts.length / 15));
      const scribStep = Math.max(1, Math.floor(scribblePoints.length / 15));
      for (let i = 0; i < pts.length; i += sampleStep) {
        for (let j = 0; j < scribblePoints.length; j += scribStep) {
          if (Math.hypot(pts[i].x - scribblePoints[j].x, pts[i].y - scribblePoints[j].y) <= 14) {
            hasClosePoint = true;
            break;
          }
        }
        if (hasClosePoint) break;
      }
    }

    // Targeted stroke: directly crossed by scribble lines, has close proximity, or core points
    const isTargeted = (
      intersects ||
      hasClosePoint ||
      (coreHitCount >= 1) ||
      (hitCount >= 2 && ratio >= 0.15)
    );

    return !isTargeted;
  });
};

// ============================================================================
// STATE-OF-THE-ART GEOMETRIC SHAPE CLASSIFICATION & GENERATION ENGINE
// Multi-Stage Recognition: Line with Angle Snapping, Rectangle/Square,
// Circle/Ellipse, Triangle, and Arrow
// ============================================================================

/**
 * Resample stroke points with uniform arc-length distance
 */
export const resampleStrokeUniformly = (points, stepDist = 8) => {
  if (!points || points.length <= 1) return points ? [...points] : [];
  
  const resampled = [points[0]];
  let accumDist = 0;
  
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    
    if (accumDist + d >= stepDist) {
      const remaining = stepDist - accumDist;
      const ratio = remaining / d;
      const nx = p1.x + (p2.x - p1.x) * ratio;
      const ny = p1.y + (p2.y - p1.y) * ratio;
      const np = { x: nx, y: ny, pressure: p2.pressure ?? 0.5 };
      resampled.push(np);
      accumDist = d - remaining;
    } else {
      accumDist += d;
    }
  }
  
  // Ensure the final point is included
  const last = points[points.length - 1];
  if (Math.hypot(last.x - resampled[resampled.length - 1].x, last.y - resampled[resampled.length - 1].y) > 2) {
    resampled.push(last);
  }
  
  return resampled;
};

/**
 * Douglas-Peucker Polyline Simplification Algorithm
 */
export const simplifyDouglasPeucker = (points, tolerance = 10) => {
  if (!points || points.length <= 2) return points ? [...points] : [];

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyDouglasPeucker(points.slice(0, index + 1), tolerance);
    const right = simplifyDouglasPeucker(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
};

/**
 * Snap angle to nearest cardinal / diagonal angle if within threshold
 */
export const snapAngle = (angleRad, snapThresholdDeg = 6) => {
  const angleDeg = (angleRad * 180) / Math.PI;
  const snapTargets = [0, 30, 45, 60, 90, 120, 135, 150, 180, -30, -45, -60, -90, -120, -135, -150, -180];
  
  for (const target of snapTargets) {
    let diff = Math.abs(angleDeg - target);
    if (diff > 180) diff = 360 - diff;
    if (diff <= snapThresholdDeg) {
      return (target * Math.PI) / 180;
    }
  }
  return angleRad;
};

/**
 * High-Precision Geometric Shape Classifier
 * Returns { type, startPt, endPt, points, label, ...metadata } or null
 */
export const classifyGeometricShape = (rawPoints) => {
  if (!rawPoints || rawPoints.length < 5) return null;

  const startPt = rawPoints[0];
  const endPt = rawPoints[rawPoints.length - 1];

  // 1. Calculate bounding box and path length
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let pathLength = 0;

  for (let i = 0; i < rawPoints.length; i++) {
    const p = rawPoints[i];
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    if (i > 0) {
      pathLength += Math.hypot(p.x - rawPoints[i - 1].x, p.y - rawPoints[i - 1].y);
    }
  }

  const bboxW = Math.max(10, maxX - minX);
  const bboxH = Math.max(10, maxY - minY);
  const bboxDiag = Math.hypot(bboxW, bboxH);
  const directDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);

  // 2. CHECK: Straight Line (เส้นตรง)
  // If direct distance from start to end covers >= 84% of total drawn path
  if (pathLength > 18 && directDist / pathLength >= 0.84) {
    const rawAngle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
    const snapped = snapAngle(rawAngle, 8);
    const snappedEnd = {
      x: startPt.x + directDist * Math.cos(snapped),
      y: startPt.y + directDist * Math.sin(snapped)
    };

    return {
      type: 'line',
      label: 'เส้นตรง',
      startPt: { x: startPt.x, y: startPt.y },
      endPt: snappedEnd,
      bbox: { minX: Math.min(startPt.x, snappedEnd.x), maxX: Math.max(startPt.x, snappedEnd.x), minY: Math.min(startPt.y, snappedEnd.y), maxY: Math.max(startPt.y, snappedEnd.y) }
    };
  }

  // CHECK: ARROW (Open stroke with shaft and sharp tip/wings at end)
  const isClosed = directDist <= Math.max(50, bboxDiag * 0.35);
  if (!isClosed && pathLength >= 45) {
    const resampledOpen = resampleStrokeUniformly(rawPoints, Math.max(5, pathLength / 30));
    const simpOpen = simplifyDouglasPeucker(resampledOpen, Math.max(5, pathLength * 0.05));
    if (simpOpen.length >= 3 && simpOpen.length <= 6) {
      let maxSegLen = 0;
      let maxSegIdx = 0;
      for (let i = 0; i < simpOpen.length - 1; i++) {
        const segLen = Math.hypot(simpOpen[i+1].x - simpOpen[i].x, simpOpen[i+1].y - simpOpen[i].y);
        if (segLen > maxSegLen) {
          maxSegLen = segLen;
          maxSegIdx = i;
        }
      }
      if (maxSegLen >= pathLength * 0.50 && maxSegIdx === 0) {
        const shaftStart = simpOpen[0];
        const shaftEnd = simpOpen[1];
        const angle = Math.atan2(shaftEnd.y - shaftStart.y, shaftEnd.x - shaftStart.x);
        const snappedAngle = snapAngle(angle, 15);
        const shaftDist = Math.hypot(shaftEnd.x - shaftStart.x, shaftEnd.y - shaftStart.y);
        const snappedEnd = {
          x: shaftStart.x + Math.cos(snappedAngle) * shaftDist,
          y: shaftStart.y + Math.sin(snappedAngle) * shaftDist
        };

        return {
          type: 'arrow',
          label: 'ลูกศร',
          startPt: shaftStart,
          endPt: snappedEnd,
          angle: snappedAngle,
          bbox: {
            minX: Math.min(shaftStart.x, snappedEnd.x),
            maxX: Math.max(shaftStart.x, snappedEnd.x),
            minY: Math.min(shaftStart.y, snappedEnd.y),
            maxY: Math.max(shaftStart.y, snappedEnd.y)
          }
        };
      }
    }
  }

  // CHECK: POLYLINE / CONTINUOUS CONNECTED STRAIGHT LINES (เส้นตรงต่อเนื่อง)
  // When the stroke is an open path with 2 or more connected straight segments
  if (!isClosed && pathLength >= 35) {
    const resampPoly = resampleStrokeUniformly(rawPoints, Math.max(5, pathLength / 40));
    const simpPoly = simplifyDouglasPeucker(resampPoly, Math.max(6, bboxDiag * 0.045));

    if (simpPoly.length >= 3 && simpPoly.length <= 10) {
      let totalChordLen = 0;
      for (let i = 0; i < simpPoly.length - 1; i++) {
        totalChordLen += Math.hypot(simpPoly[i+1].x - simpPoly[i].x, simpPoly[i+1].y - simpPoly[i].y);
      }

      // If sum of simplified chords covers >= 84% of total hand-drawn path, each segment is straight!
      if (totalChordLen / pathLength >= 0.84) {
        // Optional snap: snap segments close to horizontal or vertical (within 7°)
        const snappedVerts = simpPoly.map((pt, idx) => {
          if (idx === 0) return { ...pt };
          const prev = simpPoly[idx - 1];
          const ang = Math.atan2(pt.y - prev.y, pt.x - prev.x);
          const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
          const snappedAng = snapAngle(ang, 8);
          // If angle was snapped to a cardinal/45 direction, apply snap
          if (Math.abs(snappedAng - ang) < 0.14) {
            return {
              x: prev.x + Math.cos(snappedAng) * dist,
              y: prev.y + Math.sin(snappedAng) * dist
            };
          }
          return { ...pt };
        });

        return {
          type: 'polyline',
          label: 'เส้นตรงต่อเนื่อง',
          startPt: snappedVerts[0],
          endPt: snappedVerts[snappedVerts.length - 1],
          vertices: snappedVerts,
          bbox: { minX, maxX, minY, maxY }
        };
      }
    }
  }

  // 3. CHECK: Closed shape check
  // Distance between start and end point must be relatively small (< 35% of diagonal or < 55px)
  if (!isClosed || bboxW < 20 || bboxH < 20) {
    return null;
  }

  // 4. Uniformly resample points for angular & polygonal analysis
  const resampled = resampleStrokeUniformly(rawPoints, Math.max(6, bboxDiag / 35));
  if (resampled.length < 8) return null;

  // 5. Douglas-Peucker Simplification to find corners
  const dpTolerance = Math.max(7, bboxDiag * 0.045);
  const simplified = simplifyDouglasPeucker(resampled, dpTolerance);

  // Corner angle deflection analysis on simplified vertices
  const corners = [];
  for (let i = 1; i < simplified.length - 1; i++) {
    const pPrev = simplified[i - 1];
    const pCur = simplified[i];
    const pNext = simplified[i + 1];

    const a1 = Math.atan2(pCur.y - pPrev.y, pCur.x - pPrev.x);
    const a2 = Math.atan2(pNext.y - pCur.y, pNext.x - pCur.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;

    // A polygon corner has a significant direction change (between 45° and 140°)
    if (diff >= 0.78 && diff <= 2.45) {
      corners.push(pCur);
    }
  }

  const cornerCount = corners.length;
  const simplifiedVerts = Math.max(0, simplified.length - 1);

  // 6. Perimeter Adherence Ratio (Crucial for Rectangle / Square)
  const borderTol = Math.max(6, Math.min(bboxW, bboxH) * 0.18);
  let onPerimeterCount = 0;
  for (const p of rawPoints) {
    const nearX = Math.abs(p.x - minX) <= borderTol || Math.abs(p.x - maxX) <= borderTol;
    const nearY = Math.abs(p.y - minY) <= borderTol || Math.abs(p.y - maxY) <= borderTol;
    if (nearX || nearY) onPerimeterCount++;
  }
  const perimeterRatio = onPerimeterCount / rawPoints.length;

  // 7. Shoelace Polygon Area
  let polygonArea = 0;
  for (let i = 0; i < rawPoints.length - 1; i++) {
    polygonArea += (rawPoints[i].x * rawPoints[i + 1].y - rawPoints[i + 1].x * rawPoints[i].y);
  }
  polygonArea = Math.abs(polygonArea) / 2;
  const bboxArea = bboxW * bboxH;
  const areaRatio = bboxArea > 0 ? polygonArea / bboxArea : 0;

  // 8. Elliptical / Circular Radial Variance
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const rx = bboxW / 2;
  const ry = bboxH / 2;
  let radialErrorSum = 0;
  for (const p of rawPoints) {
    const normDist = Math.hypot((p.x - center.x) / rx, (p.y - center.y) / ry);
    radialErrorSum += Math.abs(normDist - 1.0);
  }
  const avgRadialError = radialErrorSum / rawPoints.length;

  // =========================================================================
  // MULTI-STAGE CLASSIFIER DECISION TREE
  // =========================================================================

  // DECISION 1: CIRCLE / ELLIPSE (วงกลม / วงรี)
  // Mathematically guaranteed: ONLY a circle/ellipse has avgRadialError < 0.115!
  // (A square has avgRadialError ~0.182, rectangle >0.15, triangle >0.25)
  if (avgRadialError < 0.115 && areaRatio >= 0.55 && areaRatio <= 0.95) {
    const isCircle = Math.abs(rx - ry) / Math.max(rx, ry) < 0.20;
    let finalRx = rx;
    let finalRy = ry;

    if (isCircle) {
      const avgR = (rx + ry) / 2;
      finalRx = avgR;
      finalRy = avgR;
    }

    return {
      type: isCircle ? 'circle' : 'ellipse',
      label: isCircle ? 'วงกลม' : 'วงรี',
      startPt: { x: center.x - finalRx, y: center.y - finalRy },
      endPt: { x: center.x + finalRx, y: center.y + finalRy },
      center,
      rx: finalRx,
      ry: finalRy
    };
  }

  // DECISION 2: TRIANGLE (สามเหลี่ยม)
  // 3 distinct corners or area ratio in typical triangle range (0.28 - 0.65) with radial error >= 0.10
  if (avgRadialError >= 0.10 && ((cornerCount === 3 && areaRatio <= 0.68) || (simplifiedVerts === 3) || (areaRatio >= 0.28 && areaRatio <= 0.65))) {
    let triVertices = null;
    if (corners.length === 3) {
      triVertices = [corners[0], corners[1], corners[2], corners[0]];
    } else if (simplified.length === 4) {
      triVertices = [...simplified];
    } else {
      triVertices = [
        { x: (minX + maxX) / 2, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: (minX + maxX) / 2, y: minY }
      ];
    }

    return {
      type: 'triangle',
      label: 'สามเหลี่ยม',
      startPt: { x: minX, y: minY },
      endPt: { x: maxX, y: maxY },
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      vertices: triVertices,
      width: bboxW,
      height: bboxH
    };
  }

  // DECISION 3: RECTANGLE / SQUARE (สี่เหลี่ยม)
  const isRect = (cornerCount >= 3 && areaRatio >= 0.60) || 
                 (perimeterRatio >= 0.54 && areaRatio >= 0.60) || 
                 (simplifiedVerts >= 4 && simplifiedVerts <= 6 && areaRatio >= 0.64);

  if (avgRadialError >= 0.10 && (isRect || areaRatio >= 0.66)) {
    const isSquare = Math.abs(bboxW - bboxH) / Math.max(bboxW, bboxH) < 0.18;
    let finalW = bboxW;
    let finalH = bboxH;
    let finalMinX = minX;
    let finalMinY = minY;

    if (isSquare) {
      const side = (bboxW + bboxH) / 2;
      finalW = side;
      finalH = side;
      finalMinX = center.x - side / 2;
      finalMinY = center.y - side / 2;
    }

    return {
      type: isSquare ? 'square' : 'rectangle',
      label: isSquare ? 'สี่เหลี่ยมจัตุรัส' : 'สี่เหลี่ยมผืนผ้า',
      startPt: { x: finalMinX, y: finalMinY },
      endPt: { x: finalMinX + finalW, y: finalMinY + finalH },
      width: finalW,
      height: finalH,
      center: { x: finalMinX + finalW / 2, y: finalMinY + finalH / 2 }
    };
  }

  return null;
};

/**
 * Generate high-fidelity vector points for recognized or drafted shapes
 * Ready to be committed directly to the BetterNote inking strokes model
 */
export const generateVectorShapePoints = (shapeInfo, nibType = 'fountain') => {
  if (!shapeInfo) return [];
  const { type, startPt, endPt, center, rx, ry, width, height } = shapeInfo;
  const pts = [];

  if (type === 'line') {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: startPt.x + (endPt.x - startPt.x) * t,
        y: startPt.y + (endPt.y - startPt.y) * t,
        pressure: 0.5
      });
    }
  } else if (type === 'rectangle' || type === 'square') {
    const x0 = Math.min(startPt.x, endPt.x);
    const y0 = Math.min(startPt.y, endPt.y);
    const x1 = Math.max(startPt.x, endPt.x);
    const y1 = Math.max(startPt.y, endPt.y);

    const corners = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 }
    ];

    for (let c = 0; c < 4; c++) {
      const c1 = corners[c];
      const c2 = corners[c + 1];
      const segSteps = 8;
      for (let s = 0; s < segSteps; s++) {
        const t = s / segSteps;
        pts.push({
          x: c1.x + (c2.x - c1.x) * t,
          y: c1.y + (c2.y - c1.y) * t,
          pressure: 0.5
        });
      }
    }
    pts.push({ x: corners[0].x, y: corners[0].y, pressure: 0.5 });
  } else if (type === 'circle' || type === 'ellipse') {
    const cx = center ? center.x : (startPt.x + endPt.x) / 2;
    const cy = center ? center.y : (startPt.y + endPt.y) / 2;
    const radX = rx ?? Math.abs(endPt.x - startPt.x) / 2;
    const radY = ry ?? Math.abs(endPt.y - startPt.y) / 2;
    const steps = 48;

    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      pts.push({
        x: cx + radX * Math.cos(theta),
        y: cy + radY * Math.sin(theta),
        pressure: 0.5
      });
    }
  } else if (type === 'triangle') {
    const vertices = (shapeInfo.vertices && shapeInfo.vertices.length >= 3)
      ? shapeInfo.vertices
      : [
          { x: (Math.min(startPt.x, endPt.x) + Math.max(startPt.x, endPt.x)) / 2, y: Math.min(startPt.y, endPt.y) },
          { x: Math.max(startPt.x, endPt.x), y: Math.max(startPt.y, endPt.y) },
          { x: Math.min(startPt.x, endPt.x), y: Math.max(startPt.y, endPt.y) },
          { x: (Math.min(startPt.x, endPt.x) + Math.max(startPt.x, endPt.x)) / 2, y: Math.min(startPt.y, endPt.y) }
        ];

    for (let v = 0; v < vertices.length - 1; v++) {
      const v1 = vertices[v];
      const v2 = vertices[v + 1];
      const segSteps = 8;
      for (let s = 0; s < segSteps; s++) {
        const t = s / segSteps;
        pts.push({
          x: v1.x + (v2.x - v1.x) * t,
          y: v1.y + (v2.y - v1.y) * t,
          pressure: 0.5
        });
      }
    }
    pts.push({ x: vertices[vertices.length - 1].x, y: vertices[vertices.length - 1].y, pressure: 0.5 });
  } else if (type === 'polyline' && shapeInfo.vertices && shapeInfo.vertices.length >= 2) {
    const verts = shapeInfo.vertices;
    for (let i = 0; i < verts.length - 1; i++) {
      const v1 = verts[i];
      const v2 = verts[i + 1];
      const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
      const segSteps = Math.max(3, Math.round(segLen / 6));
      for (let s = 0; s < segSteps; s++) {
        const t = s / segSteps;
        pts.push({
          x: v1.x + (v2.x - v1.x) * t,
          y: v1.y + (v2.y - v1.y) * t,
          pressure: 0.5
        });
      }
    }
    pts.push({ x: verts[verts.length - 1].x, y: verts[verts.length - 1].y, pressure: 0.5 });
  } else if (type === 'arrow') {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: startPt.x + (endPt.x - startPt.x) * t,
        y: startPt.y + (endPt.y - startPt.y) * t,
        pressure: 0.5
      });
    }
    const angle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
    const headLen = 16;
    pts.push({
      x: endPt.x - headLen * Math.cos(angle - Math.PI / 6),
      y: endPt.y - headLen * Math.sin(angle - Math.PI / 6),
      pressure: 0.5
    });
    pts.push({ x: endPt.x, y: endPt.y, pressure: 0.5 });
    pts.push({
      x: endPt.x - headLen * Math.cos(angle + Math.PI / 6),
      y: endPt.y - headLen * Math.sin(angle + Math.PI / 6),
      pressure: 0.5
    });
  }

  return pts;
};

/**
 * Render Shape Live Preview on Canvas
 */
export const renderShapePreview = (ctx, shapeInfo, color = '#2563eb', width = 3) => {
  if (!ctx || !shapeInfo) return;
  const { type, startPt, endPt, center, rx, ry } = shapeInfo;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  if (type === 'line') {
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
  } else if (type === 'rectangle' || type === 'square') {
    const x = Math.min(startPt.x, endPt.x);
    const y = Math.min(startPt.y, endPt.y);
    const w = Math.abs(endPt.x - startPt.x);
    const h = Math.abs(endPt.y - startPt.y);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  } else if (type === 'circle' || type === 'ellipse') {
    const cx = center ? center.x : (startPt.x + endPt.x) / 2;
    const cy = center ? center.y : (startPt.y + endPt.y) / 2;
    const radX = rx ?? Math.abs(endPt.x - startPt.x) / 2;
    const radY = ry ?? Math.abs(endPt.y - startPt.y) / 2;
    ctx.ellipse(cx, cy, Math.max(1, radX), Math.max(1, radY), 0, 0, Math.PI * 2);
  } else if (type === 'triangle') {
    if (shapeInfo.vertices && shapeInfo.vertices.length >= 3) {
      const v = shapeInfo.vertices;
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) {
        ctx.lineTo(v[i].x, v[i].y);
      }
      ctx.closePath();
    } else {
      const x0 = Math.min(startPt.x, endPt.x);
      const y0 = Math.min(startPt.y, endPt.y);
      const x1 = Math.max(startPt.x, endPt.x);
      const y1 = Math.max(startPt.y, endPt.y);
      ctx.moveTo((x0 + x1) / 2, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.closePath();
    }
  } else if (type === 'polyline' && shapeInfo.vertices && shapeInfo.vertices.length >= 2) {
    const v = shapeInfo.vertices;
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) {
      ctx.lineTo(v[i].x, v[i].y);
    }
  } else if (type === 'arrow') {
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();

    const angle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
    const headLen = Math.max(14, width * 3.5);
    ctx.beginPath();
    ctx.moveTo(endPt.x, endPt.y);
    ctx.lineTo(
      endPt.x - headLen * Math.cos(angle - Math.PI / 6),
      endPt.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endPt.x, endPt.y);
    ctx.lineTo(
      endPt.x - headLen * Math.cos(angle + Math.PI / 6),
      endPt.y - headLen * Math.sin(angle + Math.PI / 6)
    );
  }

  ctx.stroke();
  ctx.restore();
};

// ============================================================================
// LASSO SELECTION ENGINE
// Ray-Casting & Segment Intersection with Bounding Box Acceleration
// ============================================================================

/**
 * Standard Ray-Casting algorithm to test if a point is inside a polygon
 */
export const isPointInPolygon = (point, polygon) => {
  if (!point || !polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Check if two line segments (p1-p2) and (p3-p4) intersect
 */
export const doSegmentsIntersect = (p1, p2, p3, p4) => {
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
};

/**
 * Comprehensive Lasso Hit-Testing:
 * 1. Bounding-box pre-check for instant $O(1)$ rejection
 * 2. Point-in-polygon check for stroke points
 * 3. Boundary crossing check for long strokes passing through the loop
 */
export const isStrokeSelectedByLasso = (stroke, loopPoints, loopBbox) => {
  if (!stroke || !stroke.points || stroke.points.length === 0) return false;
  if (!loopPoints || loopPoints.length < 3) return false;
  
  const strokeBounds = getStrokeBounds(stroke);
  const bbox = loopBbox || getStrokeBounds({ points: loopPoints });
  
  // 1. Fast rejection if bounding boxes do not overlap at all
  if (
    strokeBounds.maxX < bbox.minX ||
    strokeBounds.minX > bbox.maxX ||
    strokeBounds.maxY < bbox.minY ||
    strokeBounds.minY > bbox.maxY
  ) {
    return false;
  }

  // 2. Check if stroke center or any sample point is inside polygon
  if (isPointInPolygon({ x: strokeBounds.centerX, y: strokeBounds.centerY }, loopPoints)) {
    return true;
  }

  // Sample every few points for performance on long paths
  const step = Math.max(1, Math.floor(stroke.points.length / 24));
  for (let i = 0; i < stroke.points.length; i += step) {
    if (isPointInPolygon(stroke.points[i], loopPoints)) {
      return true;
    }
  }

  // Also check first and last point
  if (isPointInPolygon(stroke.points[0], loopPoints) || 
      isPointInPolygon(stroke.points[stroke.points.length - 1], loopPoints)) {
    return true;
  }

  // 3. For straight lines or sparse strokes, check if segment intersects any lasso polygon edge
  const loopLen = loopPoints.length;
  for (let i = 0; i < stroke.points.length - 1; i += step) {
    const sp1 = stroke.points[i];
    const sp2 = stroke.points[Math.min(stroke.points.length - 1, i + step)];
    for (let j = 0; j < loopLen; j++) {
      const lp1 = loopPoints[j];
      const lp2 = loopPoints[(j + 1) % loopLen];
      if (doSegmentsIntersect(sp1, sp2, lp1, lp2)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Compute bounding box for a stroke
 */
export const getStrokeBounds = (stroke) => {
  if (!stroke || !stroke.points || stroke.points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
};

/**
 * Transform strokes (move by dx/dy, scale around anchor, or recolor)
 */
export const transformStroke = (stroke, optsOrDx = 0, dy = 0, scale = 1, origin = null, newColor = null) => {
  if (!stroke) return stroke;

  let dxVal = 0, dyVal = 0, scaleVal = 1, originVal = null, colorVal = null;
  if (typeof optsOrDx === 'object' && optsOrDx !== null) {
    dxVal = optsOrDx.dx || 0;
    dyVal = optsOrDx.dy || 0;
    scaleVal = optsOrDx.scale ?? 1;
    originVal = optsOrDx.origin || (optsOrDx.originX !== undefined ? { x: optsOrDx.originX, y: optsOrDx.originY } : null);
    colorVal = optsOrDx.newColor || null;
  } else {
    dxVal = optsOrDx;
    dyVal = dy;
    scaleVal = scale;
    originVal = origin;
    colorVal = newColor;
  }

  const newStroke = {
    ...stroke,
    color: colorVal || stroke.color,
    width: (stroke.width || 2) * scaleVal,
    points: (stroke.points || []).map(p => {
      let x = p.x;
      let y = p.y;
      if (scaleVal !== 1 && originVal) {
        x = originVal.x + (x - originVal.x) * scaleVal;
        y = originVal.y + (y - originVal.y) * scaleVal;
      }
      return {
        ...p,
        x: x + dxVal,
        y: y + dyVal
      };
    })
  };
  return newStroke;
};


