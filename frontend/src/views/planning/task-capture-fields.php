<details class="capture-details">
    <summary><?= $view->e($view->t('Description, dates and priority')) ?></summary>
    <div class="field">
        <label><?= $view->e($view->t('Description')) ?> <textarea name="description" rows="3" maxlength="10000"></textarea></label>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Start date')) ?> <input type="date" name="start_date"></label>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Due date')) ?> <input type="date" name="deadline"></label>
        <div class="action-row"><button type="button" class="button button-quiet" data-deadline-preset="0"><?= $view->e($view->t('Today')) ?></button><button type="button" class="button button-quiet" data-deadline-preset="1"><?= $view->e($view->t('Tomorrow')) ?></button><button type="button" class="button button-quiet" data-deadline-preset="week"><?= $view->e($view->t('Next week')) ?></button></div>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Estimated minutes')) ?> <input type="number" name="estimated_minutes" min="1" max="1440"></label>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Importance')) ?> <select name="importance">
            <option value="1"><?= $view->e($view->t('1 · Low')) ?></option>
            <option value="2">2</option>
            <option value="3" selected><?= $view->e($view->t('3 · Normal')) ?></option>
            <option value="4">4</option>
            <option value="5"><?= $view->e($view->t('5 · Important')) ?></option>
        </select></label>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Remind me')) ?> <input type="datetime-local" name="reminder_at"></label>
        <div class="action-row"><button type="button" class="button button-quiet" data-reminder-preset="later"><?= $view->e($view->t('Later today')) ?></button><button type="button" class="button button-quiet" data-reminder-preset="tomorrow"><?= $view->e($view->t('Tomorrow at 9')) ?></button><button type="button" class="button button-quiet" data-reminder-preset="week"><?= $view->e($view->t('Next week at 9')) ?></button></div>
        <small><?= $view->e($view->t('Uses your device time zone. For a repeating series, set reminders on individual occurrences after creation.')) ?></small>
    </div>
    <div class="field">
        <label><?= $view->e($view->t('Repeat')) ?> <select name="repeat_frequency">
            <option value=""><?= $view->e($view->t('Does not repeat')) ?></option>
            <option value="daily"><?= $view->e($view->t('Daily')) ?></option>
            <option value="weekdays"><?= $view->e($view->t('Weekdays')) ?></option>
            <option value="weekly"><?= $view->e($view->t('Weekly')) ?></option>
            <option value="monthly"><?= $view->e($view->t('Monthly')) ?></option>
            <option value="yearly"><?= $view->e($view->t('Yearly')) ?></option>
            <option value="custom"><?= $view->e($view->t('Custom weekly days')) ?></option>
        </select></label>
        <label><?= $view->e($view->t('Custom weekly days (1=Mon … 7=Sun)')) ?> <input name="repeat_days" placeholder="1,3,5" pattern="[1-7](,[1-7])*"></label>
        <label><?= $view->e($view->t('Every')) ?> <input name="repeat_interval" type="number" min="1" max="52" value="1"></label>
        <label><?= $view->e($view->t('Repeat until')) ?> <input name="repeat_end" type="date"></label>
        <small><?= $view->e($view->t('Repeating tasks use the start date, or today. On shorter months the occurrence falls on the last day. Custom intervals use Every.')) ?></small>
    </div>
</details>
