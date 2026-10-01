import { useActions, useValues } from 'kea'
import { useEffect, useState } from 'react'

import { IconChevronLeft, IconSidePanel } from '@posthog/icons'
import { Button, Text, Tooltip, TooltipContent, TooltipTrigger } from '@posthog/quill'

import { sidePanelStateLogic } from '~/layout/navigation-3000/sidepanel/sidePanelStateLogic'
import { breadcrumbsLogic } from '~/layout/navigation/Breadcrumbs/breadcrumbsLogic'
import { sceneLayoutLogic } from '~/layout/scenes/sceneLayoutLogic'
import { SidePanelTab } from '~/types'

import { todayShellLogic } from './todayShellLogic'

// About the height of a scene title, so the header title shows once the page title scrolls under it.
const TITLE_SCROLL_THRESHOLD = 56

/** The bar above a page on phone-width windows. Back returns to the previous page, or to the pane on the first page. */
export function TodayMobileHeader(): JSX.Element {
    const { sceneBreadcrumbs } = useValues(breadcrumbsLogic)
    const { scenePanelIsPresent } = useValues(sceneLayoutLogic)
    const { goBackOnMobile } = useActions(todayShellLogic)
    const { openSidePanel } = useActions(sidePanelStateLogic)
    const [scrolled, setScrolled] = useState(false)
    const title = [...sceneBreadcrumbs].reverse().find((breadcrumb) => !!breadcrumb.name)?.name

    useEffect(() => {
        const main = document.getElementById('main-content')
        if (!main) {
            return
        }
        const onScroll = (): void => setScrolled(main.scrollTop > TITLE_SCROLL_THRESHOLD)
        onScroll()
        main.addEventListener('scroll', onScroll, { passive: true })
        return () => main.removeEventListener('scroll', onScroll)
    }, [title])

    return (
        <header className="TodayMobileHeader" data-scrolled={scrolled} data-quill>
            <Tooltip>
                <TooltipTrigger
                    delay={0}
                    render={
                        <Button
                            size="icon-lg"
                            className="rounded-full"
                            aria-label="Back"
                            data-attr="today-mobile-back"
                            onClick={goBackOnMobile}
                        />
                    }
                >
                    <IconChevronLeft />
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
            </Tooltip>
            <Text
                render={<span />}
                weight="semibold"
                className="TodayMobileHeader__title min-w-0 flex-1 truncate"
                aria-hidden={!scrolled}
            >
                {title}
            </Text>
            <Tooltip>
                <TooltipTrigger
                    delay={0}
                    render={
                        <Button
                            size="icon-lg"
                            className="rounded-full"
                            aria-label="Open context panel"
                            data-attr="today-mobile-context-panel"
                            onClick={() => openSidePanel(scenePanelIsPresent ? SidePanelTab.Info : SidePanelTab.Max)}
                        />
                    }
                >
                    <IconSidePanel />
                </TooltipTrigger>
                <TooltipContent>Open context panel</TooltipContent>
            </Tooltip>
        </header>
    )
}
