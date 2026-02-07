import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuthContext } from '@/lib/auth-context'
import { useUserSettings, useCreateSettings, useUpdateSettings } from '@/hooks/use-settings'
import { reminderService } from '@/services/reminder-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Bell, Check } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'

export const Route = createFileRoute('/settings')({
  component: () => (
    <AuthGuard>
      <SettingsPage />
    </AuthGuard>
  ),
})

const REMINDER_OPTIONS = [
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
]

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
]

function SettingsPage() {
  const { user, userId, logout } = useAuthContext()
  const { data: settings, isLoading } = useUserSettings(userId)
  const createSettings = useCreateSettings()
  const updateSettings = useUpdateSettings()

  // Initialize state from settings data
  const initialReminderMinutes = settings?.defaultReminderMinutes ?? 1440
  const initialTimezone = settings?.timezone ?? 'UTC'
  
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState(() => String(initialReminderMinutes))
  const [timezone, setTimezone] = useState(() => initialTimezone)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'default'
  })
  const [saved, setSaved] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Sync state when settings load (only once)
  if (settings && !hasInitialized) {
    setDefaultReminderMinutes(String(settings.defaultReminderMinutes ?? 1440))
    setTimezone(settings.timezone ?? 'UTC')
    setHasInitialized(true)
  }

  const handleRequestPermission = async () => {
    const granted = await reminderService.requestPermission()
    setNotificationPermission(granted ? 'granted' : 'denied')
  }

  const handleSave = async () => {
    const settingsData = {
      defaultReminderMinutes: parseInt(defaultReminderMinutes, 10),
      timezone,
    }

    if (settings?.id) {
      await updateSettings.mutateAsync({
        id: settings.id,
        userId,
        ...settingsData,
      })
    } else {
      await createSettings.mutateAsync({
        userId,
        ...settingsData,
      })
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">Settings</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline truncate max-w-[150px] md:max-w-none">
              {user?.signInDetails?.loginId}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs md:text-sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure how and when you receive reminders for your todos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Browser Notifications</Label>
              <div className="flex items-center gap-4">
                {notificationPermission === 'granted' ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">Notifications enabled</span>
                  </div>
                ) : notificationPermission === 'denied' ? (
                  <p className="text-sm text-muted-foreground">
                    Notifications are blocked. Please enable them in your browser settings.
                  </p>
                ) : (
                  <Button variant="outline" onClick={handleRequestPermission}>
                    Enable Notifications
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultReminder">Default Reminder Time</Label>
              <Select
                value={defaultReminderMinutes}
                onValueChange={setDefaultReminderMinutes}
              >
                <SelectTrigger id="defaultReminder" className="w-[280px]">
                  <SelectValue placeholder="Select default reminder time" />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                This will be the default reminder time for new todos with due dates.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone" className="w-[280px]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={createSettings.isPending || updateSettings.isPending}
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Saved
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
