// Küçük 2D daire fizik yardımcıları. Tüm çarpışma fonksiyonları çarpma hızını
// (ses ve efekt için) döndürür; çarpışma yoksa 0.

export function integrate(b, dt, gx = 0, gy = 0, damp = 0) {
  b.vx += gx * dt;
  b.vy += gy * dt;
  if (damp) {
    const f = Math.exp(-damp * dt);
    b.vx *= f;
    b.vy *= f;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

export function speed(b) {
  return Math.hypot(b.vx, b.vy);
}

export function capSpeed(b, max) {
  const s = Math.hypot(b.vx, b.vy);
  if (s > max) {
    b.vx *= max / s;
    b.vy *= max / s;
  }
  return s;
}

export function ensureSpeed(b, min) {
  const s = Math.hypot(b.vx, b.vy);
  if (s < min && s > 1e-6) {
    b.vx *= min / s;
    b.vy *= min / s;
  }
}

// İki hareketli daire (invMass alanı yoksa 1 kabul edilir).
export function collideBalls(a, b, e = 0.95) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const ima = a.invMass ?? 1;
  const imb = b.invMass ?? 1;
  const im = ima + imb;
  if (!im) return 0;
  const pen = rr - d;
  a.x -= (nx * pen * ima) / im;
  a.y -= (ny * pen * ima) / im;
  b.x += (nx * pen * imb) / im;
  b.y += (ny * pen * imb) / im;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return 0;
  const j = (-(1 + e) * vn) / im;
  a.vx -= j * nx * ima;
  a.vy -= j * ny * ima;
  b.vx += j * nx * imb;
  b.vy += j * ny * imb;
  return -vn;
}

// Sabit (veya kinematik, yüzey hızı svx/svy olan) daireye çarpma.
export function collideStatic(b, cx, cy, cr, e = 0.9, svx = 0, svy = 0) {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const rr = b.r + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  let d = Math.sqrt(d2);
  let nx, ny;
  if (d < 1e-6) {
    nx = 0;
    ny = -1;
    d = 0;
  } else {
    nx = dx / d;
    ny = dy / d;
  }
  b.x = cx + nx * rr;
  b.y = cy + ny * rr;
  const rvx = b.vx - svx;
  const rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * nx;
  b.vy -= (1 + e) * vn * ny;
  return -vn;
}

// Kalınlığı `thick` (yarıçap) olan doğru parçasına çarpma.
// `pivot` verilirse ({x, y, omega}) parça pivot etrafında dönüyor kabul edilir.
export function collideSegment(b, x1, y1, x2, y2, e = 0.9, thick = 0, pivot = null) {
  const ex = x2 - x1;
  const ey = y2 - y1;
  const l2 = ex * ex + ey * ey;
  let t = l2 ? ((b.x - x1) * ex + (b.y - y1) * ey) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = x1 + ex * t;
  const py = y1 + ey * t;
  let svx = 0;
  let svy = 0;
  if (pivot) {
    svx = -pivot.omega * (py - pivot.y);
    svy = pivot.omega * (px - pivot.x);
  }
  return collideStatic(b, px, py, thick, e, svx, svy);
}
