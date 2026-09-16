import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states'

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  )
}
