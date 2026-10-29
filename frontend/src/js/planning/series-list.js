import { post } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { renderEmptyState } from '../lib/empty-state.js';

/** Renders repeating Task series with pause/resume/end controls. */
export function renderSeriesList(container, series, { today, reload, onError }) {
    container.replaceChildren();
    for (const item of series) {
        const row = document.createElement('article');
        row.className = 'planning-list-item planning-list-item-wrap';
        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = item.name;
        const meta = document.createElement('small');
        meta.textContent = `${t(item.state)} · ${t(item.frequency[0].toUpperCase() + item.frequency.slice(1))} · ${t('from')} ${item.start_date}${item.end_date ? ` ${t('to')} ${item.end_date}` : ''}${item.reminder_time ? ` · ${t('Reminder')} ${item.reminder_time.slice(0, 5)}` : ''}`;
        copy.append(name, meta);
        const actions = document.createElement('div');
        actions.className = 'action-row';
        if (item.state !== 'Ended') {
            const stateButton = document.createElement('button');
            stateButton.type = 'button';
            stateButton.className = 'button button-quiet';
            const action = item.state === 'Paused' ? 'resume' : 'pause';
            stateButton.textContent = action === 'resume' ? t('Resume') : t('Pause');
            stateButton.addEventListener('click', async () => {
                stateButton.disabled = true;
                try {
                    await post(`/api/v1/task-series/${item.id}/${action}`, {
                        base_version: item.version,
                    });
                    await reload();
                } catch (error) {
                    onError(error);
                } finally {
                    stateButton.disabled = false;
                }
            });
            const endButton = document.createElement('button');
            endButton.type = 'button';
            endButton.className = 'button button-quiet';
            endButton.textContent = t('End');
            endButton.addEventListener('click', async () => {
                if (
                    !window.confirm(
                        `${t('End')} “${item.name}”? ${t('Future occurrences that have not started are archived.')}`,
                    )
                )
                    return;
                endButton.disabled = true;
                try {
                    await post(`/api/v1/task-series/${item.id}/end`, {
                        base_version: item.version,
                        end_date: today,
                        archive_future: true,
                    });
                    await reload();
                } catch (error) {
                    onError(error);
                } finally {
                    endButton.disabled = false;
                }
            });
            actions.append(stateButton, endButton);
        }
        row.append(copy, actions);
        container.append(row);
    }
    if (!series.length)
        renderEmptyState(container, {
            title: 'Make room for a routine.',
            description:
                'Use the repeat button when creating a task to schedule it daily, weekly, monthly or yearly.',
            icon: 'calendar',
        });
}
