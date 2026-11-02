import { get, patch } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { LatestRequest } from '../lib/read-coordinator.js';

/** Completed Milestones are 100% even when they have no finite Task denominator. */
export function milestoneProgress(milestone) {
    if (milestone.status === 'Completed') return 100;
    const value = Number(milestone.progress?.percentage);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

/** Independent reads keep a late Dashboard refresh from undoing a newer choice. */
export function initDashboardRoadmap(root, onError) {
    const select = root.querySelector('[data-dashboard-roadmap-select]');
    const preview = root.querySelector('[data-dashboard-roadmap]');
    const link = root.querySelector('[data-dashboard-roadmap-link]');
    const reads = new LatestRequest();
    let savedId = null;
    let revision = 0;
    let saving = false;

    const resetLink = () => {
        link.href = '/goals';
        link.textContent = t('View goals →');
    };
    const render = async (goalId) => {
        const ticket = reads.begin();
        select.disabled = true;
        preview.setAttribute('aria-busy', 'true');
        preview.textContent = t('Loading roadmap…');
        resetLink();
        try {
            const goals = (await get('/api/v1/goals', { signal: ticket.signal })).payload.data;
            if (!reads.isCurrent(ticket)) return;
            const byId = new Map(goals.map((goal) => [goal.id, goal]));
            select.replaceChildren(new Option(t('Choose a roadmap'), ''));
            for (const goal of goals
                .slice()
                .sort(
                    (left, right) =>
                        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
                )) {
                const parent = byId.get(goal.parent_goal_id);
                select.add(new Option(`${parent ? `${parent.name} › ` : ''}${goal.name}`, goal.id));
            }
            const goal = byId.get(goalId);
            savedId = goal?.id || null;
            select.value = savedId || '';
            if (!goal) {
                preview.textContent = t(
                    goals.length
                        ? 'Choose a roadmap to display here.'
                        : 'Create a goal, then choose its roadmap here.',
                );
                return;
            }
            const roadmap = (
                await get(`/api/v1/goals/${encodeURIComponent(goal.id)}/roadmap`, {
                    signal: ticket.signal,
                })
            ).payload.data;
            if (!reads.isCurrent(ticket)) return;
            preview.replaceChildren();
            link.href = `/goals/${encodeURIComponent(goal.id)}`;
            link.textContent = t('View full roadmap →');
            for (const milestone of (roadmap.milestones || []).slice(0, 6)) {
                const branch = document.createElement('a');
                branch.href = `/goals/${encodeURIComponent(goal.id)}#milestone=${encodeURIComponent(milestone.id)}`;
                branch.textContent = milestone.name;
                const percent = milestoneProgress(milestone);
                branch.classList.toggle('is-complete', percent >= 100);
                branch.classList.toggle('is-active', percent > 0 && percent < 100);
                // The connector to the next node fills with this Milestone's progress.
                branch.style.setProperty('--segment-progress', `${percent}%`);
                branch.title = `${milestone.name} · ${Math.round(percent)}%`;
                preview.append(branch);
            }
            if (!preview.childNodes.length) {
                const goalLink = document.createElement('a');
                goalLink.href = link.href;
                goalLink.textContent = goal.name;
                preview.append(goalLink);
            }
        } catch (error) {
            if (reads.shouldIgnore(ticket, error)) return;
            preview.textContent = t('Roadmap unavailable. Open Goals or refresh to try again.');
            onError(error);
        } finally {
            if (reads.isCurrent(ticket)) {
                select.disabled = saving;
                preview.setAttribute('aria-busy', 'false');
            }
        }
    };
    select.addEventListener('change', async () => {
        if (saving) return;
        const goalId = select.value || null;
        const previous = savedId;
        revision++;
        reads.begin();
        saving = true;
        select.disabled = true;
        try {
            const response = await patch('/api/v1/dashboard/roadmap', { goal_id: goalId });
            savedId = response.payload.data.goal_id;
            await render(savedId);
        } catch (error) {
            select.value = previous || '';
            onError(error);
            // Refresh is explicit after an ambiguous failed write; never undo it with another write.
        } finally {
            saving = false;
            select.disabled = false;
        }
    });
    return {
        get revision() {
            return revision;
        },
        load(goalId, expectedRevision) {
            if (saving || revision !== expectedRevision) return;
            return render(goalId);
        },
    };
}
