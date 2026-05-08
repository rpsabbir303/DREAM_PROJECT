export function routeTaskToAgents(goal) {
    const normalized = goal.toLowerCase();
    const selected = new Set(['memory', 'research']);
    if (/(code|typescript|terminal|bug|build|electron|api|debug)/i.test(normalized))
        selected.add('developer');
    if (/(ui|ux|design|layout|accessibility|dashboard|screen)/i.test(normalized))
        selected.add('uiux');
    if (/(workflow|automation|schedule|pipeline|orchestrate)/i.test(normalized))
        selected.add('automation');
    if (selected.size < 3)
        selected.add('developer');
    return Array.from(selected).slice(0, 5);
}
