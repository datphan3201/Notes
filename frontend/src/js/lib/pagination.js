// Numbered pages to show for a 1-based `current` page out of `last`: always the first and last
// page plus `radius` pages on each side of the current one, with null where pages are skipped.
// A skip of exactly one page shows that page instead of a gap.
export function pageWindow(current, last, radius = 2) {
    if (last <= 1) return [];
    const page = Math.min(Math.max(1, current), last);
    const shown = new Set([1, last]);
    for (let candidate = page - radius; candidate <= page + radius; candidate += 1) {
        if (candidate >= 1 && candidate <= last) shown.add(candidate);
    }
    const result = [];
    let previous = null;
    for (const value of [...shown].sort((a, b) => a - b)) {
        if (previous !== null && value - previous === 2) result.push(previous + 1);
        else if (previous !== null && value - previous > 2) result.push(null);
        result.push(value);
        previous = value;
    }
    return result;
}
