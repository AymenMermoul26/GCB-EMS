interface FullScreenLoaderProps {
  label?: string
}

export function FullScreenLoader({ label = 'Loading...' }: FullScreenLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  )
}
