import activeWin from 'active-win';
export async function getActiveWindowInfo() {
    const info = await activeWin().catch(() => null);
    if (!info)
        return null;
    return {
        app: info.owner.name,
        title: info.title,
        processName: info.owner.path ?? 'unknown-process',
    };
}
