import './TodayShell.scss'

import { useActions, useValues } from 'kea'
import { useEffect, useRef } from 'react'

import { IconChevronLeft } from '@posthog/icons'
import { Button, Heading, ToastProvider, Tooltip, TooltipContent, TooltipTrigger } from '@posthog/quill'

import 'scenes/project-homepage/today/Today.scss'
import { Resizer } from 'lib/components/Resizer/Resizer'
import { ResizerLogicProps, resizerLogic } from 'lib/components/Resizer/resizerLogic'
import { cn } from 'lib/utils/css-classes'
import { TodayHomeSidebar } from 'scenes/project-homepage/today/TodayHomeSidebar'

import { NewSpaceDialog } from 'products/tasks/frontend/spaces/NewSpaceDialog'

import { TodayLibrarySidebar } from './TodayLibrarySidebar'
import { TodayMobileHeader } from './TodayMobileHeader'
import { TodayMoreSidebar } from './TodayMoreSidebar'
import { TodayPreviewCardProvider } from './TodayPreviewCardProvider'
import { TodayRail } from './TodayRail'
import {
    TODAY_MORE_PANES,
    TODAY_RAIL_WIDTH,
    TODAY_SIDEBAR_CLOSE_THRESHOLD,
    clampSidebarWidth,
    todayShellLogic,
} from './todayShellLogic'
import { TodaySidebarFooter } from './TodaySidebarFooter'
import { TodaySpacesSidebar } from './TodaySpacesSidebar'
import { TodayTabBar } from './TodayTabBar'
import { TodayToolsSidebar } from './TodayToolsSidebar'
import { TodayViewsSidebar } from './TodayViewsSidebar'

const PANE_LABELS = {
    home: 'Today',
    spaces: 'Spaces',
    views: 'Views',
    library: 'Library',
    tools: 'Tools',
    more: 'More',
}

/** The left navigation under the Today layout: the rail, then the sidebar for the pane the rail has open. */
export function TodayShell({ className }: { className?: string }): JSX.Element {
    const { activePane, mobileLayout, mobileNavLayout, sidebarVisible, sidebarWidth } = useValues(todayShellLogic)
    const { pickPane, setMobileSidebarOpen, setSidebarOpen, setSidebarWidth, toggleSidebar } =
        useActions(todayShellLogic)
    const sidebarRef = useRef<HTMLDivElement | null>(null)
    const drawerRef = useRef<HTMLElement | null>(null)
    const returnFocusRef = useRef<HTMLElement | null>(null)

    const resizerLogicProps: ResizerLogicProps = {
        // pinned: storage key for the persisted width. Renaming it resets everyone's sidebar width.
        logicKey: 'today-sidebar',
        placement: 'right',
        containerRef: sidebarRef,
        persistent: true,
        closeThreshold: TODAY_SIDEBAR_CLOSE_THRESHOLD,
        onToggleClosed: (closed) => setSidebarOpen(!closed),
        onDoubleClick: toggleSidebar,
    }
    const { desiredSize } = useValues(resizerLogic(resizerLogicProps))

    // The app layout reads the width from the shell logic to size the main column, so copy each change there.
    useEffect(() => {
        setSidebarWidth(clampSidebarWidth(desiredSize))
    }, [desiredSize, setSidebarWidth])

    useEffect(() => {
        if (!mobileLayout) {
            return
        }
        if (sidebarVisible) {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            drawerRef.current?.focus()
        } else if (returnFocusRef.current) {
            if (returnFocusRef.current.isConnected) {
                returnFocusRef.current.focus()
            }
            returnFocusRef.current = null
        }
    }, [mobileLayout, sidebarVisible])

    const pane = (
        <div className="TodayShell__pane">
            {activePane === 'home' ? (
                <TodayHomeSidebar />
            ) : activePane === 'spaces' ? (
                <TodayPreviewCardProvider>
                    <TodaySpacesSidebar />
                </TodayPreviewCardProvider>
            ) : activePane === 'views' ? (
                <TodayViewsSidebar />
            ) : activePane === 'library' ? (
                <TodayLibrarySidebar />
            ) : activePane === 'more' ? (
                <TodayMoreSidebar />
            ) : (
                <TodayToolsSidebar />
            )}
        </div>
    )

    const drawerProps = {
        ref: drawerRef,
        tabIndex: -1,
        'aria-label': PANE_LABELS[activePane],
        'aria-hidden': !sidebarVisible,
        'data-open': sidebarVisible,
        ...(sidebarVisible ? {} : { inert: '' }),
    }

    return (
        <ToastProvider>
            {mobileNavLayout ? (
                <div className={cn('Today TodayShell TodayShell--mobileNav', className)}>
                    {!sidebarVisible && <TodayMobileHeader />}
                    <aside {...drawerProps} className="TodayShell__sidebar TodayShell__page outline-none">
                        <div className="TodayShell__pageHeader" data-quill>
                            {TODAY_MORE_PANES.includes(activePane) && (
                                <Tooltip>
                                    <TooltipTrigger
                                        delay={0}
                                        render={
                                            <Button
                                                size="icon-lg"
                                                className="rounded-full -ml-3"
                                                aria-label="Back to More"
                                                data-attr="today-more-back"
                                                onClick={() => pickPane('more')}
                                            />
                                        }
                                    >
                                        <IconChevronLeft />
                                    </TooltipTrigger>
                                    <TooltipContent>Back to More</TooltipContent>
                                </Tooltip>
                            )}
                            <Heading render={<h1 />} size="xl" className="m-0 leading-tight">
                                {PANE_LABELS[activePane]}
                            </Heading>
                        </div>
                        {pane}
                        <TodaySidebarFooter />
                    </aside>
                    <TodayTabBar />
                    <NewSpaceDialog />
                </div>
            ) : (
                <div
                    className={cn('Today TodayShell', className)}
                    // eslint-disable-next-line react/forbid-dom-props
                    style={{ '--today-rail-width': `${TODAY_RAIL_WIDTH}px` } as React.CSSProperties}
                >
                    <TodayRail />
                    {mobileLayout ? (
                        <>
                            <div
                                className="TodayShell__scrim"
                                data-open={sidebarVisible}
                                aria-hidden
                                onClick={() => setMobileSidebarOpen(false)}
                            />
                            <aside
                                {...drawerProps}
                                className="TodayShell__sidebar TodayShell__drawer outline-none"
                                // eslint-disable-next-line react/forbid-dom-props
                                style={{ width: sidebarWidth }}
                            >
                                {pane}
                                <TodaySidebarFooter />
                            </aside>
                        </>
                    ) : (
                        sidebarVisible && (
                            <aside
                                ref={sidebarRef}
                                className="TodayShell__sidebar relative"
                                aria-label={PANE_LABELS[activePane]}
                                // eslint-disable-next-line react/forbid-dom-props
                                style={{ width: sidebarWidth }}
                            >
                                {pane}
                                <TodaySidebarFooter />
                                <Resizer {...resizerLogicProps} className="z-2" offset={0} />
                            </aside>
                        )
                    )}
                    {/* Mounted here so the sidebar and the spaces page open the same dialog. */}
                    <NewSpaceDialog />
                </div>
            )}
        </ToastProvider>
    )
}
