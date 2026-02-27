import type * as React from 'react'
import { createContext, useContext, useId, useMemo } from 'react'

import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(componentName: string) {
  const context = useContext(TabsContext)

  if (!context) {
    throw new Error(`${componentName} must be used inside <Tabs>.`)
  }

  return context
}

interface TabsProps extends React.ComponentProps<'div'> {
  value: string
  onValueChange: (value: string) => void
}

function Tabs({ value, onValueChange, className, ...props }: TabsProps) {
  const baseId = useId()
  const context = useMemo(
    () => ({ value, onValueChange, baseId }),
    [value, onValueChange, baseId],
  )

  return (
    <TabsContext.Provider value={context}>
      <div className={cn('w-full', className)} {...props} />
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex h-10 items-center justify-start rounded-xl border bg-muted/50 p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends React.ComponentProps<'button'> {
  value: string
}

function TabsTrigger({
  value,
  className,
  type = 'button',
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext('TabsTrigger')
  const isActive = context.value === value
  const triggerId = `${context.baseId}-trigger-${value}`
  const contentId = `${context.baseId}-content-${value}`

  return (
    <button
      id={triggerId}
      role="tab"
      type={type}
      aria-selected={isActive}
      aria-controls={contentId}
      data-state={isActive ? 'active' : 'inactive'}
      className={cn(
        'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      onClick={() => context.onValueChange(value)}
      {...props}
    />
  )
}

interface TabsContentProps extends React.ComponentProps<'div'> {
  value: string
}

function TabsContent({ value, className, ...props }: TabsContentProps) {
  const context = useTabsContext('TabsContent')
  const isActive = context.value === value
  const triggerId = `${context.baseId}-trigger-${value}`
  const contentId = `${context.baseId}-content-${value}`

  if (!isActive) {
    return null
  }

  return (
    <div
      id={contentId}
      role="tabpanel"
      aria-labelledby={triggerId}
      data-state={isActive ? 'active' : 'inactive'}
      className={cn('mt-4', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
