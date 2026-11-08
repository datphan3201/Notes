import calendar
from datetime import date, timedelta


def assert_acyclic(edges: dict[str, list[str]]):
    """Iterative DFS supports arbitrary depth without recursive stack limits."""
    done = set()
    for root in edges:
        active = set()
        stack = [(root, False)]
        while stack:
            node, leaving = stack.pop()
            if leaving:
                active.remove(node)
                done.add(node)
                continue
            if node in active:
                raise ValueError("This relation creates a cycle")
            if node in done:
                continue
            active.add(node)
            stack.append((node, True))
            stack.extend((child, False) for child in edges.get(node, []))


def recurrence_dates(rule, cursor: date, horizon: date, limit: int = 200):
    result = []
    start = rule.start_date
    candidate = max(start, cursor + timedelta(days=1))
    end = min(horizon, rule.end_date or horizon)
    while candidate <= end and len(result) < limit:
        months = (candidate.year - start.year) * 12 + candidate.month - start.month
        clamped = min(start.day, calendar.monthrange(candidate.year, candidate.month)[1])
        match rule.frequency:
            case "daily":
                eligible = (candidate - start).days % rule.interval_count == 0
            case "weekly":
                monday = candidate - timedelta(days=candidate.weekday())
                first = start - timedelta(days=start.weekday())
                eligible = (
                    (monday - first).days // 7
                ) % rule.interval_count == 0 and candidate.isoweekday() in rule.weekdays
            case "monthly":
                eligible = months % rule.interval_count == 0 and candidate.day == clamped
            case "yearly":
                eligible = (
                    (candidate.year - start.year) % rule.interval_count == 0
                    and candidate.month == start.month
                    and candidate.day == clamped
                )
            case _:
                raise ValueError("Unsupported recurrence frequency")
        if eligible:
            result.append(candidate)
        candidate += timedelta(days=1)
    return result


def daily_streak(done: set[date], rest: set[date], since: date, today: date):
    count, current = 0, today
    while current >= since:
        if current in done:
            count += 1
        elif current != today and current not in rest:
            break
        current -= timedelta(days=1)
    return count


def goal_progress(goals, milestones, tasks):
    by_id = {row.id: row for row in goals}
    children, components, result = {}, {}, {}
    for goal in goals:
        if goal.parent_goal_id:
            children.setdefault(goal.parent_goal_id, []).append(goal.id)
    for milestone in milestones:
        components.setdefault(milestone.goal_id, []).append(
            100 if milestone.status == "done" else 0
        )
    for task in tasks:
        if task.goal_id and task.series_id is None:
            components.setdefault(task.goal_id, []).append(100 if task.status == "done" else 0)
    for root in by_id:
        stack, active = [(root, False)], set()
        while stack:
            entity_id, expanded = stack.pop()
            if entity_id in result:
                continue
            if expanded:
                values = components.get(entity_id, []) + [
                    result[key] for key in children.get(entity_id, [])
                ]
                result[entity_id] = (
                    sum(values) / len(values)
                    if values
                    else (100 if by_id[entity_id].status == "completed" else 0)
                )
                active.remove(entity_id)
            else:
                if entity_id in active:
                    raise ValueError("Stored Goal hierarchy has a cycle")
                active.add(entity_id)
                stack.append((entity_id, True))
                stack.extend((child, False) for child in children.get(entity_id, []))
    return result


def weekly_streak(done: set[date], rest: set[date], target: int, since: date, today: date):
    count = 0
    current = today - timedelta(days=today.weekday())
    start = current
    while start + timedelta(days=6) >= since:
        available = [
            start + timedelta(days=i) for i in range(7) if start + timedelta(days=i) >= since
        ]
        completed = sum(day in done for day in available)
        rested = sum(day in rest and day not in done for day in available)
        required = max(0, min(target, len(available)) - rested)
        if completed and completed >= required:
            count += 1
        elif start != current and completed < required:
            break
        start -= timedelta(days=7)
    return count
