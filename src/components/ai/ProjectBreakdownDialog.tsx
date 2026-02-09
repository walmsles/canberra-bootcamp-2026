import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useBreakdownProject } from '@/hooks/use-ai-agents'
import { useToast } from '@/hooks/use-toast'

interface ProjectBreakdownDialogProps {
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectBreakdownDialog({ listId, open, onOpenChange }: ProjectBreakdownDialogProps) {
  const [projectBrief, setProjectBrief] = useState('')
  const [deadline, setDeadline] = useState('')
  const submittingRef = useRef(false)
  const hasShownToastRef = useRef(false)
  const previousSuccessRef = useRef(false)

  const { breakdown, data, isLoading, error, reset, isSuccess } = useBreakdownProject()
  const { toast } = useToast()

  const handleSubmit = async () => {
    const trimmed = projectBrief.trim()
    if (!trimmed) return
    
    // Prevent duplicate submissions (React StrictMode causes double renders in dev)
    if (submittingRef.current) {
      console.warn('Already submitting, ignoring duplicate call')
      return
    }
    
    submittingRef.current = true
    
    // Convert date to end of day (23:59:59) if provided
    let deadlineValue: string | undefined = undefined
    if (deadline) {
      const date = new Date(deadline)
      date.setHours(23, 59, 59, 999)
      deadlineValue = date.toISOString()
    }
    
    // Show "processing" toast
    toast({
      title: 'Breaking down your project...',
      description: 'This may take a few minutes. You can continue using the app.',
    })
    
    // Close dialog (no spinner needed)
    onOpenChange(false)
    
    // Start the breakdown
    breakdown(listId, trimmed, deadlineValue)
  }

  const handleClose = () => {
    setProjectBrief('')
    setDeadline('')
    submittingRef.current = false
    hasShownToastRef.current = false
    previousSuccessRef.current = false
    reset()
    onOpenChange(false)
  }

  const handleRetry = () => {
    submittingRef.current = false
    hasShownToastRef.current = false
    previousSuccessRef.current = false
    reset()
  }

  // Handle success or error - show toast (runs even when dialog is closed)
  useEffect(() => {
    console.log('ProjectBreakdownDialog useEffect triggered', { 
      isSuccess, 
      data, 
      error, 
      hasShownToast: hasShownToastRef.current,
      previousSuccess: previousSuccessRef.current 
    })
    
    // Only show toast when isSuccess changes from false to true
    if (isSuccess && !previousSuccessRef.current && data && !hasShownToastRef.current) {
      console.log('Showing success toast')
      hasShownToastRef.current = true
      previousSuccessRef.current = true
      
      // Show success toast with AI summary
      const taskCount = 'totalTasks' in data ? (data.totalTasks as number) : 0
      const summary = 'summary' in data ? (data.summary as string) : `Created ${taskCount} tasks for your project.`
      
      toast({
        title: `Project breakdown complete! (${taskCount} tasks)`,
        description: summary,
        variant: 'default',
        duration: Infinity, // Require manual dismissal for long AI summary
      })
    } else if (error && !hasShownToastRef.current) {
      console.log('Showing error toast')
      hasShownToastRef.current = true
      
      // Error - show error toast
      toast({
        title: 'Project breakdown failed',
        description: error,
        variant: 'destructive',
      })
    }
  }, [isSuccess, data, error, toast])

  return (
    <Dialog open={open} onOpenChange={handleClose} modal={true}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Breakdown</DialogTitle>
          <DialogDescription>
            Describe your project and the AI will break it into individual tasks.
          </DialogDescription>
        </DialogHeader>

        {!data && !isLoading && !error && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-brief">Project Brief</Label>
              <Textarea
                id="project-brief"
                placeholder="Describe your project in detail..."
                value={projectBrief}
                onChange={(e) => setProjectBrief(e.target.value)}
                aria-label="Project brief"
                className="min-h-[270px] resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-deadline">Deadline (optional)</Label>
              <Input
                id="project-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                aria-label="Project deadline"
              />
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        )}

        <DialogFooter>
          {!data && !isLoading && !error && (
            <Button onClick={handleSubmit} disabled={!projectBrief.trim()}>
              Break Down Project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
