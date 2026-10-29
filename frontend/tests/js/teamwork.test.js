import assert from 'node:assert/strict';
import test from 'node:test';
import {
    carouselPages,
    filterTeamGoals,
    goalsPerPage,
    teamTaskPayload,
} from '../../src/js/planning/teamwork-page.js';

test('team goal search matches every word in the name or description', () => {
    const goals = [
        { id: '1', name: 'Website launch', description: 'Marketing site' },
        { id: '2', name: 'Hiring', description: 'Interview designers' },
    ];
    assert.deepEqual(
        filterTeamGoals(goals, 'launch site').map((goal) => goal.id),
        ['1'],
    );
    assert.deepEqual(
        filterTeamGoals(goals, '  DESIGN ').map((goal) => goal.id),
        ['2'],
    );
    assert.equal(filterTeamGoals(goals, '').length, 2);
});

test('the carousel shows at most four goals and pages through them four at a time', () => {
    assert.deepEqual([goalsPerPage(1200), goalsPerPage(700), goalsPerPage(400)], [4, 2, 1]);
    assert.deepEqual([carouselPages(0, 4), carouselPages(4, 4), carouselPages(9, 4)], [1, 1, 3]);
});

test('team task payload reuses the Tasks capture fields and adds the assignee', () => {
    globalThis.window = { notesBootstrap: { preferences: { timezone: 'UTC' } } };
    const data = new FormData();
    for (const [key, value] of Object.entries({
        name: 'Weekly sync',
        description: 'Agenda',
        assignee_id: '7',
        deadline: '',
        reminder_at: '',
        start_date: '',
        estimated_minutes: '30',
        importance: '4',
        repeat_frequency: 'weekly',
        repeat_unit: '',
        repeat_interval: '1',
        repeat_days: '',
        repeat_end: '',
    }))
        data.set(key, value);

    const payload = teamTaskPayload(data, '2026-11-02');
    assert.equal(payload.assignee_id, '7');
    assert.equal(payload.importance, 4);
    assert.equal(payload.estimated_minutes, 30);
    // A repeating task without a due date starts on today.
    assert.equal(payload.due_date, '2026-11-02');
    assert.deepEqual(payload.repeat, {
        frequency: 'weekly',
        interval_count: 1,
        weekdays: [1],
        end_date: null,
    });
});
