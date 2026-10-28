<section class="planning-page teamwork-page" data-teamwork-page aria-labelledby="teamwork-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="teamwork-title"><?= $view->e($view->t('Teamwork')) ?></h1>
            <p><?= $view->e($view->t('Shared goals with your team: tasks, progress and chat in one place.')) ?></p>
        </div>
        <div class="action-row">
            <button class="button button-primary" type="button" data-open-dialog="team-goal-dialog">
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                <span><?= $view->e($view->t('Add goal')) ?></span>
            </button>
        </div>
    </header>
    <div class="field team-search">
        <label for="team-search"><?= $view->e($view->t('Find work')) ?></label>
        <input id="team-search" type="search" autocomplete="off" placeholder="<?= $view->e($view->t('Search team goals by name or description')) ?>" data-team-search>
    </div>
    <section class="planning-panel" data-team-invitations hidden aria-labelledby="team-invitations-title">
        <h2 id="team-invitations-title"><?= $view->e($view->t('Invitations')) ?></h2>
        <div class="planning-list" data-team-invitation-list></div>
    </section>
    <section class="team-carousel" aria-labelledby="team-goals-title">
        <h2 id="team-goals-title" class="sr-only"><?= $view->e($view->t('My team goals')) ?></h2>
        <button class="team-carousel-arrow" type="button" data-team-page="-1" aria-label="<?= $view->e($view->t('Previous team goals')) ?>">&#8592;</button>
        <div class="team-carousel-viewport">
            <div class="team-carousel-track" data-team-goal-grid aria-live="polite"></div>
        </div>
        <button class="team-carousel-arrow" type="button" data-team-page="1" aria-label="<?= $view->e($view->t('Next team goals')) ?>">&#8594;</button>
    </section>
    <section class="team-detail" data-team-detail hidden aria-labelledby="team-detail-title">
        <header class="section-heading">
            <h2 id="team-detail-title" data-team-name></h2>
            <div class="action-row">
                <button class="button button-quiet" type="button" data-team-edit><?= $view->e($view->t('Edit goal')) ?></button>
                <button class="button button-quiet" type="button" data-team-leave><?= $view->e($view->t('Leave team')) ?></button>
            </div>
        </header>
        <div class="team-layout">
            <section class="planning-panel team-goal-panel" aria-labelledby="team-goal-details-title">
                <h3 id="team-goal-details-title"><?= $view->e($view->t('Goal details')) ?></h3>
                <p data-team-description></p>
                <p class="subtle-copy" data-team-due></p>
                <div class="progress-track" aria-hidden="true"><span data-team-progress-bar></span></div>
                <p class="subtle-copy" data-team-progress></p>
            </section>
            <section class="planning-panel team-members-panel" aria-labelledby="team-members-title">
                <header class="section-heading">
                    <h3 id="team-members-title"><?= $view->e($view->t('Member completion')) ?></h3>
                    <button class="button button-quiet" type="button" data-open-dialog="team-invite-dialog" data-team-invite-open hidden><?= $view->e($view->t('Invite')) ?></button>
                </header>
                <div class="team-scroll team-members" data-team-members></div>
            </section>
            <section class="planning-panel team-tasks-panel" aria-labelledby="team-tasks-title">
                <header class="section-heading">
                    <h3 id="team-tasks-title"><?= $view->e($view->t('Tasks')) ?></h3>
                    <button class="button button-primary" type="button" data-open-dialog="team-task-dialog" data-team-task-open hidden>
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                        <span><?= $view->e($view->t('Add task')) ?></span>
                    </button>
                </header>
                <div class="team-scroll planning-list" data-team-tasks></div>
            </section>
            <section class="planning-panel team-chat" aria-labelledby="team-chat-title">
                <h3 id="team-chat-title"><?= $view->e($view->t('Team chat')) ?></h3>
                <div class="team-scroll team-chat-log" data-team-chat-log aria-live="polite"></div>
                <form class="team-chat-form" data-team-chat-form>
                    <label class="sr-only" for="team-chat-body"><?= $view->e($view->t('Message')) ?></label>
                    <input id="team-chat-body" name="body" maxlength="2000" autocomplete="off" placeholder="<?= $view->e($view->t('Reply…')) ?>" required>
                    <button class="button button-primary" type="submit"><?= $view->e($view->t('Send')) ?></button>
                </form>
            </section>
        </div>
    </section>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <datalist id="team-contacts" data-team-contacts></datalist>
    <dialog id="team-task-dialog" class="workspace-dialog" aria-labelledby="team-task-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="team-task-dialog-title"><?= $view->e($view->t('New team task')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <form class="stack-form" data-team-task-form>
            <div class="field">
                <label for="team-task-name"><?= $view->e($view->t('Task name')) ?></label>
                <input id="team-task-name" name="name" maxlength="200" required autofocus>
            </div>
            <div class="field">
                <label for="team-task-assignee"><?= $view->e($view->t('Assignee')) ?></label>
                <select id="team-task-assignee" name="assignee_id" data-team-assignee></select>
            </div>
            <?php require __DIR__.'/task-capture-fields.php'; ?>
            <div class="action-row">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Add task')) ?></button>
                <button class="button button-quiet" type="button" data-close-dialog><?= $view->e($view->t('Cancel')) ?></button>
            </div>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
    <dialog id="team-invite-dialog" class="workspace-dialog" aria-labelledby="team-invite-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="team-invite-dialog-title"><?= $view->e($view->t('Invite a member')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <form class="stack-form" data-team-invite>
            <div class="field">
                <label for="team-invite-email"><?= $view->e($view->t('Email')) ?></label>
                <input id="team-invite-email" name="email" type="email" list="team-contacts" placeholder="<?= $view->e($view->t('Search contacts or type an email')) ?>" required autofocus>
            </div>
            <div class="field">
                <label for="team-invite-role"><?= $view->e($view->t('Role')) ?></label>
                <select id="team-invite-role" name="role">
                    <option value="viewer"><?= $view->e($view->t('Viewer')) ?></option>
                    <option value="editor"><?= $view->e($view->t('Editor')) ?></option>
                    <option value="admin"><?= $view->e($view->t('Admin')) ?></option>
                </select>
            </div>
            <div class="action-row">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Invite')) ?></button>
                <button class="button button-quiet" type="button" data-close-dialog><?= $view->e($view->t('Cancel')) ?></button>
            </div>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
    <dialog id="team-goal-dialog" class="workspace-dialog" aria-labelledby="team-goal-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="team-goal-dialog-title" data-team-dialog-title><?= $view->e($view->t('Add new goal')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <form class="stack-form" data-team-goal-form>
            <div class="field">
                <label for="team-goal-name"><?= $view->e($view->t('Goal name')) ?></label>
                <input id="team-goal-name" name="name" maxlength="200" required>
            </div>
            <div class="field">
                <label for="team-goal-description"><?= $view->e($view->t('Description')) ?></label>
                <textarea id="team-goal-description" name="description" rows="3" maxlength="10000"></textarea>
            </div>
            <div class="field">
                <label for="team-goal-due"><?= $view->e($view->t('Due date')) ?></label>
                <input id="team-goal-due" name="due_date" type="date">
            </div>
            <fieldset class="field" data-team-new-members>
                <legend><?= $view->e($view->t('Add team members and permissions')) ?></legend>
                <div class="team-invite">
                    <input type="email" list="team-contacts" placeholder="<?= $view->e($view->t('Search contacts or type an email')) ?>" data-team-member-email aria-label="<?= $view->e($view->t('Member email')) ?>">
                    <select data-team-member-role aria-label="<?= $view->e($view->t('Role')) ?>">
                        <option value="viewer"><?= $view->e($view->t('Viewer')) ?></option>
                        <option value="editor"><?= $view->e($view->t('Editor')) ?></option>
                        <option value="admin"><?= $view->e($view->t('Admin')) ?></option>
                    </select>
                    <button class="button button-quiet" type="button" data-team-member-add><?= $view->e($view->t('Add')) ?></button>
                </div>
                <ul class="team-pending-members" data-team-member-list></ul>
            </fieldset>
            <div class="action-row">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Save goal')) ?></button>
                <button class="button button-quiet" type="button" data-close-dialog><?= $view->e($view->t('Cancel')) ?></button>
            </div>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
</section>
