import { Navigate, Route, Routes } from 'react-router-dom'
import { DesktopLayout } from '@/layouts/DesktopLayout'
import { ActivityLogsPage } from '@/pages/ActivityLogsPage'
import { AutomationPage } from '@/pages/AutomationPage'
import { ChatPage } from '@/pages/ChatPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MemoryPage } from '@/pages/MemoryPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<DesktopLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/activity-logs" element={<ActivityLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
