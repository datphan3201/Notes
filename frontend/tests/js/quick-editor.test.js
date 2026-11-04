import assert from 'node:assert/strict';
import test from 'node:test';
import { changedFields, formValues, fullPageHref } from '../../src/js/planning/quick-editor.js';

const task = {
    id: 't1',
    name: 'Write report',
    goal_id: 'g1',
    milestone_id: 'm1',
    status: 'InProgress',
    importance: 4,
    start_date: null,
    deadline: '2026-11-20',
    scheduled_start: null,
    scheduled_end: null,
    reminder_at: null,
    estimated_minutes: null,
    description: 'Draft',
    completion_criteria: '',
    expected_result: null,
};

test('form values read the parent, empty dates and stars the way the inputs hold them', () => {
    const values = formValues('task', task);
    assert.equal(values.parent, 'milestone:m1');
    assert.equal(values.deadline, '2026-11-20');
    assert.equal(values.start_date, '');
    assert.equal(values.expected_result, '');
    assert.equal(values.importance, '4');
    assert.equal(formValues('task', { ...task, milestone_id: null }).parent, 'goal:g1');
    assert.equal(formValues('task', { ...task, milestone_id: null, goal_id: null }).parent, '');
});

test('an edit sends only what changed, in API shape', () => {
    const initial = formValues('task', task);
    assert.deepEqual(changedFields('task', initial, initial), {});
    const values = {
        ...initial,
        name: '  Final report ',
        parent: 'goal:g2',
        deadline: '',
        estimated_minutes: '45',
        importance: '5',
    };
    assert.deepEqual(changedFields('task', values, initial), {
        name: 'Final report',
        goal_id: 'g2',
        milestone_id: null,
        deadline: null,
        estimated_minutes: 45,
        importance: 5,
    });
});

test('creating sends every field, and Goals and Milestones carry their icon', () => {
    const goal = formValues('goal', {
        importance: 3,
        area_id: 'a1',
        icon: 'book',
        icon_color: 'sky',
    });
    const body = changedFields('goal', { ...goal, name: 'Learn Go' });
    assert.equal(body.name, 'Learn Go');
    assert.equal(body.area_id, 'a1');
    assert.equal(body.icon, 'book');
    assert.equal(body.icon_color, 'sky');
    assert.equal(body.deadline, null);
    assert.equal('icon' in changedFields('task', formValues('task', task)), false);
});

test('Open full page goes to the Task page or the Milestone on its roadmap', () => {
    assert.equal(fullPageHref('task', { id: 't1' }), '/tasks/t1');
    assert.equal(fullPageHref('goal', { id: 'g1' }), '/goals/g1');
    assert.equal(fullPageHref('milestone', { id: 'm1', goal_id: 'g1' }), '/goals/g1#milestone=m1');
});
