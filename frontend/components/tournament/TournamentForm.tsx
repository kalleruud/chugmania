import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useConnection } from '@/contexts/ConnectionContext'
import { CreateTournamentRequest } from '@common/models/tournament'
import { useState } from 'react'
import { toast } from 'sonner'

interface TournamentFormProps {
  sessionId: string
  onSuccess?: () => void
}

export function TournamentForm({ sessionId, onSuccess }: TournamentFormProps) {
  const { socket } = useConnection()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupsCount, setGroupsCount] = useState(1)
  const [advancementCount, setAdvancementCount] = useState(2)
  const [eliminationType, setEliminationType] = useState<'single' | 'double'>('single')
  const [isLoading, setIsLoading] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) {
        toast.error('Name is required')
        return
    }

    setIsLoading(true)
    const payload: CreateTournamentRequest = {
      type: 'CreateTournamentRequest',
      session: sessionId,
      name,
      description,
      groupsCount,
      advancementCount,
      eliminationType,
    } as any

    toast.promise(
      socket.emitWithAck('create_tournament', payload).then(res => {
        setIsLoading(false)
        if (!res.success) throw new Error(res.message)
        onSuccess?.()
      }).catch(err => {
          setIsLoading(false)
          throw err
      }),
      {
        loading: 'Creating tournament...',
        success: 'Tournament created!',
        error: (e) => `Failed to create tournament: ${e.message}`,
      }
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
          <Label htmlFor="name">Tournament Name</Label>
          <Input 
            id="name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="e.g. Winter Championship" 
          />
      </div>
      
      <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Input 
            id="desc" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="Optional" 
          />
      </div>

      <div className="flex gap-4">
          <div className="flex-1 space-y-2">
              <Label htmlFor="groups">Groups</Label>
              <Input 
                id="groups" 
                type="number" 
                min={1}
                value={groupsCount} 
                onChange={e => setGroupsCount(parseInt(e.target.value))} 
              />
          </div>
          <div className="flex-1 space-y-2">
              <Label htmlFor="adv">Advancing per Group</Label>
              <Input 
                id="adv" 
                type="number" 
                min={1}
                value={advancementCount} 
                onChange={e => setAdvancementCount(parseInt(e.target.value))} 
              />
          </div>
      </div>

      <div className="space-y-2">
          <Label>Elimination Type</Label>
          <Select 
            value={eliminationType} 
            onValueChange={(val: any) => setEliminationType(val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Elimination</SelectItem>
              <SelectItem value="double">Double Elimination</SelectItem>
            </SelectContent>
          </Select>
      </div>

      <Button type="submit" disabled={isLoading}>Create Tournament</Button>
    </form>
  )
}
