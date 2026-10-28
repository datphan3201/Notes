<?php if ($captureDescription ?? true): ?>
<div class="field">
    <label><?= $view->e($view->t('Description')) ?> <textarea name="description" rows="2" maxlength="10000" placeholder="<?= $view->e($view->t('Add details, links or context (optional)')) ?>"></textarea></label>
</div>
<?php endif; ?>
<div class="schedule-toolbar" data-schedule-toolbar role="group" aria-label="<?= $view->e($view->t('Schedule')) ?>">
    <button type="button" class="schedule-trigger" data-schedule-open="date" aria-label="<?= $view->e($view->t('Add due date')) ?>" title="<?= $view->e($view->t('Add due date')) ?>">
        <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span data-schedule-label="date"></span>
    </button>
    <button type="button" class="schedule-trigger" data-schedule-open="reminder" aria-label="<?= $view->e($view->t('Remind me')) ?>" title="<?= $view->e($view->t('Remind me')) ?>">
        <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9.5V13l2.5 1.5M5 4 3 6M19 4l2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span data-schedule-label="reminder"></span>
    </button>
    <button type="button" class="schedule-trigger" data-schedule-open="repeat" aria-label="<?= $view->e($view->t('Repeat')) ?>" title="<?= $view->e($view->t('Repeat')) ?>">
        <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span data-schedule-label="repeat"></span>
    </button>
    <input type="hidden" name="deadline">
    <input type="hidden" name="reminder_at">
    <input type="hidden" name="repeat_frequency">
    <input type="hidden" name="repeat_unit">
    <input type="hidden" name="repeat_interval" value="1">
    <input type="hidden" name="repeat_days">
    <input type="hidden" name="repeat_end">
</div>
<details class="capture-details">
    <summary><?= $view->e($view->t('More options')) ?></summary>
    <div class="field">
        <label><?= $view->e($view->t('Start date')) ?> <input type="date" name="start_date"></label>
        <small><?= $view->e($view->t('Repeating tasks start on this date, or today.')) ?></small>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Estimated minutes')) ?> <input type="number" name="estimated_minutes" min="1" max="1440"></label>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Importance')) ?> <select name="importance">
            <?php require __DIR__.'/importance-options.php'; ?>
        </select></label>
    </div>
</details>
